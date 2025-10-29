using System.Text.Json.Serialization;

namespace NSWFuelFinder.Models.FuelApi;

public sealed class NearbyFuelResponse
{
    [JsonPropertyName("stations")]
    public List<FuelStationPayload> Stations { get; init; } = new();

    [JsonPropertyName("prices")]
    public List<FuelPricePayload> Prices { get; init; } = new();
}

public sealed class FuelStationPayload
{
    [JsonPropertyName("stationid")]
    public string? StationId { get; init; }

    [JsonPropertyName("brandid")]
    public string? BrandId { get; init; }

    [JsonPropertyName("code")]
    public string Code { get; init; } = string.Empty;

    [JsonPropertyName("brand")]
    public string? Brand { get; init; }

    [JsonPropertyName("name")]
    public string? Name { get; init; }

    [JsonPropertyName("address")]
    public string? Address { get; init; }

    [JsonPropertyName("location")]
    public FuelStationLocationPayload? Location { get; init; }

    [JsonPropertyName("suburb")]
    public string? Suburb { get; init; }

    [JsonPropertyName("state")]
    public string? State { get; init; }

    [JsonPropertyName("postcode")]
    public string? Postcode { get; init; }

    [JsonPropertyName("tradinghours")]
    public List<TradingHourPayload>? TradingHours { get; init; }

    [JsonPropertyName("isAdBlueAvailable")]
    public bool? IsAdBlueAvailable { get; init; }
}

public sealed class FuelStationLocationPayload
{
    [JsonPropertyName("latitude")]
    public double? Latitude { get; init; }

    [JsonPropertyName("longitude")]
    public double? Longitude { get; init; }

    [JsonPropertyName("distance")]
    public double? Distance { get; init; }
}

public sealed class TradingHourPayload
{
    [JsonPropertyName("day")]
    public string? Day { get; init; }

    [JsonPropertyName("openTime")]
    public string? OpenTime { get; init; }

    [JsonPropertyName("closeTime")]
    public string? CloseTime { get; init; }

    [JsonPropertyName("type")]
    public string? Type { get; init; }

    [JsonPropertyName("open24hours")]
    public bool? Open24Hours { get; init; }
}

public sealed class FuelPricePayload
{
    [JsonPropertyName("stationcode")]
    public string StationCode { get; init; } = string.Empty;

    [JsonPropertyName("fueltype")]
    public string? FuelType { get; init; }

    [JsonPropertyName("price")]
    public decimal Price { get; init; }

    [JsonPropertyName("priceunit")]
    public string? PriceUnit { get; init; }

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("priceupdated")]
    public string? PriceUpdatedRaw { get; init; }

    [JsonPropertyName("lastupdated")]
    public string? LastUpdatedRaw { get; init; }
}
