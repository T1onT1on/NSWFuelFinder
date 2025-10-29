using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NSWFuelFinder.Migrations
{
    /// <inheritdoc />
    public partial class AddFuelStationLocationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FuelStations",
                columns: table => new
                {
                    StationCode = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    StationId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    BrandId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Brand = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    Address = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    Suburb = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    State = table.Column<string>(type: "TEXT", maxLength: 16, nullable: true),
                    Postcode = table.Column<string>(type: "TEXT", maxLength: 16, nullable: true),
                    Latitude = table.Column<double>(type: "REAL", precision: 9, scale: 6, nullable: false),
                    Longitude = table.Column<double>(type: "REAL", precision: 9, scale: 6, nullable: false),
                    IsAdBlueAvailable = table.Column<bool>(type: "INTEGER", nullable: false),
                    SyncedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FuelStations", x => x.StationCode);
                });

            migrationBuilder.CreateTable(
                name: "FuelPrices",
                columns: table => new
                {
                    StationCode = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    FuelType = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    Price = table.Column<decimal>(type: "TEXT", precision: 8, scale: 1, nullable: false),
                    Unit = table.Column<string>(type: "TEXT", maxLength: 16, nullable: true),
                    Description = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    LastUpdatedUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FuelPrices", x => new { x.StationCode, x.FuelType });
                    table.ForeignKey(
                        name: "FK_FuelPrices_FuelStations_StationCode",
                        column: x => x.StationCode,
                        principalTable: "FuelStations",
                        principalColumn: "StationCode",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FuelPrices_FuelType",
                table: "FuelPrices",
                column: "FuelType");

            migrationBuilder.CreateIndex(
                name: "IX_FuelPrices_LastUpdatedUtc",
                table: "FuelPrices",
                column: "LastUpdatedUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FuelPrices");

            migrationBuilder.DropTable(
                name: "FuelStations");
        }
    }
}
