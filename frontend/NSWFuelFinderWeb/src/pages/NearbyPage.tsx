import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Result,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import { fuelDisplayOrder } from "../utils/fuelColors";
import { StationsTable } from "../components/StationsTable";
import { useNearbyStations, type NearbyFilter } from "../hooks/queries";
import type { NearbyFuelStation } from "../types";

type SearchMode = "location" | "suburb" | null;

type FormValues = {
  latitude?: number;
  longitude?: number;
  suburb?: string;
  radiusKm?: number;
  fuelTypes?: string[];
  brands?: string[];
  volumeLitres?: number;
  sortBy?: "distance" | "price";
  sortOrder?: "asc" | "desc";
};

type PersistedState = {
  mode: Exclude<SearchMode, null>;
  formValues: FormValues;
  searchParams: NearbyFilter | null;
};

const defaultRadiusKm = 5;
const fuelTypeOptions = fuelDisplayOrder.map((value) => ({ label: value, value }));

let persistedState: PersistedState | null = null;

const buildDefaultFormValues = (): FormValues => ({
  latitude: undefined,
  longitude: undefined,
  suburb: undefined,
  radiusKm: defaultRadiusKm,
  fuelTypes: [],
  brands: [],
  volumeLitres: undefined,
  sortBy: "distance",
  sortOrder: "asc",
});

const volumeEquals = (a?: number, b?: number) => {
  if (a == null && b == null) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  return Math.abs(a - b) < 0.0001;
};

