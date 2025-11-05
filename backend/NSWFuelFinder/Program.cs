using System;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.CookiePolicy;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSWFuelFinder.Data;
using NSWFuelFinder.Models;
using NSWFuelFinder.Options;
using NSWFuelFinder.Services;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;

const double DefaultOverviewRadiusKm = 5d;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services
    .AddOptions<FuelApiOptions>()
    .Bind(builder.Configuration.GetSection(FuelApiOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services
    .AddOptions<FuelDisplayOptions>()
    .Bind(builder.Configuration.GetSection(FuelDisplayOptions.SectionName));

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.AddMemoryCache();
builder.Services.AddDbContext<FuelFinderDbContext>(options =>
{
    var connectionString =
        builder.Configuration.GetConnectionString("FuelFinder")
        ?? builder.Configuration["Database:ConnectionString"]
        ?? builder.Configuration["FUELFINDER_DB_CONNECTION"];

    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException(
            "PostgreSQL connection string is missing. Configure ConnectionStrings:FuelFinder or FUELFINDER_DB_CONNECTION.");
    }

    options.UseNpgsql(connectionString, npgsql =>
    {
        npgsql.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(5), errorCodesToAdd: null);
    });
});

builder.Services
    .AddIdentityCore<IdentityUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequireDigit = false;
        options.Password.RequireLowercase = false;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequireUppercase = false;
        options.Password.RequiredLength = 6;
    })
    .AddEntityFrameworkStores<FuelFinderDbContext>()
    .AddSignInManager();

builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
                         ?? throw new InvalidOperationException("Jwt configuration is missing.");
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey))
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddHttpClient<IFuelAuthService, FuelAuthService>();
builder.Services.AddHttpClient<IFuelApiClient, FuelApiClient>();
builder.Services.AddScoped<IFuelStationService, FuelStationService>();
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddHostedService<FuelDataSyncService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowLocalhost",
        policy => policy
            .AllowAnyHeader()
            .AllowAnyMethod()
            .SetIsOriginAllowed(_ => true)
            .AllowCredentials());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowLocalhost");
app.UseCookiePolicy(new CookiePolicyOptions
{
    MinimumSameSitePolicy = SameSiteMode.None,
    Secure = CookieSecurePolicy.Always,
    HttpOnly = HttpOnlyPolicy.Always
});
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/stations/nearby", async Task<IResult> (
    [FromQuery] double? latitude,
    [FromQuery] double? longitude,
    [FromQuery] double? radiusKm,
    [FromQuery] string? suburb,
    [FromQuery] double? volumeLitres,
    [FromQuery] string? sortBy,
    [FromQuery] string? sortOrder,
    [FromQuery(Name = "brands")] string[]? brands,
    [FromQuery(Name = "fuelTypes")] string[]? fuelTypes,
    [FromQuery] string? fuelType,
    IFuelStationService stationService,
    CancellationToken cancellationToken) =>
{
    var hasLatitude = latitude.HasValue;
    var hasLongitude = longitude.HasValue;

    if (!hasLatitude && !hasLongitude && string.IsNullOrWhiteSpace(suburb))
    {
        return Results.BadRequest("Either coordinates or suburb must be provided.");
    }

    if (hasLatitude != hasLongitude)
    {
        return Results.BadRequest("Latitude and longitude must both be supplied together.");
    }

    if (hasLatitude && !IsValidLatitude(latitude!.Value))
    {
        return Results.BadRequest("Latitude must be a valid decimal degree value.");
    }

    if (hasLongitude && !IsValidLongitude(longitude!.Value))
    {
        return Results.BadRequest("Longitude must be a valid decimal degree value.");
    }

    var radius = Math.Clamp(radiusKm.GetValueOrDefault(5), 1, 50);
    var requestedFuelTypes = BuildRequestedFuelTypes(fuelTypes, fuelType);

    var stationResults = await stationService.GetNearbyStationsAsync(
        latitude,
        longitude,
        radius,
        suburb,
        requestedFuelTypes,
        brands,
        volumeLitres,
        sortBy,
        sortOrder,
        cancellationToken);
    return Results.Ok(new NearbyStationResponse
    {
        Latitude = latitude,
        Longitude = longitude,
        RadiusKm = radius,
        Count = stationResults.Stations.Count,
        Stations = stationResults.Stations,
        AvailableBrands = stationResults.AvailableBrands
    });
})
.WithName("GetNearbyStations")
.WithOpenApi();

