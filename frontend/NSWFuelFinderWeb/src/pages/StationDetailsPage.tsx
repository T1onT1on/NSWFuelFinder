import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "react-router-dom";
import { Card, Descriptions, Result, Select, Space, Tag, Tooltip, Typography } from "antd";
import { useNearbyStations, useStationTrends } from "../hooks/queries";
import { TrendsChart } from "../components/TrendsChart";
import { useApiClient } from "../hooks/useApiClient";
import type { NearbyFuelStation, NearbyStationsResponse } from "../types";
import dayjs from "dayjs";

const periodOptions = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

type LocationState = {
  station?: NearbyFuelStation;
};

export const StationDetailsPage: React.FC = () => {
  const { stationCode } = useParams<{ stationCode: string }>();
  const location = useLocation();
  const state = location.state as LocationState | undefined;
  const client = useApiClient();

  const [periodDays, setPeriodDays] = useState<number>(30);
  const [fuelType, setFuelType] = useState<string | undefined>(undefined);

  const { data: fallbackData } = useNearbyStations(
    !state?.station && stationCode
      ? {
          latitude: -33.8688,
          longitude: 151.2093,
          radiusKm: 50,
        }
      : null
  );

  const seededStation = useMemo(() => {
    if (state?.station) {
      return state.station;
    }
    return fallbackData?.stations.find((s) => s.id === stationCode);
  }, [state?.station, fallbackData, stationCode]);

  const { data: latestData } = useQuery<NearbyStationsResponse>({
    queryKey: ["station-detail", stationCode, seededStation?.latitude, seededStation?.longitude],
    enabled: Boolean(stationCode && seededStation),
    queryFn: async () => {
      if (!stationCode || !seededStation) {
        throw new Error("Missing station context");
      }
      const params = new URLSearchParams();
      params.set("latitude", String(seededStation.latitude));
      params.set("longitude", String(seededStation.longitude));
      params.set("radiusKm", "50");
      const url = `/api/stations/nearby?${params.toString()}`;
      const { data } = await client.get<NearbyStationsResponse>(url);
      return data;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 60 * 1000,
  });

  const station = useMemo(() => {
    if (latestData?.stations) {
      const match = latestData.stations.find((s) => s.id === stationCode);
      if (match) {
        return match;
      }
    }
    return seededStation;
  }, [latestData, seededStation, stationCode]);

  const { data: trendData, isLoading } = useStationTrends(stationCode, fuelType, periodDays);

  useEffect(() => {
    if (!fuelType || !station) {
      return;
    }
    const found = station.prices.some((p) => p.fuelType === fuelType);
    if (!found) {
      setFuelType(undefined);
    }
  }, [station, fuelType]);

  if (!stationCode) {
    return <Result status="404" title="Missing station code" />;
  }

  if (!station) {
    return (
      <Result
        status="404"
        title="Station data unavailable"
        subTitle="We couldn't find this station. Please return to the search page and try again."
      />
    );
  }

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Typography.Title level={2}>Station Details</Typography.Title>
      <Card>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Name">{station.name}</Descriptions.Item>
          <Descriptions.Item label="Brand">{station.brand ?? "N/A"}</Descriptions.Item>
          <Descriptions.Item label="Address">{station.address ?? "N/A"}</Descriptions.Item>
          <Descriptions.Item label="Coordinates">
            {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
          </Descriptions.Item>
          <Descriptions.Item label="Fuel Prices">
            {station.prices.length > 0 ? (
              <Space wrap>
                {station.prices.map((price) => {
                  const centsValue = price.centsPerLitre.toFixed(1);
                  const dollarsValue = `${(price.centsPerLitre / 100).toFixed(3)}${price.unit ?? "$/L"}`;
                  const title = price.lastUpdated
                    ? `${price.fuelType}: ${dollarsValue} (updated ${dayjs(price.lastUpdated).format("YYYY-MM-DD HH:mm")})`
                    : `${price.fuelType}: ${dollarsValue}`;
                  return (
                    <Tooltip title={title} key={`${price.fuelType}-${price.centsPerLitre}`}>
                      <Tag color="geekblue">{`${price.fuelType}: ${centsValue}`}</Tag>
                    </Tooltip>
                  );
                })}
              </Space>
            ) : (
              "No prices available"
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Space align="center" size="large" wrap>
        <Select
          allowClear
          placeholder="Fuel type"
          value={fuelType}
          style={{ width: 160 }}
          onChange={(value) => setFuelType(value ?? undefined)}
          options={station.prices.map((p) => ({ label: p.fuelType, value: p.fuelType }))}
        />
        <Select value={periodDays} options={periodOptions} style={{ width: 160 }} onChange={setPeriodDays} />
      </Space>
      <TrendsChart loading={isLoading} data={trendData} />
    </Space>
  );
};
