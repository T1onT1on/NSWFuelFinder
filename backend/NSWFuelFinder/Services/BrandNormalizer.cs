using System.Globalization;

namespace NSWFuelFinder.Services;

internal static class BrandNormalizer
{
    private static readonly Dictionary<string, string> AliasToCanonical = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Shell"] = "Shell",
        ["Coles Express"] = "Shell",
        ["Reddy Express"] = "Shell",

        ["Ampol"] = "Ampol",
        ["Ampol Foodary"] = "Ampol",
        ["EG Ampol"] = "Ampol",
        ["Caltex"] = "Ampol",
    };

    public static string? GetCanonical(string? brand)
    {
        if (string.IsNullOrWhiteSpace(brand))
        {
            return null;
        }

        var trimmed = brand.Trim();
        if (AliasToCanonical.TryGetValue(trimmed, out var mapped))
        {
            return mapped;
        }

        return ToTitleCase(trimmed);
    }

    public static string? GetDisplay(string? brand)
    {
        var canonical = GetCanonical(brand);
        if (string.IsNullOrWhiteSpace(brand))
        {
            return canonical;
        }

        var trimmed = brand.Trim();
        if (string.IsNullOrWhiteSpace(canonical))
        {
            return trimmed;
        }

        return string.Equals(canonical, trimmed, StringComparison.OrdinalIgnoreCase)
            ? canonical
            : $"{canonical} ({trimmed})";
    }

    private static string ToTitleCase(string value) =>
        CultureInfo.InvariantCulture.TextInfo.ToTitleCase(value.ToLowerInvariant());
}