app.MapGet("/api/prices/cheapest", async Task<IResult> (
    [FromQuery(Name = "fuelTypes")] string[]? fuelTypes,
    [FromQuery] string? fuelType,
    [FromQuery(Name = "brands")] string[]? brands,
    FuelFinderDbContext dbContext,
    IOptions<FuelDisplayOptions> displayOptions,
    CancellationToken cancellationToken) =>
{
    var allowedFuelSet = BuildAllowedFuelTypeSet(displayOptions.Value?.AllowedFuelTypes);

    var requestedFuelTypes = BuildRequestedFuelTypes(fuelTypes, fuelType)
        .Select(f => f.Trim().ToUpperInvariant())
        .Where(allowedFuelSet.Contains)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    var targetFuelTypes = requestedFuelTypes.Length > 0
        ? requestedFuelTypes
        : allowedFuelSet.ToArray();

    var requestedBrands = NormalizeBrandFilters(brands);
    var hasBrandFilter = requestedBrands.Count > 0;
    var brandFilterSet = hasBrandFilter
        ? new HashSet<string>(requestedBrands, StringComparer.OrdinalIgnoreCase)
        : null;

    var results = new List<CheapestPriceResponse>(targetFuelTypes.Length);

    foreach (var fuel in targetFuelTypes)
    {
        var priceCandidates = await dbContext.Prices
            .AsNoTracking()
            .Include(p => p.Station)
            .Where(p => p.FuelType == fuel)
            .ToListAsync(cancellationToken);

        if (hasBrandFilter)
        {
            priceCandidates = priceCandidates
                .Where(p =>
                {
                    var canonical = BrandNormalizer.GetCanonical(p.Station?.Brand);
                    return canonical is not null && brandFilterSet!.Contains(canonical);
                })
                .ToList();
        }

        var priceEntity = priceCandidates
            .OrderBy(p => p.Price)
            .ThenByDescending(p => p.LastUpdatedUtc)
            .FirstOrDefault();

        if (priceEntity is null || priceEntity.Station is null)
        {
            continue;
        }

        results.Add(new CheapestPriceResponse
        {
            FuelType = priceEntity.FuelType,
            CentsPerLitre = priceEntity.Price,
            Unit = priceEntity.Unit,
            Station = new StationSummary
            {
                StationCode = priceEntity.Station.StationCode,
                Name = priceEntity.Station.Name,
                Brand = BrandNormalizer.GetDisplay(priceEntity.Station.Brand),
                BrandCanonical = BrandNormalizer.GetCanonical(priceEntity.Station.Brand),
                BrandOriginal = priceEntity.Station.Brand,
                Address = priceEntity.Station.Address,
                Suburb = priceEntity.Station.Suburb,
                State = priceEntity.Station.State,
                Postcode = priceEntity.Station.Postcode,
                Latitude = priceEntity.Station.Latitude,
                Longitude = priceEntity.Station.Longitude
            },
            LastUpdated = priceEntity.LastUpdatedUtc
        });
    }

    results = results
        .OrderBy(r => r.FuelType, StringComparer.OrdinalIgnoreCase)
        .ToList();

    return Results.Ok(results);
})
.WithName("GetCheapestPrices")
.WithOpenApi();

