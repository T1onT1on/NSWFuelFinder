namespace NSWFuelFinder.Options;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; init; } = "NSWFuelFinder";

    public string Audience { get; init; } = "NSWFuelFinder";

    public string SigningKey { get; init; } = string.Empty;

    public int ExpiresMinutes { get; init; } = 120;

    public int RefreshTokenExpiresDays { get; init; } = 7;
}
