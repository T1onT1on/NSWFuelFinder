using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSWFuelFinder.Data;
using NSWFuelFinder.Models;
using NSWFuelFinder.Options;

namespace NSWFuelFinder.Services;

public interface IFuelStationService
{
    Task<NearbyStationsResult> GetNearbyStationsAsync(
        double? latitude,
        double? longitude,
        double radiusKm,
        string? suburb,
        IReadOnlyCollection<string>? fuelTypes,
        IReadOnlyCollection<string>? brands,
        double? volumeLitres,
        string? sortBy,
        string? sortOrder,
        CancellationToken cancellationToken);
}

public sealed class FuelStationService : IFuelStationService
{
    private readonly FuelFinderDbContext _dbContext;
    private readonly ILogger<FuelStationService> _logger;
    private readonly ISuburbCoordinateResolver _coordinateResolver;
    private static readonly string[] DefaultAllowedFuelTypes =
    [
        "E10",
        "U91",
        "P95",
        "P98",
        "DL",
        "PDL"
    ];

    private readonly ISet<string> _allowedFuelTypes;

    public FuelStationService(
        FuelFinderDbContext dbContext,
        ILogger<FuelStationService> logger,
        IOptions<FuelDisplayOptions> displayOptions,
        ISuburbCoordinateResolver coordinateResolver)
    {
        _dbContext = dbContext;
        _logger = logger;
        _coordinateResolver = coordinateResolver;
        var configuredFuelTypes = displayOptions.Value?.AllowedFuelTypes;
        var fuels = (configuredFuelTypes is { Length: > 0 } ? configuredFuelTypes : DefaultAllowedFuelTypes)
            .Where(f => !string.IsNullOrWhiteSpace(f))
            .Select(f => f.Trim().ToUpperInvariant());

        _allowedFuelTypes = new HashSet<string>(fuels, StringComparer.OrdinalIgnoreCase);
    }

    public async Task<NearbyStationsResult> GetNearbyStationsAsync(
        double? latitude,
        double? longitude,
        double radiusKm,
        string? suburb,
        IReadOnlyCollection<string>? fuelTypes,
        IReadOnlyCollection<string>? brands,
        double? volumeLitres,
        string? sortBy,
        string? sortOrder,
        CancellationToken cancellationToken)
    {
        var normalizedFuelTypes = NormalizeFuelTypes(fuelTypes, _allowedFuelTypes);
        var normalizedBrands = NormalizeBrands(brands);
        var radius = Math.Max(radiusKm, 0);

        double? effectiveLatitude = latitude;
        double? effectiveLongitude = longitude;
        string? message = null;

        var query = _dbContext.Stations
            .AsNoTracking()
            .Include(s => s.Prices)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(suburb))
        {
            var coordinate = await _coordinateResolver.ResolveAsync(suburb, cancellationToken).ConfigureAwait(false);
            if (coordinate is null)
            {
                message = $"Stations within suburb/postcode '{suburb}' not found!";
                return new NearbyStationsResult(Array.Empty<NearbyFuelStation>(), Array.Empty<string>(), message);
            }

            effectiveLatitude = coordinate.Latitude;
            effectiveLongitude = coordinate.Longitude;
            latitude = effectiveLatitude;
            longitude = effectiveLongitude;

            _logger.LogInformation("Resolved suburb/postcode '{Suburb}' to representative coordinate ({Latitude}, {Longitude}).", suburb, effectiveLatitude, effectiveLongitude);
        }

        var hasReferencePoint = effectiveLatitude.HasValue && effectiveLongitude.HasValue;

        if (hasReferencePoint)
        {
            var latValue = effectiveLatitude!.Value;
            var lonValue = effectiveLongitude!.Value;
            var latDelta = radius / 111d;
            var lonDelta = radius / (Math.Max(Math.Cos(latValue * Math.PI / 180d), 0.00001d) * 111d);

            query = query.Where(s =>
                Math.Abs(s.Latitude - latValue) <= latDelta &&
                Math.Abs(s.Longitude - lonValue) <= lonDelta);
        }