app.MapGet("/api/stations/{stationCode}/trends", async Task<IResult> (
    string stationCode,
    [FromQuery] string? fuelType,
    [FromQuery] int? periodDays,
    FuelFinderDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(stationCode))
    {
        return Results.BadRequest("Station code is required.");
    }

    var normalizedCode = stationCode.Trim();
    var normalizedFuelType = string.IsNullOrWhiteSpace(fuelType)
        ? null
        : NormalizeFuelType(fuelType);

    var days = periodDays.HasValue ? Math.Clamp(periodDays.Value, 1, 365) : 30;
    var minTimestamp = DateTimeOffset.UtcNow.AddDays(-days);

    var historyQuery = dbContext.PriceHistory
        .AsNoTracking()
        .Where(h => h.StationCode == normalizedCode);

    if (normalizedFuelType is not null)
    {
        historyQuery = historyQuery.Where(h => h.FuelType.ToUpper() == normalizedFuelType);
    }

    var historyItems = await historyQuery.ToListAsync(cancellationToken);
    historyItems = historyItems
        .Where(h => h.RecordedAtUtc >= minTimestamp)
        .ToList();

    var priceQuery = dbContext.Prices
        .AsNoTracking()
        .Where(p => p.StationCode == normalizedCode);

    if (normalizedFuelType is not null)
    {
        priceQuery = priceQuery.Where(p => p.FuelType.ToUpper() == normalizedFuelType);
    }

    var currentPrices = await priceQuery.ToListAsync(cancellationToken);

    var allFuelTypes = new SortedSet<string>(StringComparer.OrdinalIgnoreCase);

    foreach (var item in historyItems)
    {
        if (!string.IsNullOrWhiteSpace(item.FuelType))
        {
            allFuelTypes.Add(NormalizeFuelType(item.FuelType));
        }
    }

    foreach (var price in currentPrices)
    {
        if (!string.IsNullOrWhiteSpace(price.FuelType))
        {
            allFuelTypes.Add(NormalizeFuelType(price.FuelType));
        }
    }

    if (normalizedFuelType is not null)
    {
        allFuelTypes.Add(normalizedFuelType);
    }

    if (allFuelTypes.Count == 0)
    {
        return Results.Ok(Array.Empty<FuelPriceTrendResponse>());
    }

    var historyByFuel = historyItems
        .Where(h => !string.IsNullOrWhiteSpace(h.FuelType))
        .GroupBy(h => NormalizeFuelType(h.FuelType), StringComparer.OrdinalIgnoreCase)
        .ToDictionary(
            g => g.Key,
            g => g.OrderBy(h => h.RecordedAtUtc)
                .Select(h => new FuelPriceTrendPoint(h.RecordedAtUtc, h.Price))
                .ToList(),
            StringComparer.OrdinalIgnoreCase);

    var currentPriceMap = currentPrices
        .Where(p => !string.IsNullOrWhiteSpace(p.FuelType))
        .GroupBy(p => NormalizeFuelType(p.FuelType), StringComparer.OrdinalIgnoreCase)
        .ToDictionary(
            g => g.Key,
            g => g.OrderByDescending(p => p.LastUpdatedUtc ?? DateTimeOffset.MinValue).First(),
            StringComparer.OrdinalIgnoreCase);

    var missingFuelTypes = allFuelTypes
        .Where(fuel => !historyByFuel.ContainsKey(fuel))
        .ToList();

    var latestBeforeMap = new Dictionary<string, FuelPriceHistoryEntity>(StringComparer.OrdinalIgnoreCase);

    if (missingFuelTypes.Count > 0)
    {
        var normalizedMissing = missingFuelTypes.ToList();
        var previousHistory = await dbContext.PriceHistory
            .AsNoTracking()
            .Where(h => h.StationCode == normalizedCode)
            .ToListAsync(cancellationToken);

        foreach (var item in previousHistory
                     .Where(h => h.RecordedAtUtc < minTimestamp)
                     .Where(h => !string.IsNullOrWhiteSpace(h.FuelType))
                     .Where(h => normalizedMissing.Contains(h.FuelType.ToUpper()))
                     .OrderByDescending(h => h.RecordedAtUtc))
        {
            if (string.IsNullOrWhiteSpace(item.FuelType))
            {
                continue;
            }

            var key = NormalizeFuelType(item.FuelType);
            if (!latestBeforeMap.ContainsKey(key))
            {
                latestBeforeMap[key] = item;
            }
        }
    }

    var responses = new List<FuelPriceTrendResponse>(allFuelTypes.Count);

    foreach (var fuel in allFuelTypes)
    {
        var seriesPoints = historyByFuel.TryGetValue(fuel, out var existingPoints)
            ? new List<FuelPriceTrendPoint>(existingPoints)
            : new List<FuelPriceTrendPoint>();

        if (seriesPoints.Count == 0)
        {
            if (latestBeforeMap.TryGetValue(fuel, out var latestBefore))
            {
                var recordedAt = latestBefore.RecordedAtUtc >= minTimestamp
                    ? latestBefore.RecordedAtUtc
                    : minTimestamp;
                seriesPoints.Add(new FuelPriceTrendPoint(recordedAt, latestBefore.Price));
            }
            else if (currentPriceMap.TryGetValue(fuel, out var current))
            {
                var recordedAt = current.LastUpdatedUtc ?? DateTimeOffset.UtcNow;
                if (recordedAt < minTimestamp)
                {
                    recordedAt = minTimestamp;
                }

                seriesPoints.Add(new FuelPriceTrendPoint(recordedAt, current.Price));
            }
        }

        if (seriesPoints.Count == 0)
        {
            continue;
        }

        seriesPoints.Sort((left, right) => left.RecordedAt.CompareTo(right.RecordedAt));
        responses.Add(new FuelPriceTrendResponse(fuel, seriesPoints));
    }

    if (responses.Count == 0)
    {
        return Results.Ok(Array.Empty<FuelPriceTrendResponse>());
    }

    var orderedResponse = responses
        .OrderBy(r => r.FuelType, StringComparer.OrdinalIgnoreCase)
        .ToList();

    return Results.Ok(orderedResponse);
})
.WithName("GetStationTrends")
.WithOpenApi();

