import { readFileSync } from 'node:fs';

const brands = JSON.parse(readFileSync(new URL('./branding.json', import.meta.url), 'utf8'));

export default function resolveBranding(env, mode) {
  const environment = env.VITE_IDE_ENVIRONMENT || (mode === 'development' ? 'dev' : 'local');
  if (!Object.hasOwn(brands, environment)) {
    throw new Error('VITE_IDE_ENVIRONMENT must be local, lab or dev.');
  }
  return {
    ...brands[environment],
    environment,
    icon: `/branding/${environment}.svg`,
    appleIcon: `/branding/${environment}-192.png`,
  };
}
