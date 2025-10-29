import { Card } from "antd";
import { Line } from "@ant-design/plots";
import dayjs from "dayjs";
import type { FuelPriceTrendResponse } from "../types";

type Props = {
  loading?: boolean;
  data?: FuelPriceTrendResponse[];
};

export const TrendsChart: React.FC<Props> = ({ loading, data }) => {
  if (loading) {
    return <Card loading style={{ height: 320 }} />;
  }

  if (!data || data.length === 0) {
    return <Card>No trend data available for this station.</Card>;
  }

  const merged = data.flatMap((series) =>
    series.points.map((point) => ({
      fuelType: series.fuelType,
      date: dayjs(point.recordedAt).format("YYYY-MM-DD"),
      price: point.centsPerLitre / 100,
    }))
  );

  const config = {
    data: merged,
    xField: "date",
    yField: "price",
    seriesField: "fuelType",
    smooth: true,
    height: 320,
    meta: {
      date: { alias: "Date" },
      price: { alias: "Price ($/L)" },
    },
    tooltip: {
      showMarkers: false,
    },
  } as const;

  return (
    <Card title="Price Trend">
      <Line {...config} />
    </Card>
  );
};
