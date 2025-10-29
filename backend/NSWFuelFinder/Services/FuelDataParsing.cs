using System.Globalization;

namespace NSWFuelFinder.Services;

internal static class FuelDataParsing
{
    private static readonly string[] SupportedDateFormats =
    {
        "dd/MM/yyyy hh:mm:ss tt",
        "d/M/yyyy hh:mm:ss tt",
        "dd/MM/yyyy HH:mm:ss",
        "yyyy-MM-dd'T'HH:mm:ssK",
        "yyyy-MM-dd'T'HH:mm:ss.fffK",
        "yyyy-MM-dd HH:mm:ss",
        "yyyy-MM-dd HH:mm:ss.fff"
    };

    public static DateTimeOffset? ParseDateTimeOffset(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        value = value.Trim();

        if (DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dto))
        {
            return dto.ToUniversalTime();
        }

        foreach (var format in SupportedDateFormats)
        {
            if (DateTimeOffset.TryParseExact(value, format, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out dto))
            {
                return dto.ToUniversalTime();
            }

            if (DateTime.TryParseExact(value, format, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dt))
            {
                return new DateTimeOffset(dt).ToUniversalTime();
            }
        }

        return null;
    }
}
