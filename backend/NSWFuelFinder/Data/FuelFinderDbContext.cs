using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace NSWFuelFinder.Data;

public sealed class FuelFinderDbContext : IdentityDbContext<IdentityUser>
{
    public FuelFinderDbContext(DbContextOptions<FuelFinderDbContext> options)
        : base(options)
    {
    }

    public DbSet<FuelStationEntity> Stations => Set<FuelStationEntity>();

    public DbSet<FuelPriceEntity> Prices => Set<FuelPriceEntity>();

    public DbSet<UserPreferenceEntity> Preferences => Set<UserPreferenceEntity>();

    public DbSet<FuelPriceHistoryEntity> PriceHistory => Set<FuelPriceHistoryEntity>();

    public DbSet<RefreshTokenEntity> RefreshTokens => Set<RefreshTokenEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<FuelStationEntity>(entity =>
        {
            entity.ToTable("FuelStations");
            entity.HasKey(s => s.StationCode);

            entity.Property(s => s.StationCode).HasMaxLength(32);
            entity.Property(s => s.StationId).HasMaxLength(64);
            entity.Property(s => s.BrandId).HasMaxLength(64);
            entity.Property(s => s.Brand).HasMaxLength(128);
            entity.Property(s => s.Name).HasMaxLength(256);
            entity.Property(s => s.Address).HasMaxLength(512);
            entity.Property(s => s.Suburb).HasMaxLength(128);
            entity.Property(s => s.State).HasMaxLength(16);
            entity.Property(s => s.Postcode).HasMaxLength(16);
            entity.Property(s => s.Latitude).HasPrecision(9, 6);
            entity.Property(s => s.Longitude).HasPrecision(9, 6);

            entity.HasMany(s => s.Prices)
                .WithOne(p => p.Station!)
                .HasForeignKey(p => p.StationCode)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FuelPriceEntity>(entity =>
        {
            entity.ToTable("FuelPrices");
            entity.HasKey(p => new { p.StationCode, p.FuelType });

            entity.Property(p => p.StationCode).HasMaxLength(32);
            entity.Property(p => p.FuelType).HasMaxLength(16);
            entity.Property(p => p.Price).HasPrecision(8, 1);
            entity.Property(p => p.Unit).HasMaxLength(16);
            entity.Property(p => p.Description).HasMaxLength(256);

            entity.HasIndex(p => p.FuelType);
            entity.HasIndex(p => p.LastUpdatedUtc);
        });

        modelBuilder.Entity<UserPreferenceEntity>(entity =>
        {
            entity.ToTable("UserPreferences");
            entity.HasKey(p => p.UserId);

            entity.Property(p => p.UserId).HasMaxLength(450);
            entity.Property(p => p.DefaultSuburb).HasMaxLength(128);
            entity.Property(p => p.PreferredFuelTypes).HasMaxLength(256);
            entity.Property(p => p.DisplayName).HasMaxLength(128);
            entity.Property(p => p.AvatarDataUrl).HasColumnType("TEXT");
            entity.Property(p => p.OverviewFilterFuelTypes).HasMaxLength(256);
            entity.Property(p => p.OverviewFilterBrandNames).HasMaxLength(512);

            entity.HasOne<IdentityUser>()
                .WithOne()
                .HasForeignKey<UserPreferenceEntity>(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FuelPriceHistoryEntity>(entity =>
        {
            entity.ToTable("FuelPriceHistory");
            entity.HasKey(h => h.Id);

            entity.Property(h => h.StationCode).HasMaxLength(32);
            entity.Property(h => h.FuelType).HasMaxLength(16);
            entity.Property(h => h.Price).HasPrecision(8, 1);

            entity.HasIndex(h => new { h.StationCode, h.FuelType, h.RecordedAtUtc });
            entity.HasIndex(h => h.RecordedAtUtc);
        });

        modelBuilder.Entity<RefreshTokenEntity>(entity =>
        {
            entity.ToTable("RefreshTokens");
            entity.HasKey(t => t.Id);
            entity.Property(t => t.TokenHash).HasMaxLength(256);
            entity.Property(t => t.TokenSalt).HasMaxLength(128);
            entity.Property(t => t.CreatedByIp).HasMaxLength(64);
            entity.Property(t => t.RevokedByIp).HasMaxLength(64);
            entity.HasIndex(t => t.UserId);
        });
    }
}
