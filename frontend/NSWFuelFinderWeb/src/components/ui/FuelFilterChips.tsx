// src/components/ui/FuelFilterChips.tsx
import { useMemo, type ReactNode } from "react";
import {
  Box,
  Button,
  Stack,
  Typography,
  ToggleButton,
  useTheme,
} from "@mui/material";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { fuelDisplayOrder, getFuelColor } from "../../utils/fuelColors";

export default function FuelFilterChips({
  value,
  selectAll,
  onChange,
  onSelectAllChange,
  customControl,
  disabled = false,
}: {
  value: string[];
  selectAll: boolean;
  onChange: (next: string[]) => void;
  onSelectAllChange: (checked: boolean) => void;
  customControl?: ReactNode;
  disabled?: boolean;
}) {
  const theme = useTheme();

  // ✅ 不渲染 PDL 按钮（DL 依旧保留）
  const fuels = useMemo(
    () =>
      fuelDisplayOrder
        .filter((t) => t !== "PDL") // <-- 关键：隐藏 PDL
        .map((t) => {
          const bg = getFuelColor(t);
          const fg = theme.palette.getContrastText(bg as any);
          return { t, bg, fg };
        }),
    [theme]
  );

  // —— 规则：
  // 1) 默认：selectAll=true 且 value.length===0 → Select All 禁用
  // 2) 有任意 filter 被选中 → Select All 启用
  const selectAllDisabled = (selectAll && value.length === 0) || disabled;

  // 点 Select All（仅在启用时可点）：回到全选并清空 filters
  const handleToggleSelectAll = () => {
    if (selectAllDisabled || disabled) return;
    onSelectAllChange(true);
    onChange([]); // 清空 filters（显示全部）
  };

  // 点某个油品按钮
  const toggleFuel = (t: string) => {
    if (disabled) return;
    if (selectAll) {
      // 从全选进入过滤模式：只激活当前这个
      onSelectAllChange(false);
      onChange([t]);
      return;
    }
    // 已在过滤模式：正常增删
    const next = value.includes(t) ? value.filter((x) => x !== t) : [...value, t];
    // 若删到 0 个 -> 自动回到默认：全选 + 清空 filters
    if (next.length === 0) {
      onSelectAllChange(true);
      onChange([]);
      return;
    }
    onChange(next);
  };

  return (
    <Stack
      spacing={1.5}
      sx={{
        width: "100%",
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
      aria-disabled={disabled}
    >
      {/* Row 1: Select All 按钮样式 + 选中态 */}
      <Stack direction="row" spacing={1} alignItems="center">
        <ToggleButton
          value="selectAll"
          selected={selectAll}
          onChange={handleToggleSelectAll}
          disabled={selectAllDisabled}
          color="primary"
          sx={{
            px: 2,
            py: 0.7,
            gap: 1,
            width: "fit-content",
            fontWeight: 600,
            borderRadius: 2,
            textTransform: "none",
            border: "1px solid",
            borderColor: "primary.main",
            color: selectAll ? "#fff" : "primary.main",
            "&:hover": { bgcolor: "primary.main", color: "#fff" },
            "&.Mui-selected": {
              bgcolor: "primary.main",
              color: "#fff",
              borderColor: "primary.main",
              "&:hover": { bgcolor: "primary.dark" },
            },
            "&.Mui-disabled": {
              opacity: 0.6,
              cursor: "not-allowed",
            },
          }}
        >
          {selectAll ? (
            <DoneAllIcon fontSize="small" />
          ) : (
            <CheckBoxOutlineBlankIcon fontSize="small" />
          )}
          Show All Fuels
        </ToggleButton>
        {customControl}
      </Stack>

      {/* 提示始终展示 */}
      <Typography variant="caption" color="text.secondary">
        Select the Fuels and Brands you want to check
      </Typography>

      {/* 过滤按钮区：彩色，过滤模式下高亮 */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {fuels.map(({ t, bg, fg }) => {
          const active = !selectAll && value.includes(t);
          return (
            <Box key={t} sx={{ position: "relative" }}>
              <Button
                size="small"
                variant={active ? "contained" : "outlined"}
                onClick={() => toggleFuel(t)}
                sx={
                  active
                    ? {
                        bgcolor: bg,
                        color: fg,
                        borderColor: bg,
                        "&:hover": { bgcolor: bg, opacity: 0.9 },
                        px: 2.4,
                        py: 0.8,
                        fontWeight: 600,
                      }
                    : {
                        borderColor: bg,
                        color: bg,
                        "&:hover": { borderColor: bg, bgcolor: `${bg}14` },
                        px: 2.4,
                        py: 0.8,
                        fontWeight: 600,
                      }
                }
              >
                {t}
              </Button>
              {active && (
                <Box
                  sx={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    bgcolor: "background.paper",
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: (theme) => theme.shadows[1],
                  }}
                >
                  <CloseRoundedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Stack>
  );
}
