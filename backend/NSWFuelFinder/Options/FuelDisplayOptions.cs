namespace NSWFuelFinder.Options;

public sealed class FuelDisplayOptions
{
    public const string SectionName = "FuelDisplay";

    public string[] AllowedFuelTypes { get; init; } =
    [
        "E10",
        "U91",
        "P95",
        "P98",
        "DL",
        "PDL"
    ];
}
