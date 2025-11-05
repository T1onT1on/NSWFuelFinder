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

    public string? DisplayName { get; set; }

    public string? AvatarDataUrl { get; set; }

    public bool OverviewFilterEnabled { get; set; }

    public bool OverviewFilterSelectAll { get; set; }

    /// <summary>
    /// Comma-separated list of overview filter fuel types (uppercase).
    /// </summary>
    public string? OverviewFilterFuelTypes { get; set; }

    /// <summary>
    /// Comma-separated list of overview filter brand names.
    /// </summary>
    public string? OverviewFilterBrandNames { get; set; }

    public double? OverviewFilterRadiusKm { get; set; }

    public DateTimeOffset UpdatedAtUtc { get; set; }
}
