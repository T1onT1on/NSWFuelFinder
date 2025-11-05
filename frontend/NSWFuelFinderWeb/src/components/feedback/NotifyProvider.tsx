// src/components/feedback/NotifyProvider.tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Alert, Snackbar } from "@mui/material";

type Severity = "success" | "info" | "warning" | "error";
type NotifyOptions = {
  durationMs?: number;
  color?: string;
  textColor?: string;
};
type NotifyCtx = {
  notify: (msg: ReactNode, severity?: Severity, options?: NotifyOptions) => void;
};

const Ctx = createContext<NotifyCtx>({ notify: () => {} });

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<ReactNode>("");
  const [severity, setSeverity] = useState<Severity>("info");
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [customColor, setCustomColor] = useState<string | null>(null);
  const [customTextColor, setCustomTextColor] = useState<string | null>(null);

  const notify = useCallback(
    (m: ReactNode, s: Severity = "info", options?: NotifyOptions) => {
      setMsg(m);
      setSeverity(s);
      setDurationMs(options?.durationMs ?? null);
      setCustomColor(options?.color ?? null);
      setCustomTextColor(options?.textColor ?? null);
      setOpen(true);
    },
    []
  );

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={durationMs ?? 2800}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{
          "&.MuiSnackbar-anchorOriginTopCenter": {
            top: 70,
          },
        }}
      >
        <Alert
          severity={severity}
          onClose={handleClose}
          variant="filled"
          sx={{
            width: "100%",
            bgcolor: customColor ?? undefined,
            color: customTextColor ?? undefined,
            "& .MuiAlert-icon": {
              color: customTextColor ?? undefined,
            },
          }}
        >
          {msg}
        </Alert>
      </Snackbar>
    </Ctx.Provider>
  );
}

export function useNotify() {
  return useContext(Ctx);
}
