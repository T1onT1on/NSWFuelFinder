import { Card, Col, Row, Statistic, Typography, Button, Space, Tooltip, message } from "antd";
import { useMemo, useState } from "react";
import { useCheapestPrices, useNearbyStations, type NearbyFilter } from "../hooks/queries";
import type { CheapestPriceResponse, NearbyFuelStation } from "../types";
import { Link } from "react-router-dom";
import { getFuelColor, fuelDisplayOrder, compareFuelTypes } from "../utils/fuelColors";

const formatCentsDisplay = (value: number) => Number(value.toFixed(1));
const formatDollarsDisplay = (value: number) => `${(value / 100).toFixed(3)}$/L`;
const NEARBY_RADIUS_KM = 5;

const buildCheapestFromNearby = (stations: NearbyFuelStation[]): CheapestPriceResponse[] => {
  const cheapest = new Map<string, CheapestPriceResponse>();

  stations.forEach((station) => {
    station.prices.forEach((price) => {
      const fuelKey = price.fuelType?.toUpperCase() ?? "";
      if (!fuelDisplayOrder.includes(fuelKey)) {
        return;
      }

      const candidate: CheapestPriceResponse = {
        fuelType: fuelKey,
        centsPerLitre: price.centsPerLitre,
        unit: price.unit ?? "$/L",
        lastUpdated: price.lastUpdated ?? null,
        station: {
          stationCode: station.id,
          name: station.name,
          brand: station.brand,
          address: station.address,
          suburb: station.suburb,
          state: station.state,
          postcode: station.postcode,
          latitude: station.latitude,
          longitude: station.longitude,
        },
      };

      const existing = cheapest.get(fuelKey);
      if (!existing || candidate.centsPerLitre < existing.centsPerLitre) {
        cheapest.set(fuelKey, candidate);
      }
    });
  });

  return fuelDisplayOrder
    .map((fuel) => cheapest.get(fuel))
    .filter((value): value is CheapestPriceResponse => Boolean(value));
};

const PriceCard: React.FC<{ price: CheapestPriceResponse; nearbyMode?: boolean }> = ({ price, nearbyMode }) => {
  const accentColor = getFuelColor(price.fuelType);
  const headTextColor = accentColor.toLowerCase() === "#fadb14" ? "#262626" : "#ffffff";
  const titleText = nearbyMode ? `${price.fuelType} - Lowest within ${NEARBY_RADIUS_KM}km` : price.fuelType;

  return (
    <Card
      hoverable
      title={<span style={{ color: headTextColor }}>{titleText}</span>}
      headStyle={{ backgroundColor: accentColor, color: headTextColor }}
      bodyStyle={{ paddingTop: 16 }}
      style={{ minHeight: 190 }}
    >
      <Tooltip title={`${price.fuelType}: ${formatDollarsDisplay(price.centsPerLitre)}`}>
        <Statistic title="Price" value={formatCentsDisplay(price.centsPerLitre)} precision={1} />
      </Tooltip>
      <Typography.Paragraph style={{ marginTop: 12 }}>
        {price.station.name ?? price.station.stationCode}
      </Typography.Paragraph>
      <Typography.Text type="secondary">
        {price.station.suburb ?? price.station.address ?? "NSW"}
      </Typography.Text>
      <div style={{ marginTop: 16 }}>
        <Button type="link" size="small">
          <Link to={`/stations/${price.station.stationCode}`}>View details</Link>
        </Button>
      </div>
    </Card>
  );
};

