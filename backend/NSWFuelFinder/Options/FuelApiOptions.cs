using System.ComponentModel.DataAnnotations;

namespace NSWFuelFinder.Options;

/// <summary>
/// Configuration values required to access the NSW Fuel API.
/// </summary>
public sealed class FuelApiOptions
{
    public const string SectionName = "NswFuelApi";

    [Required]
    [Url]
    public string BaseUrl { get; init; } = "https://api.onegov.nsw.gov.au";

    /// <summary>
    /// Relative path for the nearby prices endpoint (e.g. fuel/v1/prices/nearby).
    /// </summary>
    [Required]
    public string NearbyPath { get; init; } = "FuelPriceCheck/v1/fuel/prices/nearby";

    /// <summary>
    /// Relative path for the full dataset endpoint that returns all fuel prices.
    /// </summary>
    [Required]
    public string AllPricesPath { get; init; } = "FuelPriceCheck/v1/fuel/prices";

    /// <summary>
    /// Relative path to retrieve OAuth2 client credentials access tokens.
    /// </summary>
    public string TokenPath { get; init; } = "oauth/client_credential/accesstoken";

    /// <summary>
    /// Grant type to request when fetching access tokens. Defaults to client credentials.
    /// </summary>
    public string GrantType { get; init; } = "client_credentials";

    /// <summary>
    /// NSW API subscription key that must be sent via the <c>apikey</c> header.
    /// </summary>
    public string? ApiKey { get; init; }

    /// <summary>
    /// Client secret used for OAuth2 token retrieval alongside <see cref="ApiKey"/>.
    /// </summary>
    public string? ApiSecret { get; init; }

    /// <summary>
    /// Optional pre-computed Authorization header value (e.g. <c>Bearer eyJ...</c>). When set this takes precedence over ApiSecret.
    /// </summary>
    public string? Authorization { get; init; }
}
