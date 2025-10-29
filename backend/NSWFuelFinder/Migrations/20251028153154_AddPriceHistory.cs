using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NSWFuelFinder.Migrations
{
    /// <inheritdoc />
    public partial class AddPriceHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FuelPriceHistory",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    StationCode = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    FuelType = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    Price = table.Column<decimal>(type: "TEXT", precision: 8, scale: 1, nullable: false),
                    RecordedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FuelPriceHistory", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FuelPriceHistory_RecordedAtUtc",
                table: "FuelPriceHistory",
                column: "RecordedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_FuelPriceHistory_StationCode_FuelType_RecordedAtUtc",
                table: "FuelPriceHistory",
                columns: new[] { "StationCode", "FuelType", "RecordedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FuelPriceHistory");
        }
    }
}
