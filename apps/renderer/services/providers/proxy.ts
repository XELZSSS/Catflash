const DEFAULT_PROXY_PORT = '4010';
const DEFAULT_PROXY_HOST = '127.0.0.1';
const AUTH_HEADER = 'x-catflash-proxy-token';

const normalizeString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 && normalized !== 'undefined' ? normalized : undefined;
};

const resolveProxyPort = (value: unknown): string => {
  const parsed = Number.parseInt(normalizeString(value) ?? DEFAULT_PROXY_PORT, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return DEFAULT_PROXY_PORT;
  }
  return String(parsed);
};

const resolveProxyHost = (value: unknown): string => normalizeString(value) ?? DEFAULT_PROXY_HOST;

const buildProxyOrigin = ({ host, port }: { host: string; port: string }): string =>
  `http://${host}:${port}`;

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
