const ONE_YEAR = 60 * 60 * 24 * 365;

export function setClientCookie(name: string, value: string, maxAge = ONE_YEAR) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}
