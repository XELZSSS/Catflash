import proxyConfig from '../../../shared/proxy-config.cjs';

const { buildProxyOrigin, normalizeString, resolveProxyHost, resolveProxyPort } = proxyConfig;
const AUTH_HEADER = 'x-catflash-proxy-token';

const readProxyPort = (): string => {
  const fromBridge = typeof window !== 'undefined' ? window.gero?.getProxyPort?.() : undefined;
  const fromEnv = process.env.MINIMAX_PROXY_PORT;
  return resolveProxyPort(fromBridge ?? fromEnv);
};

const readProxyHost = (): string => {
  const fromBridge = typeof window !== 'undefined' ? window.gero?.getProxyHost?.() : undefined;
  const fromEnv = process.env.MINIMAX_PROXY_HOST;
  return resolveProxyHost(fromBridge ?? fromEnv);
};

export const getProxyBaseUrl = (): string => {
  return buildProxyOrigin({
    host: readProxyHost(),
    port: readProxyPort(),
  });
};

export const buildProxyUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getProxyBaseUrl()}${normalizedPath}`;
};

export const getProxyToken = (): string | undefined => {
  const fromBridge = typeof window !== 'undefined' ? window.gero?.getProxyToken?.() : undefined;
  return normalizeString(fromBridge) || normalizeString(process.env.CATFLASH_PROXY_TOKEN);
};

export const getProxyAuthHeaders = (): Record<string, string> => {
  const token = getProxyToken();
  if (!token) return {};
  return { [AUTH_HEADER]: token };
};

const isLocalProxyTarget = (target?: string): boolean => {
  if (!target) return false;
  try {
    const url = new URL(target);
    const currentProxyHost = readProxyHost();
    const isLoopback =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === currentProxyHost;
    if (!isLoopback) return false;
    return url.pathname.startsWith('/proxy');
  } catch {
    return false;
  }
};

export const getProxyAuthHeadersForTarget = (target?: string): Record<string, string> => {
  if (!isLocalProxyTarget(target)) return {};
  return getProxyAuthHeaders();
};
