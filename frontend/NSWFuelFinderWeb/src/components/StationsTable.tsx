import { Table, Tag, Tooltip } from "antd";
import type { ReactNode } from "react";
import type { ColumnsType, TableProps } from "antd/es/table";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import type { NearbyFuelStation, StationFuelPrice } from "../types";
import { getFuelColor, compareFuelTypes } from "../utils/fuelColors";

type Props = {
  data: NearbyFuelStation[];
  loading?: boolean;
  sortBy?: "distance" | "price";
  sortOrder?: "asc" | "desc";
  onSortChange?: (sortBy: "distance" | "price", sortOrder: "asc" | "desc") => void;
  appliedVolume?: number;
};

const renderPriceTag = (price: StationFuelPrice) => {
  const centsValue = price.centsPerLitre.toFixed(1);
  const dollarsValue = `${(price.centsPerLitre / 100).toFixed(3)}${price.unit ?? "$/L"}`;
  const text = `${price.fuelType}: ${centsValue}`;
  const title = price.lastUpdated
    ? `${price.fuelType}: ${dollarsValue} (updated ${dayjs(price.lastUpdated).format("YYYY-MM-DD HH:mm")})`
    : `${price.fuelType}: ${dollarsValue}`;
  const tagColor = getFuelColor(price.fuelType);
  return (
    <Tooltip title={title} key={`${price.fuelType}-${price.centsPerLitre}`}>
      <Tag color={tagColor}>{text}</Tag>
    </Tooltip>
  );
};

const formatVolumeLabel = (value: number) => Number(value.toFixed(2)).toString();

const renderPredictedCostTags = (prices: StationFuelPrice[], volume: number): ReactNode[] => {
  const volumeDisplay = formatVolumeLabel(volume);
  const tags: ReactNode[] = [];

  const sortedPrices = [...prices].sort((a, b) => compareFuelTypes(a.fuelType, b.fuelType));

  sortedPrices.forEach((price) => {
    const baseCost =
      price.estimatedCost != null
        ? Number(price.estimatedCost)
        : Number(((price.centsPerLitre * volume) / 100).toFixed(2));

    if (Number.isNaN(baseCost)) {
      return;
    }

    const formattedCost = baseCost.toFixed(2);
    tags.push(
      <Tooltip
        title={`${price.fuelType}: $${formattedCost} for ${volumeDisplay} L`}
        key={`cost-${price.fuelType}-${formattedCost}`}
      >
        <Tag color={getFuelColor(price.fuelType)}>{`${price.fuelType}: $${formattedCost}`}</Tag>
      </Tooltip>
    );
  });

  return tags;
};

const mapSortOrderToTable = (order?: "asc" | "desc") =>
  order === "desc" ? "descend" : "ascend";

export const StationsTable: React.FC<Props> = ({
  data,
  loading,
  sortBy,
  sortOrder,
  onSortChange,
  appliedVolume,
}) => {
  const distanceSortOrder = sortBy === "distance" ? mapSortOrderToTable(sortOrder) : undefined;
  const priceSortOrder = sortBy === "price" ? mapSortOrderToTable(sortOrder) : undefined;
  const hasVolume = typeof appliedVolume === "number" && appliedVolume > 0;

  const predictedCostColumn = hasVolume && appliedVolume
    ? [{
        title: `Predicted Cost [${formatVolumeLabel(appliedVolume)} L]`,
        key: "predictedCost",
        render: (_: unknown, record: NearbyFuelStation) =>
          renderPredictedCostTags(record.prices, appliedVolume),
      }] as ColumnsType<NearbyFuelStation>
    : [];

  const columns: ColumnsType<NearbyFuelStation> = [
    ...predictedCostColumn,
    {
      title: "Station",
      dataIndex: "name",
      key: "name",
      render: (value, record) => (
        <Link to={`/stations/${record.id}`} state={{ station: record }}>
          {value ?? `Station ${record.id}`}
        </Link>
      ),
    },
    {
      title: "Brand",
      dataIndex: "brand",
      key: "brand",
      width: 120,
    },
    {
      title: "Address",
      key: "address",
      render: (_, record) => record.address ?? `${record.suburb ?? ""} ${record.state ?? ""}`,
    },
    {
      title: "Distance (km)",
      dataIndex: "distanceKm",
      key: "distance",
      width: 140,
      sorter: true,
      sortOrder: distanceSortOrder,
      sortDirections: ["ascend", "descend"],
      render: (value?: number | null) => (value == null ? "-" : value.toFixed(2)),
    },
    {
      title: "Prices",
      dataIndex: "prices",
      key: "price",
      sorter: true,
      sortOrder: priceSortOrder,
      sortDirections: ["ascend", "descend"],
      render: (prices: StationFuelPrice[]) =>
        [...prices]
          .sort((a, b) => compareFuelTypes(a.fuelType, b.fuelType))
          .map(renderPriceTag),
    },
  ];

  const handleTableChange: TableProps<NearbyFuelStation>["onChange"] = (_, __, sorter) => {
    if (!onSortChange) {
      return;
    }

    const sortState = Array.isArray(sorter) ? sorter[0] : sorter;

    if (!sortState || !sortState.order) {
      onSortChange("distance", "asc");
      return;
    }

    const nextSortBy = sortState.columnKey === "price" ? "price" : "distance";
    const nextSortOrder = sortState.order === "descend" ? "desc" : "asc";
    onSortChange(nextSortBy, nextSortOrder);
  };

  return (
    <Table
      columns={columns}
      dataSource={data}
      loading={loading}
      rowKey={(record) => record.id}
      pagination={{ pageSize: 10 }}
      onChange={handleTableChange}
    />
  );
};
