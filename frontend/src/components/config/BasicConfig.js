const BasicConfig = {
  SERVER_PROTOCOL: import.meta.env.VITE_SERVER_PROTOCOL || 'http',
  SERVER_HOST: import.meta.env.VITE_SERVER_HOST || 'localhost',
  SERVER_PORT: import.meta.env.VITE_SERVER_PORT || '',
  SERVER_PATH: import.meta.env.VITE_SERVER_PATH || '/api',
  HOST_SAME_URL: import.meta.env.VITE_HOST_SAME_URL === 'true',
  API_VERSION: import.meta.env.VITE_API_VERSION,
  SOFTWARE_VERSION: import.meta.env.VITE_SOFTWARE_VERSION
    ? parseFloat(import.meta.env.VITE_SOFTWARE_VERSION)
    : 0,
  localizations: {
    defaultLanguage: 'de',
    availableLanguages: ['de', 'en'],
  },
  /**
   * You can also create an own Collections at unsplash and link the collection
   * here to use random-images use a link to a single image if
   * Image should stay the same on each login
   */
  loginImage: 'url(https://source.unsplash.com/random/1600x900/?wallpaper)',
  copyright: {
    url: 'https://myProject.xx',
    text: 'myProject',
  },
};

export function getServerBaseUrl() {
  const host = BasicConfig.HOST_SAME_URL
    ? window.location.hostname
    : BasicConfig.SERVER_HOST;
  const port = BasicConfig.SERVER_PORT ? `:${BasicConfig.SERVER_PORT}` : '';
  return `${BasicConfig.SERVER_PROTOCOL}://${host}${port}${BasicConfig.SERVER_PATH}`;
}

export default BasicConfig;
