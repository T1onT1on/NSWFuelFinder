//Services/SuburbCoordinateResolver.cs

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NSWFuelFinder.Data;

namespace NSWFuelFinder.Services;

public interface ISuburbCoordinateResolver
{
    Task<RepresentativeCoordinateResult?> ResolveAsync(string? input, CancellationToken cancellationToken = default);
}

public sealed record RepresentativeCoordinateResult(string Postcode, double Latitude, double Longitude);

public sealed class SuburbCoordinateResolver : ISuburbCoordinateResolver
{
    private const string CoordinateCacheKey = "RepresentativeCoordinates:All";

    private readonly FuelFinderDbContext _dbContext;
    private readonly IMemoryCache _memoryCache;

    public SuburbCoordinateResolver(FuelFinderDbContext dbContext, IMemoryCache memoryCache)
    {
        _dbContext = dbContext;
        _memoryCache = memoryCache;
    }

    public async Task<RepresentativeCoordinateResult?> ResolveAsync(string? input, CancellationToken cancellationToken = default)
    {
        var trimmed = input?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return null;
        }

        if (IsPostcode(trimmed))
        {
            return await ResolveByPostcodeAsync(trimmed, cancellationToken).ConfigureAwait(false);
        }

        return await ResolveBySuburbAsync(trimmed, cancellationToken).ConfigureAwait(false);
    }

    private async Task<RepresentativeCoordinateResult?> ResolveByPostcodeAsync(string postcode, CancellationToken cancellationToken)
    {
        var coordinates = await GetCoordinateMapAsync(cancellationToken).ConfigureAwait(false);
        return coordinates.TryGetValue(postcode, out var entity)
            ? new RepresentativeCoordinateResult(entity.Postcode, entity.Latitude, entity.Longitude)
            : null;
    }

    private async Task<RepresentativeCoordinateResult?> ResolveBySuburbAsync(string suburb, CancellationToken cancellationToken)
    {
        var coordinates = await GetCoordinateMapAsync(cancellationToken).ConfigureAwait(false);
        if (coordinates.Count == 0)
        {
            return null;
        }

        var likePattern = $"%{suburb}%";

        var candidates = await _dbContext.Stations
            .AsNoTracking()
            .Where(s => s.Suburb != null && EF.Functions.ILike(s.Suburb!, likePattern))
            .Select(s => new { Suburb = s.Suburb!, Postcode = s.Postcode })
            .Where(x => !string.IsNullOrWhiteSpace(x.Postcode))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        if (candidates.Count == 0)
        {
            return null;
        }

        foreach (var candidate in candidates.Where(c => string.Equals(c.Suburb.Trim(), suburb, StringComparison.OrdinalIgnoreCase)))
        {
            var postcode = candidate.Postcode!.Trim();
            if (coordinates.TryGetValue(postcode, out var entity))
            {
                return new RepresentativeCoordinateResult(entity.Postcode, entity.Latitude, entity.Longitude);
            }
        }

        foreach (var candidate in candidates)
        {
            var postcode = candidate.Postcode!.Trim();
            if (coordinates.TryGetValue(postcode, out var entity))
            {
                return new RepresentativeCoordinateResult(entity.Postcode, entity.Latitude, entity.Longitude);
            }
        }

        return null;
    }

    private async Task<Dictionary<string, RepresentativeCoordinateEntity>> GetCoordinateMapAsync(CancellationToken cancellationToken)
    {
        if (_memoryCache.TryGetValue(CoordinateCacheKey, out Dictionary<string, RepresentativeCoordinateEntity>? cached) && cached is not null)
        {
            return cached;
        }

        var data = await _dbContext.RepresentativeCoordinates
            .AsNoTracking()
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var map = new Dictionary<string, RepresentativeCoordinateEntity>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in data)
        {
            if (!string.IsNullOrWhiteSpace(item.Postcode))
            {
                map[item.Postcode.Trim()] = item;
            }
        }

        _memoryCache.Set(CoordinateCacheKey, map, TimeSpan.FromMinutes(30));
        return map;
    }

    private static bool IsPostcode(string value) =>
        value.Length == 4 && value.All(char.IsDigit);
}
