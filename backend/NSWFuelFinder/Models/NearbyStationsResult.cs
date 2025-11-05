namespace NSWFuelFinder.Models;

public sealed class NearbyStationsResult
{
    public NearbyStationsResult(
        IReadOnlyList<NearbyFuelStation> stations,
        IReadOnlyList<string> availableBrands,
        string? message = null)
    {
        Stations = stations ?? Array.Empty<NearbyFuelStation>();
        AvailableBrands = availableBrands ?? Array.Empty<string>();
        Message = string.IsNullOrWhiteSpace(message) ? null : message;
    }

    public IReadOnlyList<NearbyFuelStation> Stations { get; }

    public IReadOnlyList<string> AvailableBrands { get; }

    public string? Message { get; }
}
