import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Button, CircularProgress, Snackbar, Stack,
} from '@mui/material';

import SWHelper from '@/components/helpers/SWHelper';

const VersionDetector = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const show = () => setOpen(true);
    const message = ({ data }) => {
      if (data?.msg === 'OPEN_DIALOG' || data?.msg === 'CACHE_PREPARED') show();
    };
    navigator.serviceWorker?.addEventListener('message', message);
    window.addEventListener('newVersion', show);
    if (SWHelper.isNewAvailable()) show();
    return () => {
      navigator.serviceWorker?.removeEventListener('message', message);
      window.removeEventListener('newVersion', show);
    };
  }, []);

  const update = async () => {
    setUpdating(true);
    setError('');
    try {
      await SWHelper.updateByUser();
    } catch (failure) {
      setError(failure.message);
      setUpdating(false);
    }
  };

  return (
    <Snackbar open={open} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert
        severity={error ? 'error' : 'info'}
        role="alertdialog"
        aria-label={t('newVersionDetected.refresh')}
        action={(
          <Stack direction="row" spacing={1}>
            <Button color="inherit" disabled={updating} onClick={() => setOpen(false)}>
              {t('newVersionDetected.later')}
            </Button>
            <Button
              color="inherit"
              disabled={updating}
              onClick={update}
              startIcon={updating ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {t(updating ? 'newVersionDetected.updating' : 'newVersionDetected.update')}
            </Button>
          </Stack>
        )}
      >
        {error || t('newVersionDetected.refresh')}
      </Alert>
    </Snackbar>
  );
};

export default VersionDetector;
