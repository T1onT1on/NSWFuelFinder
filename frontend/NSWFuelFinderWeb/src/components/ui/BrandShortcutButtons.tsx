import { Button, Box } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import type { ReactNode } from "react";

export type BrandShortcutOption = {
  id: string;
  label: ReactNode;
  color?: "primary" | "secondary" | "inherit";
};

export type BrandShortcutButtonsProps = {
  options: BrandShortcutOption[];
  value: string[];
  onChange: (next: string[]) => void;
  allOptionId: string;
  closeIconIds?: string[];
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  allowEmptySelection?: boolean;
};

export default function BrandShortcutButtons({
  options,
  value,
  onChange,
  allOptionId,
  closeIconIds = [],
  size = "small",
  disabled = false,
  allowEmptySelection = false,
}: BrandShortcutButtonsProps) {
  const activeSet = new Set(value);

  const handleClick = (id: string) => {
    if (disabled) return;
    const next = new Set(activeSet);

    if (id === allOptionId) {
      onChange([allOptionId]);
      return;
    }

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    next.delete(allOptionId);

    if (next.size === 0) {
      if (allowEmptySelection) {
        onChange([]);
      } else {
        next.add(allOptionId);
        onChange(Array.from(next));
      }
      return;
    }

    onChange(Array.from(next));
  };

  return (
    <Box
      sx={{
        display: "flex",
        gap: 0.5,
        flexWrap: "wrap",
        maxWidth: 360,
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
      aria-disabled={disabled}
    >
      {options.map((option) => {
        const isActive = activeSet.has(option.id);
        const showClose = isActive && closeIconIds.includes(option.id);
        const color = option.color ?? (option.id === allOptionId ? "secondary" : "primary");

        return (
          <Button
            key={option.id}
            variant={isActive ? "contained" : "outlined"}
            color={color}
            size={size}
            onClick={() => handleClick(option.id)}
            disabled={disabled}
            sx={{
              position: "relative",
              textTransform: "none",
              fontWeight: 600,
              px: option.id === allOptionId ? 1.6 : 1.4,
              py: 0.7,
              minWidth: option.id === allOptionId ? 100 : 110,
              borderRadius: 2,
              whiteSpace: "nowrap",
            }}
          >
            {option.label}
            {showClose && (
              <Box
                component="span"
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
                  color: (theme) => theme.palette.getContrastText(theme.palette.background.paper),
                  boxShadow: (theme) => theme.shadows[1],
                }}
              >
                <CloseRoundedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
              </Box>
            )}
          </Button>
        );
      })}
    </Box>
  );
}
