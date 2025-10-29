using System.ComponentModel.DataAnnotations;

namespace NSWFuelFinder.Data;

public sealed class RefreshTokenEntity
{
    public Guid Id { get; set; }

    [MaxLength(450)]
    public string UserId { get; set; } = string.Empty;

    [MaxLength(256)]
    public string TokenHash { get; set; } = string.Empty;

    [MaxLength(128)]
    public string TokenSalt { get; set; } = string.Empty;

    public DateTimeOffset ExpiresAtUtc { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? RevokedAtUtc { get; set; }

    [MaxLength(64)]
    public string? CreatedByIp { get; set; }

    [MaxLength(64)]
    public string? RevokedByIp { get; set; }
}
