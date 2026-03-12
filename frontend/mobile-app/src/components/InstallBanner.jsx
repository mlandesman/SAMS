import React from 'react';
import {
  Box,
  Button,
  Stack,
  Typography
} from '@mui/material';
import IosShareIcon from '@mui/icons-material/IosShare';
import AddToHomeScreenIcon from '@mui/icons-material/AddToHomeScreen';
import DownloadForOfflineIcon from '@mui/icons-material/DownloadForOffline';

const cardSx = {
  width: '100%',
  maxWidth: 560,
  margin: '0 auto',
  borderRadius: 3,
  bgcolor: 'background.paper',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.28)',
  border: '1px solid rgba(30, 64, 175, 0.15)',
  p: 2.5
};

function IOSInstructions() {
  return (
    <Stack spacing={1.25} sx={{ mt: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        To install SAMS on iPhone/iPad:
      </Typography>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <IosShareIcon sx={{ color: 'primary.main', mt: 0.25 }} />
        <Typography variant="body2">Tap the Share button in Safari.</Typography>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <AddToHomeScreenIcon sx={{ color: 'primary.main', mt: 0.25 }} />
        <Typography variant="body2">Scroll and tap Add to Home Screen.</Typography>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <DownloadForOfflineIcon sx={{ color: 'primary.main', mt: 0.25 }} />
        <Typography variant="body2">Tap Add to finish.</Typography>
      </Stack>
    </Stack>
  );
}

function AndroidPrompt({ canPromptInstall, promptInstall }) {
  return (
    <Stack spacing={1.25} sx={{ mt: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        Install SAMS for faster access and full-screen mode.
      </Typography>
      <Button
        variant="contained"
        size="large"
        onClick={promptInstall}
        disabled={!canPromptInstall}
        startIcon={<DownloadForOfflineIcon />}
        sx={{ alignSelf: 'flex-start' }}
      >
        Install SAMS
      </Button>
      {!canPromptInstall && (
        <Typography variant="caption" color="text.secondary">
          Install option will appear when your browser provides the native prompt.
        </Typography>
      )}
    </Stack>
  );
}

export default function InstallBanner({
  open,
  isIOS,
  canPromptInstall,
  promptInstall,
  dismiss
}) {
  if (!open) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        px: 2,
        pb: 'max(16px, env(safe-area-inset-bottom))',
        zIndex: (theme) => theme.zIndex.drawer + 100
      }}
    >
      <Box sx={cardSx}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            component="img"
            src="/icon-192x192.png"
            alt="SAMS icon"
            sx={{ width: 56, height: 56, borderRadius: 2, flexShrink: 0 }}
          />
          <Box>
            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 700 }}>
              Install SAMS
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add SAMS to your home screen for an app-like experience.
            </Typography>
          </Box>
        </Stack>

        {isIOS ? (
          <IOSInstructions />
        ) : (
          <AndroidPrompt
            canPromptInstall={canPromptInstall}
            promptInstall={promptInstall}
          />
        )}

        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button variant="text" onClick={dismiss}>
            Not now
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