app.MapPost("/api/auth/register", async Task<IResult> (
    RegisterRequest request,
    UserManager<IdentityUser> userManager,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.BadRequest("Email and password are required.");
    }

    var existingUser = await userManager.FindByEmailAsync(request.Email);
    if (existingUser is not null)
    {
        return Results.Conflict("An account with that email already exists.");
    }

    var user = new IdentityUser
    {
        UserName = request.Email,
        Email = request.Email
    };

    var result = await userManager.CreateAsync(user, request.Password);
    if (!result.Succeeded)
    {
        return Results.BadRequest(result.Errors);
    }

    return Results.Created($"/api/users/{user.Id}", new { user.Id, user.Email });
})
.WithName("Register")
.WithOpenApi();

app.MapPost("/api/auth/login", async Task<IResult> (
    LoginRequest request,
    UserManager<IdentityUser> userManager,
    SignInManager<IdentityUser> signInManager,
    ITokenService tokenService,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.BadRequest("Email and password are required.");
    }

    var user = await userManager.FindByEmailAsync(request.Email);
    if (user is null)
    {
        return Results.Unauthorized();
    }

    var signInResult = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: false);
    if (!signInResult.Succeeded)
    {
        return Results.Unauthorized();
    }

    var tokens = await tokenService.GenerateTokenPairAsync(
        user,
        httpContext.Connection.RemoteIpAddress?.ToString(),
        cancellationToken);

    return Results.Ok(tokens);
})
.WithName("Login")
.WithOpenApi();

app.MapPost("/api/auth/refresh", async Task<IResult> (
    RefreshTokenRequest request,
    ITokenService tokenService,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    var tokens = await tokenService.RefreshTokenAsync(
        request,
        httpContext.Connection.RemoteIpAddress?.ToString(),
        cancellationToken);

    return tokens is null ? Results.Unauthorized() : Results.Ok(tokens);
})
.WithName("RefreshToken")
.WithOpenApi();

app.MapPost("/api/auth/logout", async Task<IResult> (
    LogoutRequest request,
    ITokenService tokenService,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    await tokenService.RevokeRefreshTokenAsync(
        request,
        httpContext.Connection.RemoteIpAddress?.ToString(),
        cancellationToken);
    return Results.NoContent();
})
.WithName("Logout")
.WithOpenApi();

app.MapGet("/api/users/me/preferences", async Task<IResult> (
    ClaimsPrincipal principal,
    UserManager<IdentityUser> userManager,
    FuelFinderDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var userId = userManager.GetUserId(principal);
    if (string.IsNullOrWhiteSpace(userId))
    {
        return Results.Unauthorized();
    }

    var entity = await dbContext.Preferences
        .AsNoTracking()
        .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);

    var response = BuildUserPreferencesResponse(entity);

    return Results.Ok(response);
})
.RequireAuthorization()
.WithName("GetUserPreferences")
.WithOpenApi();

