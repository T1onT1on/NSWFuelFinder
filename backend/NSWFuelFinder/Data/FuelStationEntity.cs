namespace NSWFuelFinder.Data;

public sealed class FuelStationEntity
{
    public string StationCode { get; set; } = string.Empty;

    public string? StationId { get; set; }

    public string? BrandId { get; set; }

    public string? Brand { get; set; }

    public string? Name { get; set; }

    public string? Address { get; set; }

    public string? Suburb { get; set; }

    public string? State { get; set; }

    public string? Postcode { get; set; }

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    public bool IsAdBlueAvailable { get; set; }

    public DateTimeOffset SyncedAtUtc { get; set; }

    public ICollection<FuelPriceEntity> Prices { get; set; } = new List<FuelPriceEntity>();
}
