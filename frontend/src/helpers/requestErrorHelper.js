const getRequestError = (result, fallback) => {
  if (result?.online === false) return 'Cannot reach the server. Check your connection and try again.';
  const details = result?.errorData?.detailedErrors;
  if (Array.isArray(details) && details.length) {
    return details.map(detail => [detail.errorPath, detail.message].filter(Boolean).join(': ')).join('; ');
  }
  return result?.errorData?.message || result?.errorMessage || fallback;
};

export default getRequestError;