app.MapPut("/api/users/me/preferences", async Task<IResult> (
    UpdatePreferencesRequest request,
    ClaimsPrincipal principal,
    UserManager<IdentityUser> userManager,
    FuelFinderDbContext dbContext,
    CancellationToken cancellationToken) =>
{
    var userId = userManager.GetUserId(principal);
    if (string.IsNullOrWhiteSpace(userId))
    {
        return Results.Unauthorized();
    }

    var entity = await dbContext.Preferences
        .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);

    var preferredFuelTypes = request.PreferredFuelTypes is { Count: > 0 }
        ? string.Join(",", request.PreferredFuelTypes
            .Select(f => f.Trim().ToUpperInvariant())
            .Where(f => !string.IsNullOrWhiteSpace(f)))
        : null;

    var displayName = string.IsNullOrWhiteSpace(request.DisplayName)
        ? null
        : request.DisplayName!.Trim();

    var avatarDataUrl = string.IsNullOrWhiteSpace(request.AvatarDataUrl)
        ? null
        : request.AvatarDataUrl;

    var overview = request.OverviewFilter;
    var overviewEnabled = overview?.Enabled ?? false;
    var overviewSelectAll = overview?.SelectAll ?? true;

    string? overviewFuelTypes = null;
    if (overview is { FuelTypes.Count: > 0 } && !overviewSelectAll)
    {
        overviewFuelTypes = string.Join(",", overview.FuelTypes
            .Select(f => f.Trim().ToUpperInvariant())
            .Where(f => !string.IsNullOrWhiteSpace(f)));
    }

    string? overviewBrandNames = null;
    if (overview is { BrandNames.Count: > 0 })
    {
        overviewBrandNames = string.Join(",", overview.BrandNames
            .Select(b => b?.Trim())
            .Where(b => !string.IsNullOrWhiteSpace(b))
            .Distinct(StringComparer.OrdinalIgnoreCase));
    }

    double overviewRadius = overview?.RadiusKm ?? request.DefaultRadiusKm ?? DefaultOverviewRadiusKm;
    if (overviewRadius <= 0)
    {
        overviewRadius = DefaultOverviewRadiusKm;
    }
    overviewRadius = Math.Clamp(overviewRadius, 1d, 50d);

    if (entity is null)
    {
        entity = new UserPreferenceEntity
        {
            UserId = userId,
            DefaultSuburb = request.DefaultSuburb,
            DefaultRadiusKm = request.DefaultRadiusKm,
            PreferredFuelTypes = preferredFuelTypes,
            DisplayName = displayName,
            AvatarDataUrl = avatarDataUrl,
            OverviewFilterEnabled = overviewEnabled,
            OverviewFilterSelectAll = overviewSelectAll,
            OverviewFilterFuelTypes = overviewFuelTypes,
            OverviewFilterBrandNames = overviewBrandNames,
            OverviewFilterRadiusKm = overviewRadius,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };
        dbContext.Preferences.Add(entity);
    }
    else
    {
        entity.DefaultSuburb = request.DefaultSuburb;
        entity.DefaultRadiusKm = request.DefaultRadiusKm;
        entity.PreferredFuelTypes = preferredFuelTypes;
        entity.DisplayName = displayName;
        entity.AvatarDataUrl = avatarDataUrl;
        entity.OverviewFilterEnabled = overviewEnabled;
        entity.OverviewFilterSelectAll = overviewSelectAll;
        entity.OverviewFilterFuelTypes = overviewFuelTypes;
        entity.OverviewFilterBrandNames = overviewBrandNames;
        entity.OverviewFilterRadiusKm = overviewRadius;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    await dbContext.SaveChangesAsync(cancellationToken);

    var response = BuildUserPreferencesResponse(entity);

    return Results.Ok(response);
})
.RequireAuthorization()
.WithName("UpdateUserPreferences")
.WithOpenApi();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var db = services.GetRequiredService<FuelFinderDbContext>();
    await db.Database.MigrateAsync();

    var loggerFactory = services.GetRequiredService<ILoggerFactory>();
    var startupLogger = loggerFactory.CreateLogger("StartupMetrics");
    try
    {
        var historyCount = await db.PriceHistory.CountAsync();
        startupLogger.LogInformation("Price history rows available at startup: {HistoryCount}", historyCount);
    }
    catch (Exception ex)
    {
        startupLogger.LogError(ex, "Failed to read price history count on startup.");
    }
}

app.Run();

