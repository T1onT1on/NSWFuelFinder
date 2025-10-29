namespace NSWFuelFinder.Options;

public sealed class GoogleAuthOptions
{
    public const string SectionName = "GoogleAuth";

    public string ClientId { get; init; } = string.Empty;

    public string ClientSecret { get; init; } = string.Empty;

    public string CallbackPath { get; init; } = "/api/auth/google/callback";
}