        var stations = await query.ToListAsync(cancellationToken).ConfigureAwait(false);

        var availableBrands = stations
            .Select(s => BrandNormalizer.GetCanonical(s.Brand))
            .Where(b => !string.IsNullOrWhiteSpace(b))
            .Select(b => b!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(b => b, StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (normalizedBrands.Count > 0)
        {
            _logger.LogInformation(
                "Filtering stations by brands [{Brands}].",
                string.Join(", ", normalizedBrands));

            var brandSet = new HashSet<string>(normalizedBrands, StringComparer.OrdinalIgnoreCase);
            stations = stations
                .Where(s =>
                {
                    var canonical = BrandNormalizer.GetCanonical(s.Brand);
                    if (string.IsNullOrWhiteSpace(canonical))
                    {
                        return false;
                    }

                    return brandSet.Contains(canonical);
                })
                .ToList();
        }

        if (!string.IsNullOrWhiteSpace(suburb))
        {
            _logger.LogInformation("Found {Count} stations matching suburb/postcode filter '{Suburb}'.", stations.Count, suburb);
        }
        if (stations.Count == 0)
        {
            if (string.IsNullOrWhiteSpace(message) && !string.IsNullOrWhiteSpace(suburb))
            {
                message = $"Stations within suburb/postcode '{suburb}' not found!";
            }

            _logger.LogWarning("No fuel station data matched the current filters.");
            return new NearbyStationsResult(Array.Empty<NearbyFuelStation>(), availableBrands, message);
        }

        var results = new List<NearbyFuelStation>(stations.Count);

        var referenceLatitude = effectiveLatitude;
        var referenceLongitude = effectiveLongitude;

        foreach (var station in stations)
        {
            if (hasReferencePoint && !IsValidCoordinate(station.Latitude, station.Longitude))
            {
                continue;
            }

            double? distanceKm = null;

            if (hasReferencePoint)
            {
                distanceKm = CalculateDistance(referenceLatitude!.Value, referenceLongitude!.Value, station.Latitude, station.Longitude);
                if (distanceKm > radius)
                {
                    continue;
                }
            }

            var mapped = MapToModel(station, distanceKm, normalizedFuelTypes, volumeLitres, _allowedFuelTypes);
            if (mapped is null)
            {
                continue;
            }

            results.Add(mapped);
        }

        var sortedResults = SortResults(results, sortBy, sortOrder);
        if (sortedResults.Count == 0 && string.IsNullOrWhiteSpace(message) && !string.IsNullOrWhiteSpace(suburb))
        {
            message = $"Stations within suburb/postcode '{suburb}' not found!";
        }

        return new NearbyStationsResult(sortedResults, availableBrands, message);
    }

    private static IReadOnlyCollection<string> NormalizeFuelTypes(
        IReadOnlyCollection<string>? fuelTypes,
        ISet<string> allowedFuelTypes)
    {
        if (fuelTypes is null || fuelTypes.Count == 0)
        {
            return Array.Empty<string>();
        }

        var normalized = fuelTypes
            .Where(f => !string.IsNullOrWhiteSpace(f))
            .Select(f => f.Trim().ToUpperInvariant());

        normalized = normalized.Where(allowedFuelTypes.Contains);

        return new SortedSet<string>(normalized, StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static IReadOnlyList<string> NormalizeBrands(IReadOnlyCollection<string>? brands)
    {
        if (brands is null || brands.Count == 0)
        {
            return Array.Empty<string>();
        }

        return brands
            .Select(BrandNormalizer.GetCanonical)
            .Where(b => !string.IsNullOrWhiteSpace(b))
            .Select(b => b!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(b => b, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static bool IsValidCoordinate(double latitude, double longitude) =>
        latitude is >= -90 and <= 90 && longitude is >= -180 and <= 180;

    private static NearbyFuelStation? MapToModel(
        FuelStationEntity station,
        double? distanceKm,
        IReadOnlyCollection<string> fuelTypes,
        double? volumeLitres,
        ISet<string> allowedFuelTypes)
    {
        var prices = station.Prices
            .Where(p =>
                IsAllowedFuelType(p.FuelType, allowedFuelTypes) &&
                (fuelTypes.Count == 0 || fuelTypes.Contains(p.FuelType, StringComparer.OrdinalIgnoreCase)))
            .Select(p => new StationFuelPrice
            {
                FuelType = p.FuelType,
                CentsPerLitre = p.Price,
                Unit = p.Unit,
                Description = p.Description,
                LastUpdated = p.LastUpdatedUtc,
                EstimatedCost = CalculateEstimatedCost(p.Price, volumeLitres)
            })
            .OrderBy(p => p.FuelType, StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (prices.Count == 0)
        {
            return null;
        }

        var canonicalBrand = BrandNormalizer.GetCanonical(station.Brand);
        var displayBrand = BrandNormalizer.GetDisplay(station.Brand);

        return new NearbyFuelStation
        {
            Id = station.StationCode,
            Name = station.Name ?? $"Site {station.StationCode}",
            Brand = displayBrand,
            BrandCanonical = canonicalBrand,
            BrandOriginal = station.Brand?.Trim(),
            Address = station.Address,
            Suburb = station.Suburb,
            State = station.State,
            Postcode = station.Postcode,
            Latitude = station.Latitude,
            Longitude = station.Longitude,
            DistanceKm = distanceKm.HasValue ? Math.Round(distanceKm.Value, 2) : null,
            IsOpenNow = null,
            OpeningHoursSummary = null,
            Prices = prices
        };
    }

    private static bool IsAllowedFuelType(string? fuelType, ISet<string> allowedFuelTypes)
    {
        if (string.IsNullOrWhiteSpace(fuelType))
        {
            return false;
        }

        return allowedFuelTypes.Contains(fuelType.Trim().ToUpperInvariant());
    }

    private static decimal? CalculateEstimatedCost(decimal centsPerLitre, double? volumeLitres)
    {
        if (!volumeLitres.HasValue || volumeLitres.Value <= 0)
        {
            return null;
        }

        return Math.Round(centsPerLitre * (decimal)volumeLitres.Value / 100m, 2);
    }

    private static double CalculateDistance(double latitude1, double longitude1, double latitude2, double longitude2)
    {
        const double earthRadiusKm = 6371.0;

        var lat1Radians = DegreesToRadians(latitude1);
        var lat2Radians = DegreesToRadians(latitude2);
        var deltaLat = DegreesToRadians(latitude2 - latitude1);
        var deltaLon = DegreesToRadians(longitude2 - longitude1);

        var a = Math.Sin(deltaLat / 2) * Math.Sin(deltaLat / 2) +
                Math.Cos(lat1Radians) * Math.Cos(lat2Radians) *
                Math.Sin(deltaLon / 2) * Math.Sin(deltaLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return earthRadiusKm * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180d;

    private static IReadOnlyList<NearbyFuelStation> SortResults(
        List<NearbyFuelStation> results,
        string? sortBy,
        string? sortOrder)
    {
        var comparer = StringComparer.OrdinalIgnoreCase;
        var isDescending = string.Equals(sortOrder, "desc", StringComparison.OrdinalIgnoreCase);

        return sortBy?.ToLowerInvariant() switch
        {
            "distance" => (isDescending
                ? results.OrderByDescending(s => s.DistanceKm ?? double.MaxValue)
                : results.OrderBy(s => s.DistanceKm ?? double.MaxValue))
                .ThenBy(s => s.Name, comparer)
                .ToList(),
            "price" => (isDescending
                ? results.OrderByDescending(s => GetCheapestPriceOrNull(s) ?? decimal.MinValue)
                : results.OrderBy(s => GetCheapestPriceOrNull(s) ?? decimal.MaxValue))
                .ThenBy(s => s.Name, comparer)
                .ToList(),
            _ => results
                .OrderBy(s => s.DistanceKm ?? double.MaxValue)
                .ThenBy(s => s.Name, comparer)
                .ToList()
        };
    }

    private static decimal? GetCheapestPriceOrNull(NearbyFuelStation station) =>
        station.Prices.Count == 0 ? null : station.Prices.Min(p => p.CentsPerLitre);

}
