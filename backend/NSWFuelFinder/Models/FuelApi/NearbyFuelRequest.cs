using System.Text.Json.Serialization;

namespace NSWFuelFinder.Models.FuelApi;

internal sealed class NearbyFuelRequest
{
    [JsonPropertyName("fueltype")]
    public string? FuelType { get; init; }

    [JsonPropertyName("brand")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<string>? Brands { get; init; }

    [JsonPropertyName("namedlocation")]
    public string? NamedLocation { get; init; }

    [JsonPropertyName("latitude")]
    public string? Latitude { get; init; }

    [JsonPropertyName("longitude")]
    public string? Longitude { get; init; }

    [JsonPropertyName("radius")]
    public string? Radius { get; init; }

    [JsonPropertyName("sortby")]
    public string? SortBy { get; init; }

    [JsonPropertyName("sortascending")]
    public string? SortAscending { get; init; }
}
