const DEFAULT_AUTH_RETURN_PATH = '/';

type LocationParts = Pick<Location, 'pathname' | 'search' | 'hash'>;

export const getSafeOAuthReturnTo = (value: string | null | undefined) => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_AUTH_RETURN_PATH;
  }

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) {
      return DEFAULT_AUTH_RETURN_PATH;
    }

    if (url.pathname === '/auth' || url.pathname === '/auth/callback') {
      return DEFAULT_AUTH_RETURN_PATH;
    }

    return `${url.pathname}${url.search}${url.hash}` || DEFAULT_AUTH_RETURN_PATH;
  } catch {
    return DEFAULT_AUTH_RETURN_PATH;
  }
};

export const getOAuthReturnToFromLocation = (location: LocationParts) => {
  return getSafeOAuthReturnTo(`${location.pathname}${location.search}${location.hash}`);
};