export const OverviewPage: React.FC = () => {
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<string[]>([]);
  const [nearbyFilter, setNearbyFilter] = useState<NearbyFilter | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const { data: globalData, isLoading: isGlobalLoading } = useCheapestPrices(selectedFuelTypes);
  const { data: nearbyData, isLoading: isNearbyLoading } = useNearbyStations(nearbyFilter);

  const globalPrices = useMemo<CheapestPriceResponse[]>(() => globalData ?? [], [globalData]);
  const sortedGlobalPrices = useMemo(
    () => globalPrices.slice().sort((a, b) => compareFuelTypes(a.fuelType, b.fuelType)),
    [globalPrices]
  );

  const nearbyPrices = useMemo(() => {
    if (!nearbyData) {
      return [] as CheapestPriceResponse[];
    }

    return buildCheapestFromNearby(nearbyData.stations).sort((a, b) => compareFuelTypes(a.fuelType, b.fuelType));
  }, [nearbyData]);

  const isNearbyMode = Boolean(nearbyFilter);
  const activePrices = isNearbyMode ? nearbyPrices : sortedGlobalPrices;

  const filteredPrices = useMemo(() => {
    if (!selectedFuelTypes.length) {
      return activePrices;
    }
    const set = new Set(selectedFuelTypes.map((f) => f.toUpperCase()));
    return activePrices.filter((price) => set.has(price.fuelType.toUpperCase()));
  }, [activePrices, selectedFuelTypes]);

  const handleQuickSearch = () => {
    if (!navigator.geolocation) {
      message.warning("Geolocation is not supported by this browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude.toFixed(4));
        const longitude = Number(position.coords.longitude.toFixed(4));
        setNearbyFilter({ latitude, longitude, radiusKm: NEARBY_RADIUS_KM });
        setIsLocating(false);
        message.success("Showing cheapest prices within 5 km of your location.");
      },
      (error) => {
        setIsLocating(false);
        message.error(`Unable to retrieve location: ${error.message}`);
      }
    );
  };

  const handleClearNearby = () => {
    setNearbyFilter(null);
    setIsLocating(false);
    message.info("Showing NSW-wide lowest prices.");
  };

  const handleToggleFuel = (type: string) => {
    setSelectedFuelTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const isLoading = isNearbyMode ? isNearbyLoading || isLocating : isGlobalLoading;
  const showEmptyState = !isLoading && filteredPrices.length === 0;

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Typography.Title level={2}>Lowest Fuel Prices Overview</Typography.Title>
      <Typography.Paragraph>
        Select fuel types to view the cheapest stations across NSW. Data refreshes twice daily.
      </Typography.Paragraph>
      <Space wrap>
        {fuelDisplayOrder.map((type) => {
          const active = selectedFuelTypes.includes(type);
          return (
            <Button key={type} type={active ? "primary" : "default"} onClick={() => handleToggleFuel(type)}>
              {type}
            </Button>
          );
        })}
        <Button
          onClick={() => setSelectedFuelTypes(fuelDisplayOrder)}
          disabled={selectedFuelTypes.length === fuelDisplayOrder.length}
        >
          Select All
        </Button>
        <Button onClick={() => setSelectedFuelTypes([])} disabled={selectedFuelTypes.length === 0}>
          Clear
        </Button>
        <Button
          type={isNearbyMode ? "primary" : "default"}
          loading={isLocating}
          onClick={handleQuickSearch}
        >
          Quick Search By My Location
        </Button>
        {isNearbyMode && (
          <Button onClick={handleClearNearby} disabled={isLocating}>
            Back to NSW Overview
          </Button>
        )}
      </Space>
      {isNearbyMode && (
        <Typography.Text type="secondary">
          Displaying the lowest price for each fuel within {NEARBY_RADIUS_KM} km of your current location.
        </Typography.Text>
      )}
      <Row gutter={[16, 16]}>
        {filteredPrices.map((price) => (
          <Col xs={24} sm={12} lg={8} key={price.fuelType}>
            <PriceCard price={price} nearbyMode={isNearbyMode} />
          </Col>
        ))}
        {isLoading && <Typography.Text>Loading...</Typography.Text>}
        {showEmptyState && (
          <Typography.Text>No data available. Try selecting different fuel types.</Typography.Text>
        )}
      </Row>
    </Space>
  );
};
