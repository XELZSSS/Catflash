const DEFAULT_PROXY_PORT = '4010';
const AUTH_HEADER = 'x-catflash-proxy-token';

const readEnvValue = (value?: string): string | undefined => {
  if (!value || value === 'undefined') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readProxyPort = (): string => {
  const fromBridgeRaw = typeof window !== 'undefined' ? window.gero?.getProxyPort?.() : undefined;
  const fromBridge = readEnvValue(fromBridgeRaw);
  const fromEnv = readEnvValue(process.env.MINIMAX_PROXY_PORT);
  const candidate = fromBridge || fromEnv || DEFAULT_PROXY_PORT;
  const parsed = Number.parseInt(candidate, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return DEFAULT_PROXY_PORT;
  }
  return String(parsed);
};

export const getProxyBaseUrl = (): string => {
  return `http://localhost:${readProxyPort()}`;
};

export const buildProxyUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getProxyBaseUrl()}${normalizedPath}`;
};

export const getProxyToken = (): string | undefined => {
  const fromBridgeRaw = typeof window !== 'undefined' ? window.gero?.getProxyToken?.() : undefined;
  const fromBridge = readEnvValue(fromBridgeRaw);
  return fromBridge || readEnvValue(process.env.CATFLASH_PROXY_TOKEN);
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
    const isLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
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