export const NearbyPage: React.FC = () => {
  const initialPersisted = useRef(persistedState);
  const initialVolume = initialPersisted.current?.formValues.volumeLitres;
  const [mode, setMode] = useState<SearchMode>(initialPersisted.current?.mode ?? null);
  const [searchParams, setSearchParams] = useState<NearbyFilter | null>(
    initialPersisted.current?.searchParams ?? null
  );
  const [geolocating, setGeolocating] = useState(false);
  const geolocationSupported = typeof navigator !== "undefined" && Boolean(navigator.geolocation);
  const [form] = Form.useForm<FormValues>();
  const [costCalcExpanded, setCostCalcExpanded] = useState<boolean>(Boolean(initialVolume));
  const [volumeInput, setVolumeInput] = useState<number | undefined>(initialVolume);
  const [appliedVolume, setAppliedVolume] = useState<number | undefined>(initialVolume);
  const [hasFilterChanges, setHasFilterChanges] = useState<boolean>(!initialPersisted.current);
  const [hasPendingVolumeChange, setHasPendingVolumeChange] = useState<boolean>(false);
  const isApplyingFormValues = useRef(false);

  const applyFormValues = (values: Partial<FormValues>) => {
    isApplyingFormValues.current = true;
    form.setFieldsValue(values);
    setTimeout(() => {
      isApplyingFormValues.current = false;
    }, 0);
  };

  const handleFormValuesChange = () => {
    if (isApplyingFormValues.current) {
      return;
    }
    setHasFilterChanges(true);
  };

  const handleVolumeInputChange = (value: number | null) => {
    const nextVolume = value ?? undefined;
    setVolumeInput(nextVolume);
    setHasPendingVolumeChange(!volumeEquals(nextVolume, appliedVolume));
    setHasFilterChanges(true);
  };

  useEffect(() => {
    if (initialPersisted.current) {
      applyFormValues(initialPersisted.current.formValues);
      const volume = initialPersisted.current.formValues.volumeLitres;
      setAppliedVolume(volume);
      setVolumeInput(volume);
      setCostCalcExpanded(Boolean(volume));
      setHasFilterChanges(false);
      setHasPendingVolumeChange(false);
    } else {
      applyFormValues(buildDefaultFormValues());
      setAppliedVolume(undefined);
      setVolumeInput(undefined);
      setCostCalcExpanded(false);
      setHasFilterChanges(true);
      setHasPendingVolumeChange(false);
    }
  }, [form]);

  const { data, isLoading, isError } = useNearbyStations(searchParams);
  const stations: NearbyFuelStation[] = useMemo(() => data?.stations ?? [], [data]);
  const availableBrands = useMemo(() => data?.availableBrands ?? [], [data?.availableBrands]);
  const brandOptions = useMemo(() => {
    const normalizedBrands = availableBrands
      .filter((brand): brand is string => typeof brand === "string" && brand.trim().length > 0)
      .map((brand) => brand.trim());

    if (normalizedBrands.length > 0) {
      return Array.from(new Set(normalizedBrands))
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ label: value, value }));
    }

    const fallbackBrands = Array.from(
      stations.reduce((set, station) => {
        if (station.brand) {
          set.add(station.brand.trim());
        }
        return set;
      }, new Set<string>())
    ).filter((brand) => brand.length > 0);

    return fallbackBrands
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ label: value, value }));
  }, [availableBrands, stations]);

  const applyDefaultFormValues = () => {
    form.resetFields();
    applyFormValues(buildDefaultFormValues());
    setAppliedVolume(undefined);
    setVolumeInput(undefined);
    setCostCalcExpanded(false);
    setHasFilterChanges(true);
    setHasPendingVolumeChange(false);
  };

  const handleModeSelect = (targetMode: Exclude<SearchMode, null>) => {
    if (mode === targetMode) {
      return;
    }
    setMode(targetMode);
    setSearchParams(null);
    persistedState = null;
    initialPersisted.current = null;
    applyDefaultFormValues();
  };

  const handleLocate = () => {
    if (!geolocationSupported) {
      message.warning("Geolocation is not supported in this browser.");
      return;
    }
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude.toFixed(4));
        const longitude = Number(position.coords.longitude.toFixed(4));
        applyFormValues({
          latitude,
          longitude,
        });
        setHasFilterChanges(true);
        setGeolocating(false);
      },
      (error) => {
        message.error(`Unable to retrieve location: ${error.message}`);
        setGeolocating(false);
      }
    );
  };

  const performSearch = (): boolean => {
    if (!mode) {
      message.warning("Select a search mode first.");
      return false;
    }

    const rawValues = form.getFieldsValue();
    const radius = Math.min(Math.max(rawValues.radiusKm ?? defaultRadiusKm, 1), 50);
    const trimmedSuburb = rawValues.suburb?.trim() || undefined;
    const sortByValue = rawValues.sortBy ?? "distance";
    const sortOrderValue = rawValues.sortOrder ?? "asc";
    const normalizedBrands =
      (rawValues.brands ?? [])
        .map((brand) => (typeof brand === "string" ? brand.trim() : ""))
        .filter((brand): brand is string => brand.length > 0) ?? [];
    const volumeFromState = appliedVolume && appliedVolume > 0 ? appliedVolume : undefined;

    let filter: NearbyFilter | null = null;

    if (mode === "location") {
      if (rawValues.latitude == null || rawValues.longitude == null) {
        message.error("Latitude and longitude are required for location search.");
        return false;
      }
      filter = {
        latitude: rawValues.latitude,
        longitude: rawValues.longitude,
        radiusKm: radius,
        suburb: trimmedSuburb,
        fuelTypes: rawValues.fuelTypes,
        brands: normalizedBrands,
        volumeLitres: volumeFromState,
        sortBy: sortByValue,
        sortOrder: sortOrderValue,
      };
    } else {
      if (!trimmedSuburb) {
        message.error("Please enter a suburb to search.");
        return false;
      }
      filter = {
        suburb: trimmedSuburb,
        radiusKm: radius,
        fuelTypes: rawValues.fuelTypes,
        brands: normalizedBrands,
        volumeLitres: volumeFromState,
        sortBy: sortByValue,
        sortOrder: sortOrderValue,
      };
    }

    const nextFormValues: FormValues = {
      latitude: filter.latitude,
      longitude: filter.longitude,
      suburb: filter.suburb,
      radiusKm: filter.radiusKm,
      fuelTypes: filter.fuelTypes ?? [],
      brands: normalizedBrands,
      volumeLitres: volumeFromState,
      sortBy: sortByValue,
      sortOrder: sortOrderValue,
    };

    applyFormValues(nextFormValues);
    setSearchParams(filter);
    persistedState = {
      mode: mode,
      formValues: nextFormValues,
      searchParams: filter,
    };
    initialPersisted.current = persistedState;
    setHasFilterChanges(false);
    setHasPendingVolumeChange(!volumeEquals(volumeInput, volumeFromState));
    return true;
  };

  const handleSearchButtonClick = () => {
    if (!hasFilterChanges) {
      message.info("Apply filter changes to search again.");
      return;
    }
    performSearch();
  };

  const syncPersistedVolume = (volume: number | undefined, nextFilter?: NearbyFilter | null) => {
    if (!persistedState) {
      return;
    }

    const nextFormValues = { ...persistedState.formValues, volumeLitres: volume };
    const nextSearchParams =
      nextFilter !== undefined
        ? nextFilter
        : persistedState.searchParams
        ? { ...persistedState.searchParams, volumeLitres: volume }
        : null;

    persistedState = {
      mode: persistedState.mode,
      formValues: nextFormValues,
      searchParams: nextSearchParams,
    };
    initialPersisted.current = persistedState;
  };

  const handleOpenCostCalculation = () => {
    setCostCalcExpanded(true);
    setVolumeInput(appliedVolume);
    setHasPendingVolumeChange(false);
  };

  const performApplyVolume = (): boolean => {
    if (volumeInput == null || Number.isNaN(volumeInput) || volumeInput <= 0) {
      message.warning("Enter a volume in litres greater than zero.");
      return false;
    }

    const normalizedVolume = Number(volumeInput);
    setAppliedVolume(normalizedVolume);
    applyFormValues({ volumeLitres: normalizedVolume });
    let hadActiveSearch = false;
    setSearchParams((prev) => {
      if (!prev) {
        syncPersistedVolume(normalizedVolume);
        return prev;
      }
      hadActiveSearch = true;
      const updated = { ...prev, volumeLitres: normalizedVolume };
      syncPersistedVolume(normalizedVolume, updated);
      return updated;
    });
    if (hadActiveSearch) {
      setHasFilterChanges(false);
    } else {
      setHasFilterChanges(true);
    }
    setHasPendingVolumeChange(false);
    return true;
  };

  const handleApplyVolumeClick = () => {
    if (!hasPendingVolumeChange) {
      message.info("Adjust volume before applying again.");
      return;
    }
    performApplyVolume();
  };

  const handleClearVolume = () => {
    setAppliedVolume(undefined);
    setVolumeInput(undefined);
    setCostCalcExpanded(false);
    applyFormValues({ volumeLitres: undefined });
    let hadActiveSearch = false;
    setSearchParams((prev) => {
      if (!prev) {
        syncPersistedVolume(undefined);
        return prev;
      }
      hadActiveSearch = true;
      const updated: NearbyFilter = { ...prev, volumeLitres: undefined };
      syncPersistedVolume(undefined, updated);
      return updated;
    });
    if (hadActiveSearch) {
      setHasFilterChanges(false);
    } else {
      setHasFilterChanges(true);
    }
    setHasPendingVolumeChange(false);
  };

  const renderModeSpecificInputs = () => {
    if (mode === "location") {
      return (
        <Space size="large" align="end" wrap style={{ width: "100%" }}>
          <Form.Item
            name="latitude"
            label="Latitude"
            rules={[{ required: true, message: "Latitude is required." }]}
          >
            <InputNumber style={{ width: 160 }} step={0.0001} />
          </Form.Item>
          <Form.Item
            name="longitude"
            label="Longitude"
            rules={[{ required: true, message: "Longitude is required." }]}
          >
            <InputNumber style={{ width: 160 }} step={0.0001} />
          </Form.Item>
          <Form.Item label=" " colon={false} style={{ marginRight: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Button
                onClick={handleLocate}
                loading={geolocating}
                disabled={!geolocationSupported}
                style={{ alignSelf: "flex-start" }}
              >
                Use My Current Location
              </Button>
              {!geolocationSupported && (
                <Typography.Text type="secondary">Geolocation not available in this browser.</Typography.Text>
              )}
            </div>
          </Form.Item>
        </Space>
      );
    }

    if (mode === "suburb") {
      return (
        <Space size="large" wrap style={{ width: "100%" }}>
          <Form.Item
            name="suburb"
            label="Suburb"
            rules={[{ required: true, message: "Please enter a suburb." }]}
          >
            <Input placeholder="Enter suburb to search" style={{ width: 240 }} />
          </Form.Item>
        </Space>
      );
    }

    return null;
  };

  const filtersConfigured = Boolean(searchParams);
  const currentSortBy =
    (searchParams?.sortBy as FormValues["sortBy"]) ??
    ((form.getFieldValue("sortBy") as FormValues["sortBy"]) ?? "distance");
  const currentSortOrder =
    (searchParams?.sortOrder as FormValues["sortOrder"]) ??
    ((form.getFieldValue("sortOrder") as FormValues["sortOrder"]) ?? "asc");

  const applySortPersistence = (
    nextSortBy: FormValues["sortBy"],
    nextSortOrder: FormValues["sortOrder"],
    nextFilter: NearbyFilter
  ) => {
    applyFormValues({ sortBy: nextSortBy, sortOrder: nextSortOrder });
    const updatedFormValues = form.getFieldsValue() as FormValues;
    const derivedMode: Exclude<SearchMode, null> =
      mode ??
      (nextFilter.latitude != null && nextFilter.longitude != null ? "location" : "suburb");
    persistedState = {
      mode: derivedMode,
      formValues: updatedFormValues,
      searchParams: nextFilter,
    };
    initialPersisted.current = persistedState;
    setHasFilterChanges(false);
  };

  const handleTableSort = (sortBy: "distance" | "price", sortOrder: "asc" | "desc") => {
    setSearchParams((prev) => {
      if (!prev) {
        return prev;
      }
      if (prev.sortBy === sortBy && prev.sortOrder === sortOrder) {
        applySortPersistence(sortBy, sortOrder, prev);
        return prev;
      }
      const updated = { ...prev, sortBy, sortOrder };
      applySortPersistence(sortBy, sortOrder, updated);
      return updated;
    });
  };

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Typography.Title level={2}>Find Nearby Stations</Typography.Title>

      <Space size="large">
        <Button
          type={mode === "location" ? "primary" : "default"}
          onClick={() => handleModeSelect("location")}
        >
          Search By Current Location
        </Button>
        <Button
          type={mode === "suburb" ? "primary" : "default"}
          onClick={() => handleModeSelect("suburb")}
        >
          Search By Suburb
        </Button>
      </Space>

      {mode && (
        <Card>
          <Form<FormValues>
            form={form}
            layout="vertical"
            onValuesChange={handleFormValuesChange}
          >
            {renderModeSpecificInputs()}

            <Space size="large" wrap style={{ marginTop: 16 }}>
              <Form.Item name="radiusKm" label="Fuel Stations Within (km)">
                <InputNumber min={1} max={50} style={{ width: 160 }} />
              </Form.Item>
              <Form.Item name="fuelTypes" label="Fuel Types">
                <Select
                  mode="multiple"
                  allowClear
                  options={fuelTypeOptions}
                  placeholder="All"
                  style={{ minWidth: 200 }}
                />
              </Form.Item>
              <Form.Item name="brands" label="Brand">
                <Select
                  mode="tags"
                  allowClear
                  options={brandOptions}
                  placeholder="All"
                  style={{ minWidth: 200 }}
                  tokenSeparators={[","]}
                />
              </Form.Item>
              <Form.Item name="sortBy" label="Sort By">
                <Select
                  options={[
                    { label: "Distance", value: "distance" },
                    { label: "Price", value: "price" },
                  ]}
                  style={{ width: 160 }}
                />
              </Form.Item>
              <Form.Item name="sortOrder" label="Order By">
                <Select
                  options={[
                    { label: "Ascending", value: "asc" },
                    { label: "Descending", value: "desc" },
                  ]}
                  style={{ width: 160 }}
                />
              </Form.Item>
            </Space>

            <Form.Item style={{ marginTop: 16 }}>
              <Space size="middle" wrap>
                {costCalcExpanded ? (
                  <Space size="small">
                    <InputNumber
                      value={volumeInput}
                      onChange={handleVolumeInputChange}
                      placeholder="Volume charging (L)"
                      min={0}
                      style={{ width: 200 }}
                    />
                    <Button
                      type={hasPendingVolumeChange ? "primary" : "default"}
                      onClick={handleApplyVolumeClick}
                    >
                      Apply
                    </Button>
                    <Button onClick={handleClearVolume}>Clear</Button>
                  </Space>
                ) : (
                  <Button onClick={handleOpenCostCalculation}>
                    {appliedVolume ? `Cost Calculation (${appliedVolume} L)` : "Cost Calculation"}
                  </Button>
                )}
                <Button
                  type={hasFilterChanges ? "primary" : "default"}
                  onClick={handleSearchButtonClick}
                  loading={isLoading}
                  disabled={geolocating}
                >
                  Search
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}

      {isError ? (
        <Result
          status="error"
          title="Failed to load stations"
          subTitle="Please check your inputs and try again."
        />
      ) : filtersConfigured ? (
        <StationsTable
          data={stations}
          loading={isLoading}
          sortBy={currentSortBy}
          sortOrder={currentSortOrder}
          appliedVolume={appliedVolume}
          onSortChange={handleTableSort}
        />
      ) : (
        <Result
          status="info"
          title={mode ? "Configure your filters" : "Choose how you want to search"}
          subTitle={
            mode
              ? "Adjust the filters above and click Search to see nearby stations."
              : "Select Search By Current Location or Search By Suburb to get started."
          }
        />
      )}
    </Space>
  );
};
