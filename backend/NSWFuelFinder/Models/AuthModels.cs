namespace NSWFuelFinder.Models;

public sealed record RegisterRequest(string Email, string Password);

public sealed record LoginRequest(string Email, string Password);

public sealed record AuthTokenResponse(
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAt,
    Guid RefreshTokenId,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt);

public sealed record RefreshTokenRequest(Guid RefreshTokenId, string RefreshToken);

public sealed record LogoutRequest(Guid RefreshTokenId);

public sealed record UserPreferencesResponse(
    string? DefaultSuburb,
    double? DefaultRadiusKm,
    IReadOnlyCollection<string> PreferredFuelTypes);

public sealed record UpdatePreferencesRequest(
    string? DefaultSuburb,
    double? DefaultRadiusKm,
    IReadOnlyCollection<string>? PreferredFuelTypes);

public sealed record FuelPriceTrendResponse(
    string FuelType,
    IReadOnlyList<FuelPriceTrendPoint> Points);

public sealed record FuelPriceTrendPoint(
    DateTimeOffset RecordedAt,
    decimal CentsPerLitre);
