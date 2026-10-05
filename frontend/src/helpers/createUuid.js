const createUuid = (cryptoApi = window.crypto) => {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();

  // randomUUID may be unavailable on HTTP origins; getRandomValues still
  // supplies the random bytes needed for a UUID v4.
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('This browser cannot generate secure IDs. Please use a browser with Web Crypto support.');
  }
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  // eslint-disable-next-line no-bitwise
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // eslint-disable-next-line no-bitwise
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export default createUuid;
