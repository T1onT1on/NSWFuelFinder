// src/components/ui/LoginDialog.tsx
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import Visibility from "@mui/icons-material/Visibility";

export type LoginDialogProps = {
  open: boolean;
  onClose: () => void;

  // Auth handlers
  onLogin?: (payload: { email: string; password: string; remember: boolean }) => void | Promise<void>;
  onRegister?: (payload: { email: string; password: string }) => void | Promise<void>;

  // Optional Google OAuth
  onGoogle?: () => void;

  // Optional error/busy from parent
  errorText?: string | null;
  busy?: boolean;

  // Optional links
  forgotPasswordHref?: string;
};

type Mode = "login" | "register";

type RememberedLogin = {
  email: string;
  remember: boolean;
};

let lastLoginPrefs: RememberedLogin | null = null;

export default function LoginDialog({
  open,
  onClose,
  onLogin,
  onRegister,
  onGoogle,
  errorText,
  busy,
  forgotPasswordHref,
}: LoginDialogProps) {
  // ------- local state -------
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState(""); // confirm password for register
  const [remember, setRemember] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);

  const isBusy = busy ?? submitting;
  const theme = useTheme();

  // ------- simple validators -------
  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const validate = () => {
    if (!validateEmail(email)) return "Please enter a valid email address.";
    if (pwd.length < 6) return "Password must be at least 6 characters.";
    if (mode === "register" && pwd !== pwd2) return "Passwords do not match.";
    return null;
  };

  const applyRememberedCredentials = () => {
    if (lastLoginPrefs?.remember) {
      setEmail(lastLoginPrefs.email);
      setRemember(true);
    } else {
      setEmail("");
      setRemember(false);
    }
    setPwd("");
    setPwd2("");
    setShowPwd(false);
    setShowPwd2(false);
    setLocalError(null);
    setActiveError(null);
  };

  const clearAllFields = () => {
    setEmail("");
    setPwd("");
    setPwd2("");
    setRemember(false);
    setShowPwd(false);
    setShowPwd2(false);
    setLocalError(null);
    setActiveError(null);
  };

  useEffect(() => {
    if (open) {
      setMode("login");
      setLocalError(null);
      applyRememberedCredentials();
    } else {
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (errorText != null) {
      setActiveError(errorText);
    } else {
      setActiveError(localError);
    }
  }, [errorText, localError]);


  const doSubmit = async () => {
    setLocalError(null);
    const v = validate();
    if (v) {
      setLocalError(v);
      return;
    }

    try {
      setSubmitting(true);
      if (mode === "login" && onLogin) {
        const trimmed = email.trim();
        lastLoginPrefs = remember
          ? { email: trimmed, remember: true }
          : null;
        const maybe = onLogin({ email: trimmed, password: pwd, remember });
        if (maybe && typeof (maybe as Promise<void>).then === "function") {
          await (maybe as Promise<void>);
        }
      }
      if (mode === "register" && onRegister) {
        const maybe = onRegister({ email: email.trim(), password: pwd });
        if (maybe && typeof (maybe as Promise<void>).then === "function") {
          await (maybe as Promise<void>);
        }
      }
    } catch (e: any) {
      setLocalError(e?.message || "Operation failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Enter" && !isBusy) {
      e.preventDefault();
      doSubmit();
    }
  };

  const title = mode === "login" ? "Log in to NSW Fuel Finder" : "Create your account";

  return (
    <Dialog
      open={open}
      onClose={isBusy ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
    >
      <DialogTitle sx={{ px: 3, py: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Typography variant="h6" fontWeight={700}>
            {title}
          </Typography>
          <IconButton onClick={onClose} disabled={isBusy} aria-label="close" size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pb: 3 }} onKeyDown={onKeyDown}>
        <Stack spacing={2}>
          {activeError && (
            <Alert severity="error" variant="outlined">
              {activeError}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                fullWidth
                disabled={isBusy}
                autoFocus
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Password"
                placeholder={mode === "login" ? "Enter your password" : "Choose a password"}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                type={showPwd ? "text" : "password"}
                fullWidth
                disabled={isBusy}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPwd ? "Hide password" : "Show password"}
                        onClick={() => setShowPwd((v) => !v)}
                        edge="end"
                        disabled={isBusy}
                      >
                        {showPwd ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {mode === "register" && (
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Confirm password"
                  placeholder="Re-enter your password"
                  value={pwd2}
                  onChange={(e) => setPwd2(e.target.value)}
                  type={showPwd2 ? "text" : "password"}
                  fullWidth
                  disabled={isBusy}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPwd2 ? "Hide password" : "Show password"}
                          onClick={() => setShowPwd2((v) => !v)}
                          edge="end"
                          disabled={isBusy}
                        >
                          {showPwd2 ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            )}
          </Grid>

          {/* Remember + Forgot (login only) */}
          {mode === "login" && (
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={isBusy}
                  />
                }
                label="Remember me"
              />
              {forgotPasswordHref ? (
                <Link href={forgotPasswordHref} underline="hover">
                  Forgot password?
                </Link>
              ) : (
                <Box />
              )}
            </Stack>
          )}

          {/* Submit */}
          <Button
            variant="contained"
            size="large"
            onClick={doSubmit}
            disabled={isBusy}
            sx={{
              py: 1.1,
              fontWeight: 700,
              bgcolor: theme.palette.secondary.main,
              color: theme.palette.getContrastText(theme.palette.secondary.main),
              "&:hover": {
                bgcolor: theme.palette.secondary.dark,
              },
              "&.Mui-disabled": {
                bgcolor: theme.palette.action.disabledBackground,
                color: theme.palette.action.disabled,
              },
            }}
          >
            {isBusy ? (mode === "login" ? "Logging in..." : "Creating...") : mode === "login" ? "Log in" : "Create account"}
          </Button>

          {/* Divider for Google login (only on login page) */}
          {onGoogle && mode === "login" && (
            <>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Divider sx={{ flex: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Or use
                </Typography>
                <Divider sx={{ flex: 1 }} />
              </Stack>
              <Button
                variant="outlined"
                size="large"
                onClick={onGoogle}
                disabled={isBusy}
                sx={{ py: 1.1, fontWeight: 600 }}
              >
                Log in with Google
              </Button>
            </>
          )}

          {/* Switch link */}
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {mode === "login" ? (
              <>
                Don’t have an account?{" "}
                <Link
                  component="button"
                  type="button"
                  onClick={() => {
                    setLocalError(null);
                    clearAllFields();
                    setMode("register");
                  }}
                  disabled={isBusy}
                >
                  Create one
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link
                  component="button"
                  type="button"
                  onClick={() => {
                    setLocalError(null);
                    clearAllFields();
                    setMode("login");
                  }}
                  disabled={isBusy}
                >
                  Log in
                </Link>
              </>
            )}
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
