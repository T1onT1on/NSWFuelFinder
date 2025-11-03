// src/components/feedback/NotifyProvider.tsx
import { createContext, useCallback, useContext, useState } from "react";
import { Alert, Snackbar } from "@mui/material";

type Severity = "success" | "info" | "warning" | "error";
type NotifyCtx = { notify: (msg: string, severity?: Severity) => void };

const Ctx = createContext<NotifyCtx>({ notify: () => {} });

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [severity, setSeverity] = useState<Severity>("info");

  const notify = useCallback((m: string, s: Severity = "info") => {
    setMsg(m);
    setSeverity(s);
    setOpen(true);
  }, []);

  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={2800}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={severity} onClose={() => setOpen(false)} variant="filled" sx={{ width: "100%" }}>
          {msg}
        </Alert>
      </Snackbar>
    </Ctx.Provider>
  );
}

export function useNotify() {
  return useContext(Ctx);
}
