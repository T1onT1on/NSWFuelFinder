namespace NSWFuelFinder.Data;

public sealed class FuelPriceHistoryEntity
{
    public long Id { get; set; }

    public string StationCode { get; set; } = string.Empty;

    public string FuelType { get; set; } = string.Empty;

    public decimal Price { get; set; }

    public DateTimeOffset RecordedAtUtc { get; set; }
}
