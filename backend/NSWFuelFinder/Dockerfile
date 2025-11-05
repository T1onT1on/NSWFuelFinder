# ---------- Build stage ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy everything and restore
COPY . .
WORKDIR /src

# Publish backend project
RUN dotnet publish backend/NSWFuelFinder/NSWFuelFinder.csproj -c Release -o /app/publish

# ---------- Runtime stage ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Render will inject PORT env var
ENV ASPNETCORE_URLS=http://0.0.0.0:${PORT}

# Copy published files
COPY --from=build /app/publish ./

# Start your app (replace name if needed)
ENTRYPOINT ["dotnet", "NSWFuelFinder.dll"]
