namespace NSWFuelFinder.Models;

public sealed class NearbyStationsResult
{
    public NearbyStationsResult(
        IReadOnlyList<NearbyFuelStation> stations,
        IReadOnlyList<string> availableBrands)
    {
        Stations = stations ?? Array.Empty<NearbyFuelStation>();
        AvailableBrands = availableBrands ?? Array.Empty<string>();
    }

    public IReadOnlyList<NearbyFuelStation> Stations { get; }

    public IReadOnlyList<string> AvailableBrands { get; }
}
