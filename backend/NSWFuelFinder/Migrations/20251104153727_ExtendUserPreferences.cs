using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NSWFuelFinder.Migrations
{
    /// <inheritdoc />
    public partial class ExtendUserPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AvatarDataUrl",
                table: "UserPreferences",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                table: "UserPreferences",
                type: "TEXT",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OverviewFilterBrandNames",
                table: "UserPreferences",
                type: "TEXT",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "OverviewFilterEnabled",
                table: "UserPreferences",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "OverviewFilterFuelTypes",
                table: "UserPreferences",
                type: "TEXT",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "OverviewFilterRadiusKm",
                table: "UserPreferences",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "OverviewFilterSelectAll",
                table: "UserPreferences",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AvatarDataUrl",
                table: "UserPreferences");

            migrationBuilder.DropColumn(
                name: "DisplayName",
                table: "UserPreferences");

            migrationBuilder.DropColumn(
                name: "OverviewFilterBrandNames",
                table: "UserPreferences");

            migrationBuilder.DropColumn(
                name: "OverviewFilterEnabled",
                table: "UserPreferences");

            migrationBuilder.DropColumn(
                name: "OverviewFilterFuelTypes",
                table: "UserPreferences");

            migrationBuilder.DropColumn(
                name: "OverviewFilterRadiusKm",
                table: "UserPreferences");

            migrationBuilder.DropColumn(
                name: "OverviewFilterSelectAll",
                table: "UserPreferences");
        }
    }
}
