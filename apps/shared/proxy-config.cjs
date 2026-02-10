const DEFAULT_PROXY_PORT = '4010';
const DEFAULT_PROXY_HOST = '127.0.0.1';

const normalizeString = (value) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 && normalized !== 'undefined' ? normalized : undefined;
};

const resolveProxyPort = (value) => {
  const parsed = Number.parseInt(normalizeString(value) ?? DEFAULT_PROXY_PORT, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return DEFAULT_PROXY_PORT;
  }
  return String(parsed);
};

const resolveProxyHost = (value) => normalizeString(value) ?? DEFAULT_PROXY_HOST;

const buildProxyOrigin = ({ host, port }) => `http://${host}:${port}`;

module.exports = {
  DEFAULT_PROXY_PORT,
  DEFAULT_PROXY_HOST,
  normalizeString,
  resolveProxyPort,
  resolveProxyHost,
  buildProxyOrigin,
};
