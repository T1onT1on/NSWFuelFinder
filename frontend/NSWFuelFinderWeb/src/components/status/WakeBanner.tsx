// src/components/status/WakeBanner.tsx
import { useEffect, useRef, useState } from "react";
import { Alert, AlertTitle, Box, Collapse, Fade, LinearProgress } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AutorenewIcon from "@mui/icons-material/Autorenew";

export type WakeBannerStatus =
  | "unknown"
  | "waking"
  | "degraded"
  | "healthy"
  | "unreachable"
  | "backend_error";

type Props = {
  /** Current server status from useServerStatus */
  serverStatus: WakeBannerStatus;
  /** Optional: called after the success banner collapses */
  onDone?: () => void;
  /** How long to show the green “success” state before collapsing (ms) */
  successVisibleMs?: number; // default 1200
};

export default function WakeBanner({
  serverStatus,
  onDone,
  successVisibleMs = 1200,
}: Props) {
  // Controls mount/unmount animation (Collapse)
  const [visible, setVisible] = useState(false);
  // Controls content/styling state
  const [phase, setPhase] = useState<"waking" | "success">("waking");

  const successTimer = useRef<number | null>(null);
  const wasWakingRef = useRef<boolean>(false);

  // Drive banner by incoming serverStatus
  useEffect(() => {
    const isWakingLike = serverStatus === "waking" || serverStatus === "degraded";

    // If currently waking/degraded ⇒ show banner in waking phase
    if (isWakingLike) {
      wasWakingRef.current = true;
      if (successTimer.current) {
        window.clearTimeout(successTimer.current);
        successTimer.current = null;
      }
      setPhase("waking");
      setVisible(true);
      return;
    }

    // If flipped to healthy *after* being waking/degraded ⇒ show success then collapse
    if (serverStatus === "healthy" && wasWakingRef.current && visible) {
      setPhase("success");
      successTimer.current = window.setTimeout(() => {
        setVisible(false);
        successTimer.current = null;
        onDone?.();
        // Reset the guard so next waking cycle can show again.
        wasWakingRef.current = false;
      }, successVisibleMs) as unknown as number;
      return;
    }

    // Any other status (unknown/unreachable/backend_error) should not show this banner
    if (serverStatus !== "healthy") {
      setVisible(false);
    }
  }, [serverStatus, visible, successVisibleMs, onDone]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (successTimer.current) window.clearTimeout(successTimer.current);
    };
  }, []);

  if (!visible) return null;

  const isSuccess = phase === "success";

  return (
    <Collapse in={visible} timeout={{ enter: 300, exit: 400 }}>
      <Box sx={{ position: "relative", mb: 2 }}>
        {/* Indeterminate bar only during waking */}
        <Fade in={!isSuccess} unmountOnExit>
          <LinearProgress
            color="info"
            sx={{ position: "absolute", top: -6, left: 0, right: 0, borderRadius: 2, height: 4 }}
          />
        </Fade>

        <Alert
          icon={
            isSuccess ? (
              <CheckCircleOutlineIcon color="success" sx={{ fontSize: 26 }} />
            ) : (
              <AutorenewIcon
                color="info"
                sx={{
                  fontSize: 25,
                  animation: "spin 2.4s linear infinite",
                  "@keyframes spin": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                  },
                }}
              />
            )
          }
          severity={isSuccess ? "success" : "info"}
          sx={{
            // Smoothly morph bg & border colors when success arrives
            transition: "background-color 300ms ease, border-left-color 300ms ease",
            bgcolor: (t) =>
              (isSuccess ? t.palette.success.light : t.palette.info.light) + "22",
            borderLeft: (t) =>
              `4px solid ${isSuccess ? t.palette.success.main : t.palette.info.main}`,
            borderRadius: 1,
          }}
        >
          <AlertTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {isSuccess ? "Thanks for waiting" : "Hang tight ☕"}
          </AlertTitle>

          {isSuccess ? (
            <Fade in>
              <Box component="span">Server is ready. Loading the latest data…</Box>
            </Fade>
          ) : (
            <Box component="span">
              Our beta server runs on a free Render plan, so it may take a moment to wake up.
              Data will appear automatically once it’s ready.
            </Box>
          )}
        </Alert>
      </Box>
    </Collapse>
  );
}
