import { useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import BasicConfig, { getServerBaseUrl } from '@/components/config/BasicConfig';

const enabled = import.meta.env.VITE_LAB_AUTH === 'true';
if (enabled) axios.defaults.withCredentials = true;
const authUrl = () => `${getServerBaseUrl()}/${BasicConfig.API_VERSION}/lab-auth`;

export default function LabAuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const check = async () => {
      try {
        const { data } = await axios.get(`${authUrl()}/session`, { withCredentials: true });
        if (!data.enabled) throw new Error('Lab authentication is not configured.');
        if (active) { setUser(data.user); setError(''); }
      } catch {
        if (active) { setUser(null); setError('Unable to verify your session. Please try again.'); }
      } finally { if (active) setLoading(false); }
    };
    const interceptor = axios.interceptors.response.use(r => r, e => {
      if (e.response?.status === 401 && active) setUser(null);
      return Promise.reject(e);
    });
    check();
    const timer = setInterval(check, 60000);
    window.addEventListener('focus', check);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', check); axios.interceptors.response.eject(interceptor); };
  }, []);
  if (!enabled) return children;
  if (loading) return <Box sx={{ display: 'grid', placeItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  const login = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await axios.post(`${authUrl()}/login`, { email, password }, { withCredentials: true });
      setPassword('');
      setUser(data.user);
    } catch (e) { setError(e.response?.data?.message || 'Sign in failed. Please try again.'); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    setBusy(true);
    try {
      await axios.post(`${authUrl()}/logout`, {}, { withCredentials: true });
      // A reload closes every live socket and clears the in-memory shared dashboard state.
      window.location.reload();
    } catch { setError('Sign out failed. Please try again.'); setBusy(false); }
  };
  if (user) return (
    <>
      {children}
      <Paper sx={{ position: 'fixed', bottom: 8, right: 12, zIndex: 1500, px: 1.5, py: 0.25, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption">{user.email}</Typography>
        <Button size="small" onClick={logout} disabled={busy}>Sign out</Button>
        {error && <Typography role="alert" variant="caption" color="error">{error}</Typography>}
      </Paper>
    </>
  );
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, bgcolor: 'background.default' }}>
      <Paper component="form" onSubmit={login} sx={{ width: '100%', maxWidth: 400, p: 4 }}>
        <Stack spacing={2.5}>
          <Typography variant="h5">Metrik Lab</Typography>
          <Typography color="text.secondary">Sign in with your personal lab account.</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
          <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          <Typography variant="caption" color="text.secondary">Accounts are provisioned by the lab administrator.</Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
