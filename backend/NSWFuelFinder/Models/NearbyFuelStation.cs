namespace NSWFuelFinder.Models;

public sealed class NearbyFuelStation
{
    public string Id { get; init; } = string.Empty;

    public string Name { get; init; } = string.Empty;

    public string? Brand { get; init; }

    public string? BrandCanonical { get; init; }

    public string? BrandOriginal { get; init; }

    public string? Address { get; init; }

    public string? Suburb { get; init; }

    public string? State { get; init; }

    public string? Postcode { get; init; }

    public double Latitude { get; init; }

    public double Longitude { get; init; }

    /// <summary>
    /// Distance in kilometres if supplied by the upstream API.
    /// </summary>
    public double? DistanceKm { get; init; }

    public bool? IsOpenNow { get; init; }

    public string? OpeningHoursSummary { get; init; }

    public IReadOnlyList<StationFuelPrice> Prices { get; init; } = Array.Empty<StationFuelPrice>();
}

public sealed class StationFuelPrice
{
    public string FuelType { get; init; } = string.Empty;

    /// <summary>
    /// Price in cents per litre, as reported by the NSW Fuel API.
    /// </summary>
    public decimal CentsPerLitre { get; init; }

    public string? Unit { get; init; }

    public string? Description { get; init; }

    public DateTimeOffset? LastUpdated { get; init; }

    /// <summary>
    /// Expected total cost in dollars for the requested volume (if provided).
    /// </summary>
    public decimal? EstimatedCost { get; init; }
}
