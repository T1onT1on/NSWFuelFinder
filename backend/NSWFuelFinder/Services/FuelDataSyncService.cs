using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NSWFuelFinder.Data;
using NSWFuelFinder.Models.FuelApi;

namespace NSWFuelFinder.Services;

public sealed class FuelDataSyncService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IFuelApiClient _fuelApiClient;
    private readonly ILogger<FuelDataSyncService> _logger;

    public FuelDataSyncService(
        IServiceScopeFactory scopeFactory,
        IFuelApiClient fuelApiClient,
        ILogger<FuelDataSyncService> logger)
    {
        _scopeFactory = scopeFactory;
        _fuelApiClient = fuelApiClient;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Fuel data sync service starting.");

        while (!stoppingToken.IsCancellationRequested)
        {
            var syncStarted = DateTimeOffset.UtcNow;
            try
            {
                var (shouldSynchronise, lastSyncUtc) = await EvaluateSyncRequirementAsync(stoppingToken).ConfigureAwait(false);
                LogSyncCheckpoint(lastSyncUtc, shouldSynchronise);

                if (shouldSynchronise)
                {
                    await SynchroniseAsync(stoppingToken).ConfigureAwait(false);
                    _logger.LogInformation("Fuel data synchronisation completed at {Timestamp}.", syncStarted);
                }
                else
                {
                    _logger.LogInformation("Skipping fuel data synchronisation at {Timestamp}; data refreshed within the last 12 hours.", syncStarted);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Fuel data synchronisation failed at {Timestamp}.", syncStarted);
            }

            var delay = CalculateDelayUntilNextRun(syncStarted);
            try
            {
                await Task.Delay(delay, stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        _logger.LogInformation("Fuel data sync service stopping.");
    }

    private async Task<(bool ShouldSynchronise, DateTimeOffset? LastSyncUtc)> EvaluateSyncRequirementAsync(CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<FuelFinderDbContext>();

        var syncTimestamps = await dbContext.Stations
            .AsNoTracking()
            .Select(s => s.SyncedAtUtc)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        if (syncTimestamps.Count == 0)
        {
            return (true, null);
        }

        // OrderBy on DateTimeOffset is not translated by the SQLite provider, so evaluate on the client.
        var lastSync = syncTimestamps.Max();
        var timeSinceLastSync = DateTimeOffset.UtcNow - lastSync;
        return (timeSinceLastSync >= TimeSpan.FromHours(12), lastSync);
    }

    private void LogSyncCheckpoint(DateTimeOffset? lastSyncUtc, bool willSynchronise)
    {
        var tz = GetNswTimeZone();
        var utcText = lastSyncUtc?.ToString("yyyy-MM-dd HH:mm:ss 'UTC'") ?? "never";
        var aestText = lastSyncUtc.HasValue
            ? TimeZoneInfo.ConvertTime(lastSyncUtc.Value, tz).ToString("yyyy-MM-dd HH:mm:ss zzz")
            : "N/A";

        _logger.LogInformation(
            "Fuel data sync checkpoint. Last API fetch (UTC): {LastSyncUtc}. Last API fetch (AEST): {LastSyncAest}. Refresh required: {ShouldSynchronise}.",
            utcText,
            aestText,
            willSynchronise);
    }

    private async Task SynchroniseAsync(CancellationToken cancellationToken)
    {
        var response = await _fuelApiClient.GetAllPricesAsync(cancellationToken).ConfigureAwait(false);
        var syncTimestamp = DateTimeOffset.UtcNow;

        await using var scope = _scopeFactory.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<FuelFinderDbContext>();

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

        _logger.LogInformation("Persisted {HistoryCount} price history rows for sync at {Timestamp}.", historyEntries.Count, syncTimestamp);

        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
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

    private static TimeSpan CalculateDelayUntilNextRun(DateTimeOffset fromTimestamp)
    {
        var tz = GetNswTimeZone();
        var localNow = TimeZoneInfo.ConvertTime(fromTimestamp, tz);

        DateTime targetLocal;
        if (localNow.Hour < 12)
        {
            targetLocal = new DateTime(localNow.Year, localNow.Month, localNow.Day, 12, 0, 0);
        }
        else
        {
            targetLocal = new DateTime(localNow.Year, localNow.Month, localNow.Day, 0, 0, 0).AddDays(1);
        }

        var targetUtc = TimeZoneInfo.ConvertTimeToUtc(targetLocal, tz);
        var delay = targetUtc - fromTimestamp.UtcDateTime;
        return delay > TimeSpan.Zero ? delay : TimeSpan.FromHours(12);
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

        var suburbTokens = new List<string>();
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
    private static readonly HashSet<string> RoadTokens = new(StringComparer.OrdinalIgnoreCase)
    {
        "RD", "ROAD", "ST", "STREET", "AVE", "AVENUE", "HWY", "HIGHWAY",
        "DR", "DRIVE", "LN", "LANE", "WAY", "BLVD", "BOULEVARD", "CT", "COURT",
        "CCT", "CRES", "CRESCENT", "PL", "PLACE", "PKWY", "PARKWAY", "TER", "TERRACE",
        "ESP", "ESPLANADE", "MTWY", "MOTORWAY"
    };
}
