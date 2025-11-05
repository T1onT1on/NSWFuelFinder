import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import Visibility from "@mui/icons-material/Visibility";

type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

type ChangePasswordDialogProps = {
  open: boolean;
  busy?: boolean;
  errorText?: string | null;
  onClose: () => void;
  onSubmit?: (payload: ChangePasswordPayload) => void | Promise<void>;
};

export default function ChangePasswordDialog({
  open,
  busy,
  errorText,
  onClose,
  onSubmit,
}: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const resolvedBusy = busy ?? submitting;
  const effectiveError = useMemo(() => errorText ?? localError, [errorText, localError]);

  useEffect(() => {
    if (open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLocalError(null);
      setSubmitting(false);
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
    }
  }, [open]);

  const validate = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return "Please complete all password fields.";
    }
    if (newPassword.length < 6) {
      return "New password must be at least 6 characters.";
    }
    if (newPassword !== confirmPassword) {
      return "New password and confirmation do not match.";
    }
    if (currentPassword === newPassword) {
      return "New password must differ from the current password.";
    }
    return null;
  };

  const handleSubmit = async () => {
    setLocalError(null);
    const validationError = validate();
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    try {
      setSubmitting(true);
      if (onSubmit) {
        const maybe = onSubmit({ currentPassword, newPassword });
        if (maybe && typeof (maybe as Promise<void>).then === "function") {
          await (maybe as Promise<void>);
        }
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update password.";
      setLocalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === "Enter" && !resolvedBusy) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => (!resolvedBusy ? onClose() : null)}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
    >
      <DialogTitle sx={{ px: 3, py: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Typography variant="h6" fontWeight={700}>
            Change Password
          </Typography>
          <IconButton onClick={onClose} disabled={resolvedBusy} aria-label="close" size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pb: 3 }} onKeyDown={handleKeyDown}>
        <Stack spacing={2}>
          {effectiveError && (
            <Alert severity="error" variant="outlined">
              {effectiveError}
            </Alert>
          )}

          <TextField
            label="Current password"
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            fullWidth
            disabled={resolvedBusy}
            autoComplete="current-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showCurrent ? "Hide current password" : "Show current password"}
                    onClick={() => setShowCurrent((prev) => !prev)}
                    edge="end"
                    disabled={resolvedBusy}
                  >
                    {showCurrent ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="New password"
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            disabled={resolvedBusy}
            autoComplete="new-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showNew ? "Hide new password" : "Show new password"}
                    onClick={() => setShowNew((prev) => !prev)}
                    edge="end"
                    disabled={resolvedBusy}
                  >
                    {showNew ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Confirm new password"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            disabled={resolvedBusy}
            autoComplete="new-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                    onClick={() => setShowConfirm((prev) => !prev)}
                    edge="end"
                    disabled={resolvedBusy}
                  >
                    {showConfirm ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Box display="flex" justifyContent="flex-end" flexWrap="wrap" gap={1}>
            <Button
              variant="text"
              onClick={onClose}
              disabled={resolvedBusy}
              sx={{ fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={resolvedBusy}
              sx={{ fontWeight: 700 }}
            >
              Update Password
            </Button>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
