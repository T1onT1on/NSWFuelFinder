namespace NSWFuelFinder.Data;

public sealed class UserPreferenceEntity
{
    public string UserId { get; set; } = string.Empty;

    public string? DefaultSuburb { get; set; }

    public double? DefaultRadiusKm { get; set; }

    /// <summary>
    /// Comma-separated list of preferred fuel types.
    /// </summary>
    public string? PreferredFuelTypes { get; set; }

    public DateTimeOffset UpdatedAtUtc { get; set; }
}
