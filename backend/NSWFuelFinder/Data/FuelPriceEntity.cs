namespace NSWFuelFinder.Data;

public sealed class FuelPriceEntity
{
    public string StationCode { get; set; } = string.Empty;

    public string FuelType { get; set; } = string.Empty;

    /// <summary>
    /// Price in cents per litre.
    /// </summary>
    public decimal Price { get; set; }

    public string? Unit { get; set; }

    public string? Description { get; set; }

    public DateTimeOffset? LastUpdatedUtc { get; set; }

    public FuelStationEntity? Station { get; set; }
}