static UserPreferencesResponse BuildUserPreferencesResponse(UserPreferenceEntity? entity)
{
    if (entity is null)
    {
        return new UserPreferencesResponse(
            null,
            null,
            Array.Empty<string>(),
            null,
            null,
            new OverviewFilterSettings(false, true, Array.Empty<string>(), Array.Empty<string>(), DefaultOverviewRadiusKm));
    }

    var overviewRadius = entity.OverviewFilterRadiusKm ?? entity.DefaultRadiusKm ?? DefaultOverviewRadiusKm;
    if (overviewRadius <= 0)
    {
        overviewRadius = DefaultOverviewRadiusKm;
    }
    overviewRadius = Math.Clamp(overviewRadius, 1d, 50d);

    return new UserPreferencesResponse(
        entity.DefaultSuburb,
        entity.DefaultRadiusKm,
        SplitFuelTypes(entity.PreferredFuelTypes),
        entity.DisplayName,
        entity.AvatarDataUrl,
        new OverviewFilterSettings(
            entity.OverviewFilterEnabled,
            entity.OverviewFilterSelectAll,
            entity.OverviewFilterSelectAll
                ? Array.Empty<string>()
                : SplitFuelTypes(entity.OverviewFilterFuelTypes),
            SplitBrandNames(entity.OverviewFilterBrandNames),
            overviewRadius));
}


static bool IsValidLatitude(double value) => value is >= -90 and <= 90;
static bool IsValidLongitude(double value) => value is >= -180 and <= 180;
static IReadOnlyCollection<string> BuildRequestedFuelTypes(string[]? fuelTypes, string? singleFuelType)
{
    var set = new SortedSet<string>(StringComparer.OrdinalIgnoreCase);

    if (fuelTypes is not null)
    {
        foreach (var type in fuelTypes)
        {
            if (!string.IsNullOrWhiteSpace(type))
            {
                set.Add(type.Trim().ToUpperInvariant());
            }
        }
    }

    if (!string.IsNullOrWhiteSpace(singleFuelType))
    {
        set.Add(singleFuelType.Trim().ToUpperInvariant());
    }

    return set.ToList();
}

static IReadOnlyCollection<string> SplitFuelTypes(string? raw) =>
    string.IsNullOrWhiteSpace(raw)
        ? Array.Empty<string>()
        : raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(f => f.ToUpperInvariant())
            .ToArray();

static IReadOnlyCollection<string> SplitBrandNames(string? raw) =>
    string.IsNullOrWhiteSpace(raw)
        ? Array.Empty<string>()
        : raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(b => b)
            .ToArray();

static IReadOnlyList<string> NormalizeBrandFilters(string[]? brands)
{
    if (brands is null || brands.Length == 0)
    {
        return Array.Empty<string>();
    }

    return brands
        .Select(BrandNormalizer.GetCanonical)
        .Where(b => !string.IsNullOrWhiteSpace(b))
        .Select(b => b!)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToList();
}

static string NormalizeFuelType(string fuelType) =>
    string.IsNullOrWhiteSpace(fuelType)
        ? string.Empty
        : fuelType.Trim().ToUpperInvariant();

static HashSet<string> BuildAllowedFuelTypeSet(string[]? configured)
{
    var source = (configured is { Length: > 0 } ? configured : new[] { "E10", "U91", "P95", "P98", "DL", "PDL" });
    return new HashSet<string>(
        source.Where(f => !string.IsNullOrWhiteSpace(f)).Select(f => f.Trim().ToUpperInvariant()),
        StringComparer.OrdinalIgnoreCase);
}

internal sealed class NearbyStationResponse
{
    public double? Latitude { get; init; }
    public double? Longitude { get; init; }
    public double RadiusKm { get; init; }
    public int Count { get; init; }
    public IReadOnlyList<NearbyFuelStation> Stations { get; init; } = Array.Empty<NearbyFuelStation>();
    public IReadOnlyList<string> AvailableBrands { get; init; } = Array.Empty<string>();
}

internal sealed class CheapestPriceResponse
{
    public string FuelType { get; init; } = string.Empty;
    public decimal CentsPerLitre { get; init; }
    public string? Unit { get; init; }
    public DateTimeOffset? LastUpdated { get; init; }
    public StationSummary Station { get; init; } = new();
}

internal sealed class StationSummary
{
    public string StationCode { get; init; } = string.Empty;
    public string? Name { get; init; }
    public string? Brand { get; init; }
    public string? BrandCanonical { get; init; }
    public string? BrandOriginal { get; init; }
    public string? Address { get; init; }
    public string? Suburb { get; init; }
    public string? State { get; init; }
    public string? Postcode { get; init; }
    public double Latitude { get; init; }
    public double Longitude { get; init; }
}

