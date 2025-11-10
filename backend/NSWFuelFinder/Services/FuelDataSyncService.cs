using System;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NSWFuelFinder.Data;
using NSWFuelFinder.Models.FuelApi;
using Npgsql; // NEW: for advisory lock with PostgreSQL

namespace NSWFuelFinder.Services;

public sealed class FuelDataSyncService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IFuelApiClient _fuelApiClient;
    private readonly ILogger<FuelDataSyncService> _logger;
    private readonly IMemoryCache _cache;

    // Cache key for fast last-sync lookups via /api/system/last-sync
    public const string LastFuelSyncUtcCacheKey = "FuelSync:LastUtc";

    public FuelDataSyncService(
        IServiceScopeFactory scopeFactory,
        IFuelApiClient fuelApiClient,
        ILogger<FuelDataSyncService> logger,
        IMemoryCache cache)
    {
        _scopeFactory = scopeFactory;
        _fuelApiClient = fuelApiClient;
        _logger = logger;
        _cache = cache;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Fuel data sync service starting.");

        // Print last sync immediately at service start (read from DB)
        try
        {
            await using var scope0 = _scopeFactory.CreateAsyncScope();
            var db0 = scope0.ServiceProvider.GetRequiredService<FuelFinderDbContext>();

            // CHANGED: single aggregate MaxAsync instead of loading all timestamps
            var last = await db0.Stations.AsNoTracking()
                .Select(s => (DateTimeOffset?)s.SyncedAtUtc)
                .MaxAsync(stoppingToken);

            if (last.HasValue && last.Value != default)
            {
                var tz0 = GetNswTimeZone();
                var local0 = TimeZoneInfo.ConvertTime(last.Value, tz0);
                _logger.LogInformation("Startup: last fuel sync in DB => {Utc} UTC / {Local} Sydney",
                    last.Value.ToString("yyyy-MM-dd HH:mm:ss"),
                    local0.ToString("yyyy-MM-dd HH:mm:ss zzz"));
            }
            else
            {
                _logger.LogInformation("Startup: no previous fuel sync found in DB.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Startup: failed to read last sync timestamp.");
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            var syncStarted = DateTimeOffset.UtcNow;
            try
            {
                var (shouldSynchronise, lastSyncUtc, reason) =
                    await EvaluateSyncRequirementAsync(stoppingToken).ConfigureAwait(false);

                LogSyncCheckpoint(lastSyncUtc, shouldSynchronise, reason);

                if (shouldSynchronise)
                {
                    await SynchroniseAsync(stoppingToken).ConfigureAwait(false);

                    // Print the new last-sync time (read back from DB for accuracy)
                    try
                    {
                        await using var scope1 = _scopeFactory.CreateAsyncScope();
                        var db1 = scope1.ServiceProvider.GetRequiredService<FuelFinderDbContext>();
                        var lastNow = await db1.Stations.AsNoTracking()
                            .Select(s => (DateTimeOffset?)s.SyncedAtUtc)
                            .MaxAsync(stoppingToken) ?? DateTimeOffset.MinValue;

                        var tz1 = GetNswTimeZone();
                        var local1 = TimeZoneInfo.ConvertTime(lastNow, tz1);
                        _logger.LogInformation("Sync completed: last fuel sync is now => {Utc} UTC / {Local} Sydney",
                            lastNow.ToString("yyyy-MM-dd HH:mm:ss"),
                            local1.ToString("yyyy-MM-dd HH:mm:ss zzz"));
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to read back last sync timestamp after completion.");
                    }
                }
                else
                {
                    var tzSkip = GetNswTimeZone();
                    var lastLocal = lastSyncUtc.HasValue
                        ? TimeZoneInfo.ConvertTime(lastSyncUtc.Value, tzSkip)
                        : (DateTimeOffset?)null;

                    _logger.LogInformation(
                        "Skip: not running at this slot ({Reason}). Last sync => {LastUtc} UTC / {LastLocal} Sydney",
                        reason,
                        lastSyncUtc?.ToString("yyyy-MM-dd HH:mm:ss") ?? "N/A",
                        lastLocal?.ToString("yyyy-MM-dd HH:mm:ss zzz") ?? "N/A");
                }

                // === Always log next scheduled check ===
                var delay = CalculateDelayUntilNextRun(syncStarted);
                var nextAtUtc = syncStarted + delay;
                var tz = GetNswTimeZone();
                var nextAtLocal = TimeZoneInfo.ConvertTime(nextAtUtc, tz);
                _logger.LogInformation(
                    "Next sync check scheduled at => {NextUtc} UTC / {NextLocal} Sydney (in {Delay}).",
                    nextAtUtc.ToString("yyyy-MM-dd HH:mm:ss"),
                    nextAtLocal.ToString("yyyy-MM-dd HH:mm:ss zzz"),
                    delay);

                try
                {
                    await Task.Delay(delay, stoppingToken).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Fuel data synchronisation loop failed at {Timestamp}.", syncStarted);
                // Backoff a little to avoid tight error loops
                try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); } catch { /* ignored */ }
            }
        }

        _logger.LogInformation("Fuel data sync service stopping.");
    }

    // === Catch-up controls (NEW) ===
    private static readonly TimeSpan CatchupGrace = TimeSpan.FromMinutes(3);      // tolerate tiny clock/timing skews
    private static readonly TimeSpan CatchupCooldown = TimeSpan.FromHours(2);     // optional guard near next window (currently not enforced)
    private const long AdvisoryLockKey = 823741234987654321L;                     // arbitrary unique 64-bit key for pg advisory lock

    // Decide whether to run now:
    // - Run inside scheduled local-hour window (HH:00 ~ HH:00+WindowAfterMinutes)
    // - Debounce repeated runs (MinIntervalBetweenSyncs)
    // - NEW: Catch-up if we missed the most recent expected window start
    private async Task<(bool ShouldSynchronise, DateTimeOffset? LastSyncUtc, string Reason)>
        EvaluateSyncRequirementAsync(CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<FuelFinderDbContext>();

        // CHANGED: single aggregate, null if no rows
        var lastSync = await dbContext.Stations.AsNoTracking()
            .Select(s => (DateTimeOffset?)s.SyncedAtUtc)
            .MaxAsync(cancellationToken);

        // First-run: if no data yet, run immediately (no window restriction)
        if (lastSync is null)
            return (true, null, "first-run");

        var nowUtc = DateTimeOffset.UtcNow;

        // NEW: Catch-up logic ¡ª if we already passed the most recent expected window start,
        // but DB lastSync is still before that expected start, run once to catch up.
        var expectedStartUtc = GetMostRecentExpectedWindowStartUtc(nowUtc); // window start in UTC
        if (nowUtc >= expectedStartUtc + CatchupGrace && lastSync.Value < expectedStartUtc - CatchupGrace)
        {
            // Debounce: avoid immediate reruns if something just ran
            if (nowUtc - lastSync.Value < MinIntervalBetweenSyncs)
                return (false, lastSync, "debounced-too-soon");

            // Optional protection: skip catch-up if the next official window is very close
            // var nextDueUtc = nowUtc + CalculateDelayUntilNextRun(nowUtc);
            // if (nextDueUtc - nowUtc < CatchupCooldown)
            //     return (false, lastSync, "skip-catchup-near-next-window");

            return (true, lastSync, "catch-up-missed-window"); // NEW
        }

        // Regular scheduled window check
        if (!IsInScheduledLocalWindow(nowUtc))
            return (false, lastSync, "outside-schedule-window");

        var timeSinceLastSync = nowUtc - lastSync.Value;
        if (timeSinceLastSync < MinIntervalBetweenSyncs)
            return (false, lastSync, "debounced-too-soon");

        return (true, lastSync, "scheduled-window");
    }

    private void LogSyncCheckpoint(DateTimeOffset? lastSyncUtc, bool willSynchronise, string reason)
    {
        var tz = GetNswTimeZone();
        var utcText = lastSyncUtc?.ToString("yyyy-MM-dd HH:mm:ss 'UTC'") ?? "never";
        var localText = lastSyncUtc.HasValue
            ? TimeZoneInfo.ConvertTime(lastSyncUtc.Value, tz).ToString("yyyy-MM-dd HH:mm:ss zzz")
            : "N/A";

        _logger.LogInformation(
            "Checkpoint: last full-sync => {LastUtc} / {LastLocal}. Will run this slot: {WillRun}. Reason={Reason}",
            utcText, localText, willSynchronise, reason);
    }

    // NEW: compute the most-recent expected window start (Sydney local) and convert to UTC
    private static DateTimeOffset GetMostRecentExpectedWindowStartUtc(DateTimeOffset nowUtc)
    {
        var tz = GetNswTimeZone();
        var nowLocal = TimeZoneInfo.ConvertTime(nowUtc, tz); // Sydney local
        var hoursAsc = SyncHoursLocal.OrderBy(h => h).ToArray();

        int? candidateHour = hoursAsc.LastOrDefault(h => new TimeSpan(h, 0, 0) <= nowLocal.TimeOfDay);
        DateTime localStart;

        if (candidateHour.HasValue)
        {
            localStart = new DateTime(nowLocal.Year, nowLocal.Month, nowLocal.Day, candidateHour.Value, 0, 0, DateTimeKind.Unspecified);
        }
        else
        {
            // none today yet -> last window of yesterday
            var lastHour = hoursAsc.Last();
            localStart = new DateTime(nowLocal.Year, nowLocal.Month, nowLocal.Day, lastHour, 0, 0, DateTimeKind.Unspecified).AddDays(-1);
        }

        var utcStart = TimeZoneInfo.ConvertTimeToUtc(localStart, tz);
        return new DateTimeOffset(utcStart, TimeSpan.Zero);
    }

    private async Task SynchroniseAsync(CancellationToken cancellationToken)
    {
        var response = await _fuelApiClient.GetAllPricesAsync(cancellationToken).ConfigureAwait(false);
        var syncTimestamp = DateTimeOffset.UtcNow;

        await using var scope = _scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<FuelFinderDbContext>();

        // NEW: advisory lock to avoid concurrent full-syncs across instances
        var conn = (NpgsqlConnection)dbContext.Database.GetDbConnection();
        var shouldClose = conn.State != System.Data.ConnectionState.Open;
        if (shouldClose) await conn.OpenAsync(cancellationToken);

        bool gotLock = false;
        await using (var cmd = new NpgsqlCommand("SELECT pg_try_advisory_lock(@k)", conn))
        {
            cmd.Parameters.AddWithValue("k", AdvisoryLockKey);
            var scalar = await cmd.ExecuteScalarAsync(cancellationToken);
            gotLock = scalar is bool b && b;
        }

        if (!gotLock)
        {
            _logger.LogInformation("Another sync is running (advisory lock not acquired). Skipping this run.");
            if (shouldClose) await conn.CloseAsync();
            return;
        }

        try
        {
            var executionStrategy = dbContext.Database.CreateExecutionStrategy();
            await executionStrategy.ExecuteAsync(async () =>
            {
                dbContext.ChangeTracker.Clear();

                await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);

                await dbContext.Prices.ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
                await dbContext.Stations.ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);

                var stationEntities = response.Stations
                    .Where(station => !string.IsNullOrWhiteSpace(station.Code))
                    .Select(station => MapStation(station, syncTimestamp))
                    .ToList();

                await dbContext.Stations.AddRangeAsync(stationEntities, cancellationToken).ConfigureAwait(false);

                var priceEntities = response.Prices
                    .Where(price => !string.IsNullOrWhiteSpace(price.StationCode) && !string.IsNullOrWhiteSpace(price.FuelType))
                    .Select(MapPrice)
                    .ToList();

                await dbContext.Prices.AddRangeAsync(priceEntities, cancellationToken).ConfigureAwait(false);

                await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

                var historyEntries = priceEntities.Select(p => new FuelPriceHistoryEntity
                {
                    StationCode = p.StationCode,
                    FuelType = p.FuelType,
                    Price = p.Price,
                    RecordedAtUtc = syncTimestamp
                }).ToList();

                await dbContext.PriceHistory.AddRangeAsync(historyEntries, cancellationToken).ConfigureAwait(false);

                await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

                _logger.LogInformation("Persisted {HistoryCount} price history rows for sync at {Timestamp}.",
                    historyEntries.Count, syncTimestamp);

                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);

                // Persist the last full-sync timestamp to memory cache for quick reads.
                _cache.Set(LastFuelSyncUtcCacheKey, syncTimestamp, new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(1) // will be refreshed on each successful sync
                });

                // Log both UTC and Sydney-local for debugging/observability.
                var tz = GetNswTimeZone();
                var local = TimeZoneInfo.ConvertTime(syncTimestamp, tz);
                _logger.LogInformation("Last fuel sync set. UTC={Utc}, SydneyLocal={Local}.",
                    syncTimestamp.ToString("yyyy-MM-dd HH:mm:ss 'UTC'"),
                    local.ToString("yyyy-MM-dd HH:mm:ss zzz"));
            }).ConfigureAwait(false);
        }
        finally
        {
            // release advisory lock
            await using (var unlock = new NpgsqlCommand("SELECT pg_advisory_unlock(@k)", conn))
            {
                unlock.Parameters.AddWithValue("k", AdvisoryLockKey);
                await unlock.ExecuteNonQueryAsync(cancellationToken);
            }

            if (conn.State == System.Data.ConnectionState.Open)
                await conn.CloseAsync();
        }
    }

    private static FuelStationEntity MapStation(FuelStationPayload station, DateTimeOffset syncTimestamp)
    {
        var latitude = station.Location?.Latitude ?? 0;
        var longitude = station.Location?.Longitude ?? 0;
        var (resolvedSuburb, resolvedState, resolvedPostcode) = ResolveLocationFields(
            station.Suburb,
            station.State,
            station.Postcode,
            station.Address);

        return new FuelStationEntity
        {
            StationCode = station.Code,
            StationId = station.StationId,
            BrandId = station.BrandId,
            Brand = station.Brand,
            Name = station.Name,
            Address = station.Address,
            Suburb = resolvedSuburb,
            State = resolvedState,
            Postcode = resolvedPostcode,
            Latitude = latitude,
            Longitude = longitude,
            IsAdBlueAvailable = station.IsAdBlueAvailable ?? false,
            SyncedAtUtc = syncTimestamp
        };
    }

    private static FuelPriceEntity MapPrice(FuelPricePayload price)
    {
        return new FuelPriceEntity
        {
            StationCode = price.StationCode,
            FuelType = price.FuelType!,
            Price = price.Price,
            Unit = price.PriceUnit,
            Description = price.Description,
            LastUpdatedUtc = FuelDataParsing.ParseDateTimeOffset(price.PriceUpdatedRaw ?? price.LastUpdatedRaw)
        };
    }

    // Compute the delay to the next scheduled local hour (Australia/Sydney).
    private static TimeSpan CalculateDelayUntilNextRun(DateTimeOffset fromTimestamp)
    {
        var tz = GetNswTimeZone();
        var localNow = TimeZoneInfo.ConvertTime(fromTimestamp, tz);

        DateTime? nextLocal = null;
        foreach (var h in SyncHoursLocal.OrderBy(x => x))
        {
            var candidate = new DateTime(localNow.Year, localNow.Month, localNow.Day, h, 0, 0, DateTimeKind.Unspecified);
            if (candidate > localNow)
            {
                nextLocal = candidate;
                break;
            }
        }

        if (nextLocal is null)
        {
            var firstHour = SyncHoursLocal.OrderBy(x => x).First();
            nextLocal = new DateTime(localNow.Year, localNow.Month, localNow.Day, firstHour, 0, 0, DateTimeKind.Unspecified)
                .AddDays(1);
        }

        var nextUtc = TimeZoneInfo.ConvertTimeToUtc(nextLocal.Value, tz);
        var delay = nextUtc - fromTimestamp.UtcDateTime;

        // Safety: if due time is somehow in the past (DST edge cases), wait a small default.
        if (delay <= TimeSpan.Zero)
            delay = TimeSpan.FromMinutes(1);

        return delay;
    }

    // True only when now (local time) falls within [HH:00, HH:00+WindowAfter) for a scheduled HH
    private static bool IsInScheduledLocalWindow(DateTimeOffset nowUtc)
    {
        var tz = GetNswTimeZone();
        var local = TimeZoneInfo.ConvertTime(nowUtc, tz);
        var hour = local.Hour;
        var minute = local.Minute;

        // must be one of scheduled hours
        if (!SyncHoursLocalSet.Contains(hour))
            return false;

        // within window after the hour
        return minute >= 0 && minute < WindowAfterMinutes;
    }

    private static TimeZoneInfo GetNswTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("AUS Eastern Standard Time");
        }
        catch (TimeZoneNotFoundException)
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById("Australia/Sydney");
            }
            catch
            {
                return TimeZoneInfo.Utc;
            }
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }

    private static (string? Suburb, string? State, string? Postcode) ResolveLocationFields(
        string? rawSuburb,
        string? rawState,
        string? rawPostcode,
        string? address)
    {
        var suburb = !string.IsNullOrWhiteSpace(rawSuburb) ? NormalizeSuburb(rawSuburb) : null;
        var state = !string.IsNullOrWhiteSpace(rawState) ? NormalizeState(rawState) : null;
        var postcode = !string.IsNullOrWhiteSpace(rawPostcode) ? NormalizePostcode(rawPostcode) : null;

        if (!string.IsNullOrWhiteSpace(address))
        {
            var tail = ExtractAddressTail(address);

            if (!string.IsNullOrWhiteSpace(tail))
            {
                var combinedMatch = StatePostcodeRegex.Match(tail);
                if (combinedMatch.Success)
                {
                    state ??= NormalizeState(combinedMatch.Groups["state"].Value);
                    postcode ??= NormalizePostcode(combinedMatch.Groups["postcode"].Value);
                    tail = tail[..combinedMatch.Index];
                }

                if (state is null)
                {
                    var stateMatch = StateOnlyRegex.Match(tail);
                    if (stateMatch.Success)
                    {
                        state = NormalizeState(stateMatch.Value);
                        tail = tail[..stateMatch.Index];
                    }
                }

                if (postcode is null)
                {
                    var postcodeMatch = PostcodeOnlyRegex.Match(tail);
                    if (postcodeMatch.Success)
                    {
                        postcode = NormalizePostcode(postcodeMatch.Value);
                        tail = tail[..postcodeMatch.Index];
                    }
                }

                if (suburb is null)
                {
                    var candidate = ExtractSuburbCandidate(tail);
                    if (!string.IsNullOrWhiteSpace(candidate))
                    {
                        suburb = NormalizeSuburb(candidate);
                    }
                }

                if (suburb is null)
                {
                    var withoutStates = StateCodeRegex.Replace(tail, string.Empty);
                    var withoutNumbers = DigitsRegex.Replace(withoutStates, string.Empty);
                    var cleaned = CollapseWhitespaceRegex.Replace(withoutNumbers, " ").Trim();
                    suburb = string.IsNullOrWhiteSpace(cleaned) ? null : NormalizeSuburb(cleaned);
                }
            }
        }

        return (suburb, state, postcode);
    }

    private static string ExtractAddressTail(string address)
    {
        var parts = address.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0)
        {
            return address;
        }

        return parts[^1];
    }

    private static string NormalizeSuburb(string value) =>
        CultureInfo.InvariantCulture.TextInfo.ToTitleCase(value.Trim().ToLowerInvariant());

    private static string NormalizeState(string value) =>
        value.Trim().ToUpperInvariant();

    private static string NormalizePostcode(string value) =>
        value.Trim();

    private static string? ExtractSuburbCandidate(string tail)
    {
        if (string.IsNullOrWhiteSpace(tail))
        {
            return null;
        }

        var tokens = tail.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (tokens.Length == 0)
        {
            return null;
        }

        var suburbTokens = new System.Collections.Generic.List<string>();
        for (var i = tokens.Length - 1; i >= 0; i--)
        {
            var token = tokens[i].Trim().TrimEnd('.', ',');
            if (token.Length == 0)
            {
                continue;
            }

            var upperToken = token.ToUpperInvariant();

            if (TokenHasDigit(upperToken) || RoadTokens.Contains(upperToken))
            {
                break;
            }

            suburbTokens.Add(token);
        }

        if (suburbTokens.Count == 0)
        {
            return null;
        }

        suburbTokens.Reverse();
        return string.Join(' ', suburbTokens);
    }

    private static bool TokenHasDigit(string token) => token.Any(char.IsDigit);

    private static readonly Regex StateCodeRegex = new(@"\b(NSW|QLD|VIC|WA|SA|TAS|NT|ACT)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex DigitsRegex = new(@"\d+", RegexOptions.Compiled);
    private static readonly Regex CollapseWhitespaceRegex = new(@"\s{2,}", RegexOptions.Compiled);
    private static readonly Regex StatePostcodeRegex = new(@"\b(?<state>ACT|NSW|VIC|QLD|SA|WA|TAS|NT)\s+(?<postcode>\d{4})\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex StateOnlyRegex = new(@"\b(ACT|NSW|VIC|QLD|SA|WA|TAS|NT)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex PostcodeOnlyRegex = new(@"\b\d{4}\b", RegexOptions.Compiled);

    private static readonly System.Collections.Generic.HashSet<string> RoadTokens = new(StringComparer.OrdinalIgnoreCase)
    {
        "RD", "ROAD", "ST", "STREET", "AVE", "AVENUE", "HWY", "HIGHWAY",
        "DR", "DRIVE", "LN", "LANE", "WAY", "BLVD", "BOULEVARD", "CT", "COURT",
        "CCT", "CRES", "CRESCENT", "PL", "PLACE", "PKWY", "PARKWAY", "TER", "TERRACE",
        "ESP", "ESPLANADE", "MTWY", "MOTORWAY"
    };

    // Sydney-local hours to run the sync job.
    private static readonly int[] SyncHoursLocal = new[] { 2, 6, 8, 10, 12, 14, 16, 18, 20, 22 };
    private static readonly System.Collections.Generic.HashSet<int> SyncHoursLocalSet = SyncHoursLocal.ToHashSet();

    // Window length after a scheduled hour (e.g., allow HH:00 ~ HH:00+10m to run)
    private const int WindowAfterMinutes = 10;

    // Small debounce window to avoid double-runs if the host re-schedules closely.
    private static readonly TimeSpan MinIntervalBetweenSyncs = TimeSpan.FromMinutes(15);
}
