namespace NSWFuelFinder.Data;

public sealed class RepresentativeCoordinateEntity
{
    public string Postcode { get; set; } = string.Empty;

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    public string? Label { get; set; }

    public bool Manual { get; set; }
}
