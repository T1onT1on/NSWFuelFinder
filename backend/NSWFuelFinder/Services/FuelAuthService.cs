using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.WebUtilities;
using NSWFuelFinder.Options;

namespace NSWFuelFinder.Services;

public interface IFuelAuthService
{
    Task<string?> GetAccessTokenAsync(CancellationToken cancellationToken);
}

public sealed class FuelAuthService : IFuelAuthService, IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly FuelApiOptions _options;
    private readonly ILogger<FuelAuthService> _logger;
    private readonly SemaphoreSlim _tokenLock = new(1, 1);
    private readonly JsonSerializerOptions _serializerOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private AccessTokenState? _cachedToken;
    private bool _disposed;

    public FuelAuthService(
        HttpClient httpClient,
        IOptions<FuelApiOptions> options,
        ILogger<FuelAuthService> logger)
    {
        ArgumentNullException.ThrowIfNull(options);

        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;

        if (_httpClient.BaseAddress is null && !string.IsNullOrWhiteSpace(_options.BaseUrl))
        {
            _httpClient.BaseAddress = new Uri(_options.BaseUrl, UriKind.Absolute);
        }
    }

    public async Task<string?> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        if (TryGetCachedToken(out var token))
        {
            return token;
        }

        await _tokenLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (TryGetCachedToken(out token))
            {
                return token;
            }

            if (!string.IsNullOrWhiteSpace(_options.Authorization))
            {
                token = ExtractBearerToken(_options.Authorization);
                if (!string.IsNullOrWhiteSpace(token))
                {
                    _cachedToken = new AccessTokenState(token, DateTimeOffset.MaxValue);
                    return token;
                }
            }

            if (string.IsNullOrWhiteSpace(_options.ApiKey) || string.IsNullOrWhiteSpace(_options.ApiSecret))
            {
                throw new InvalidOperationException("NswFuelApi:ApiKey and NswFuelApi:ApiSecret must be configured when Authorization is not supplied.");
            }

            var tokenPath = QueryHelpers.AddQueryString(
                _options.TokenPath,
                new Dictionary<string, string?>
                {
                    ["grant_type"] = _options.GrantType ?? "client_credentials"
                });

            var request = new HttpRequestMessage(HttpMethod.Get, tokenPath);

            var basicHeader = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_options.ApiKey}:{_options.ApiSecret}"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", basicHeader);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            using var response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                _logger.LogError("Failed to acquire NSW Fuel API access token. StatusCode: {StatusCode}. Body: {Body}", response.StatusCode, body);
                response.EnsureSuccessStatusCode();
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
            AccessTokenResponse? tokenResponse;
            try
            {
                tokenResponse = await JsonSerializer.DeserializeAsync<AccessTokenResponse>(stream, _serializerOptions, cancellationToken).ConfigureAwait(false);
            }
            catch (JsonException jsonEx)
            {
                var raw = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                _logger.LogError(jsonEx, "Failed to parse NSW Fuel API access token response: {RawResponse}", raw);
                throw;
            }
            if (tokenResponse is null || string.IsNullOrWhiteSpace(tokenResponse.AccessToken))
            {
                throw new InvalidOperationException("NSW Fuel API returned an empty access token response.");
            }

            var expiresIn = ParseExpiresIn(tokenResponse.ExpiresInRaw);
            var expiry = DateTimeOffset.UtcNow.AddSeconds(expiresIn).AddSeconds(-60);
            _cachedToken = new AccessTokenState(tokenResponse.AccessToken, expiry);
            return tokenResponse.AccessToken;
        }
        finally
        {
            _tokenLock.Release();
        }
    }

    private bool TryGetCachedToken(out string? token)
    {
        if (_cachedToken is { IsValid: true })
        {
            token = _cachedToken.Token;
            return true;
        }

        token = null;
        return false;
    }

    private static string? ExtractBearerToken(string authorizationHeader)
    {
        if (string.IsNullOrWhiteSpace(authorizationHeader))
        {
            return null;
        }

        var parts = authorizationHeader.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length == 2 && parts[0].Equals("Bearer", StringComparison.OrdinalIgnoreCase)
            ? parts[1]
            : authorizationHeader;
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _tokenLock.Dispose();
        _disposed = true;
    }

    private sealed record AccessTokenResponse
    {
        [JsonPropertyName("access_token")]
        public string? AccessToken { get; init; }

        [JsonPropertyName("token_type")]
        public string? TokenType { get; init; }

        [JsonPropertyName("expires_in")]
        public string? ExpiresInRaw { get; init; }
    }

    private sealed record AccessTokenState(string Token, DateTimeOffset ExpiresAt)
    {
        public bool IsValid => DateTimeOffset.UtcNow < ExpiresAt;
    }

    private static int ParseExpiresIn(string? expiresInRaw)
    {
        if (!string.IsNullOrWhiteSpace(expiresInRaw) &&
            int.TryParse(expiresInRaw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) &&
            value > 0)
        {
            return value;
        }

        return 300;
    }
}
