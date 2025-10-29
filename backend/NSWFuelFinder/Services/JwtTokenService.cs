using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Cryptography.KeyDerivation;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.EntityFrameworkCore;
using NSWFuelFinder.Options;
using NSWFuelFinder.Data;
using NSWFuelFinder.Models;

namespace NSWFuelFinder.Services;

public interface ITokenService
{
    Task<AuthTokenResponse> GenerateTokenPairAsync(IdentityUser user, string? ipAddress, CancellationToken cancellationToken);

    Task<AuthTokenResponse?> RefreshTokenAsync(RefreshTokenRequest request, string? ipAddress, CancellationToken cancellationToken);

    Task RevokeRefreshTokenAsync(LogoutRequest request, string? ipAddress, CancellationToken cancellationToken);
}

public sealed class JwtTokenService : ITokenService
{
    private readonly JwtOptions _options;
    private readonly UserManager<IdentityUser> _userManager;
    private readonly FuelFinderDbContext _dbContext;
    private readonly byte[] _signingKeyBytes;

    public JwtTokenService(
        IOptions<JwtOptions> options,
        UserManager<IdentityUser> userManager,
        FuelFinderDbContext dbContext)
    {
        _options = options.Value;
        _userManager = userManager;
        _dbContext = dbContext;
        _signingKeyBytes = Encoding.UTF8.GetBytes(_options.SigningKey);
        if (_signingKeyBytes.Length < 32)
        {
            throw new InvalidOperationException("Jwt:SigningKey must be at least 32 bytes.");
        }
    }

    public async Task<AuthTokenResponse> GenerateTokenPairAsync(IdentityUser user, string? ipAddress, CancellationToken cancellationToken)
    {
        var accessToken = await GenerateAccessTokenAsync(user);
        var accessTokenExpiresAt = DateTimeOffset.UtcNow.AddMinutes(_options.ExpiresMinutes);

        var refreshTokenResult = CreateRefreshToken(user.Id, ipAddress);

        _dbContext.RefreshTokens.Add(refreshTokenResult.Entity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new AuthTokenResponse(
            accessToken,
            accessTokenExpiresAt,
            refreshTokenResult.Entity.Id,
            refreshTokenResult.PlainToken,
            refreshTokenResult.Entity.ExpiresAtUtc);
    }

    public async Task<AuthTokenResponse?> RefreshTokenAsync(RefreshTokenRequest request, string? ipAddress, CancellationToken cancellationToken)
    {
        var tokenEntity = await _dbContext.RefreshTokens
            .AsTracking()
            .FirstOrDefaultAsync(t => t.Id == request.RefreshTokenId, cancellationToken)
            .ConfigureAwait(false);

        if (tokenEntity is null || tokenEntity.RevokedAtUtc.HasValue || tokenEntity.ExpiresAtUtc <= DateTimeOffset.UtcNow)
        {
            return null;
        }

        if (!ValidateRefreshToken(request.RefreshToken, tokenEntity.TokenHash, tokenEntity.TokenSalt))
        {
            return null;
        }

        var user = await _userManager.FindByIdAsync(tokenEntity.UserId);
        if (user is null)
        {
            return null;
        }

        tokenEntity.RevokedAtUtc = DateTimeOffset.UtcNow;
        tokenEntity.RevokedByIp = ipAddress;

        var newTokens = CreateRefreshToken(user.Id, ipAddress);
        _dbContext.RefreshTokens.Add(newTokens.Entity);

        await _dbContext.SaveChangesAsync(cancellationToken);

        var accessToken = await GenerateAccessTokenAsync(user);
        var accessTokenExpiresAt = DateTimeOffset.UtcNow.AddMinutes(_options.ExpiresMinutes);

        return new AuthTokenResponse(
            accessToken,
            accessTokenExpiresAt,
            newTokens.Entity.Id,
            newTokens.PlainToken,
            newTokens.Entity.ExpiresAtUtc);
    }

    public async Task RevokeRefreshTokenAsync(LogoutRequest request, string? ipAddress, CancellationToken cancellationToken)
    {
        var tokenEntity = await _dbContext.RefreshTokens
            .AsTracking()
            .FirstOrDefaultAsync(t => t.Id == request.RefreshTokenId, cancellationToken)
            .ConfigureAwait(false);

        if (tokenEntity is null || tokenEntity.RevokedAtUtc.HasValue)
        {
            return;
        }

        tokenEntity.RevokedAtUtc = DateTimeOffset.UtcNow;
        tokenEntity.RevokedByIp = ipAddress;
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<string> GenerateAccessTokenAsync(IdentityUser user)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? user.UserName ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        if (_userManager.SupportsUserClaim)
        {
            var userClaims = await _userManager.GetClaimsAsync(user);
            claims.AddRange(userClaims);
        }

        if (_userManager.SupportsUserRole)
        {
            var roles = await _userManager.GetRolesAsync(user);
            claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));
        }

        var credentials = new SigningCredentials(new SymmetricSecurityKey(_signingKeyBytes), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_options.ExpiresMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private (RefreshTokenEntity Entity, string PlainToken) CreateRefreshToken(string userId, string? ipAddress)
    {
        var plainToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        var saltBytes = RandomNumberGenerator.GetBytes(16);
        var hashBytes = KeyDerivation.Pbkdf2(
            plainToken,
            saltBytes,
            KeyDerivationPrf.HMACSHA256,
            iterationCount: 100_000,
            numBytesRequested: 32);

        var entity = new RefreshTokenEntity
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = Convert.ToBase64String(hashBytes),
            TokenSalt = Convert.ToBase64String(saltBytes),
            CreatedAtUtc = DateTimeOffset.UtcNow,
            ExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(_options.RefreshTokenExpiresDays),
            CreatedByIp = ipAddress
        };

        return (entity, plainToken);
    }

    private static bool ValidateRefreshToken(string refreshToken, string storedHash, string storedSalt)
    {
        if (string.IsNullOrWhiteSpace(refreshToken) || string.IsNullOrWhiteSpace(storedHash) || string.IsNullOrWhiteSpace(storedSalt))
        {
            return false;
        }

        var saltBytes = Convert.FromBase64String(storedSalt);
        var storedHashBytes = Convert.FromBase64String(storedHash);

        var computedHash = KeyDerivation.Pbkdf2(
            refreshToken,
            saltBytes,
            KeyDerivationPrf.HMACSHA256,
            iterationCount: 100_000,
            numBytesRequested: 32);

        return CryptographicOperations.FixedTimeEquals(computedHash, storedHashBytes);
    }
}
