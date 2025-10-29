using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Net.Http.Headers;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSWFuelFinder.Models.FuelApi;
using NSWFuelFinder.Options;

namespace NSWFuelFinder.Services;

public interface IFuelApiClient
{
    Task<NearbyFuelResponse> GetNearbyStationsAsync(
        double latitude,
        double longitude,
        double radiusKm,
        string? fuelType,
        CancellationToken cancellationToken);

    Task<NearbyFuelResponse> GetAllPricesAsync(CancellationToken cancellationToken);
}

public sealed class FuelApiClient : IFuelApiClient
{
    private readonly HttpClient _httpClient;
    private readonly IFuelAuthService _authService;
    private readonly FuelApiOptions _options;
    private readonly ILogger<FuelApiClient> _logger;
    private readonly JsonSerializerOptions _serializerOptions;

    public FuelApiClient(
        HttpClient httpClient,
        IFuelAuthService authService,
        IOptions<FuelApiOptions> options,
        ILogger<FuelApiClient> logger)
    {
        ArgumentNullException.ThrowIfNull(options);

        _httpClient = httpClient;
        _authService = authService;
        _options = options.Value;
        _logger = logger;

        ConfigureHttpClient(_httpClient, _options);

        _serializerOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
    }

    public async Task<NearbyFuelResponse> GetNearbyStationsAsync(
        double latitude,
        double longitude,
        double radiusKm,
        string? fuelType,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            throw new InvalidOperationException("NswFuelApi:ApiKey must be configured.");
        }

        var request = new HttpRequestMessage(HttpMethod.Post, _options.NearbyPath);

        if (!string.IsNullOrWhiteSpace(fuelType))
        {
            fuelType = fuelType.Trim();
        }

        var requestPayload = new NearbyFuelRequest
        {
            FuelType = string.IsNullOrWhiteSpace(fuelType) ? null : fuelType,
            Latitude = latitude.ToString(CultureInfo.InvariantCulture),
            Longitude = longitude.ToString(CultureInfo.InvariantCulture),
            Radius = radiusKm > 0 ? radiusKm.ToString(CultureInfo.InvariantCulture) : null,
            SortBy = "distance",
            SortAscending = "true"
        };

        var json = JsonSerializer.Serialize(requestPayload, _serializerOptions);
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        request.Headers.TryAddWithoutValidation("apikey", _options.ApiKey);
        request.Headers.TryAddWithoutValidation("transactionid", Guid.NewGuid().ToString());
        request.Headers.TryAddWithoutValidation("requesttimestamp", DateTime.UtcNow.ToString("dd/MM/yyyy hh:mm:ss tt", CultureInfo.InvariantCulture));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var bearerToken = await _authService.GetAccessTokenAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(bearerToken))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken);
        }

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError(
                "NSW Fuel API returned {StatusCode} for {RequestUri}. Body: {Body}",
                response.StatusCode,
                request.RequestUri,
                body);
            response.EnsureSuccessStatusCode();
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        var responsePayload = await JsonSerializer.DeserializeAsync<NearbyFuelResponse>(stream, _serializerOptions, cancellationToken);
        return responsePayload ?? new NearbyFuelResponse();
    }

    public async Task<NearbyFuelResponse> GetAllPricesAsync(CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            throw new InvalidOperationException("NswFuelApi:ApiKey must be configured.");
        }

        var request = new HttpRequestMessage(HttpMethod.Get, _options.AllPricesPath);
        request.Headers.TryAddWithoutValidation("apikey", _options.ApiKey);
        request.Headers.TryAddWithoutValidation("transactionid", Guid.NewGuid().ToString());
        request.Headers.TryAddWithoutValidation("requesttimestamp", DateTime.UtcNow.ToString("dd/MM/yyyy hh:mm:ss tt", CultureInfo.InvariantCulture));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var bearerToken = await _authService.GetAccessTokenAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(bearerToken))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken);
        }

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError(
                "NSW Fuel API returned {StatusCode} for {RequestUri}. Body: {Body}",
                response.StatusCode,
                request.RequestUri,
                body);
            response.EnsureSuccessStatusCode();
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        var responsePayload = await JsonSerializer.DeserializeAsync<NearbyFuelResponse>(stream, _serializerOptions, cancellationToken);
        return responsePayload ?? new NearbyFuelResponse();
    }

    private static void ConfigureHttpClient(HttpClient httpClient, FuelApiOptions options)
    {
        if (httpClient.BaseAddress is null && !string.IsNullOrWhiteSpace(options.BaseUrl))
        {
            httpClient.BaseAddress = new Uri(options.BaseUrl, UriKind.Absolute);
        }
        httpClient.DefaultRequestHeaders.Accept.Clear();
    }
}
