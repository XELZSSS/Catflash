/* global process, console, URL */
import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const PORT = Number(process.env.MINIMAX_PROXY_PORT ?? 4010);

const app = express();
app.use(cors());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const commonOptions = {
  changeOrigin: true,
  secure: true,
  logLevel: 'warn',
  onProxyReq: (proxyReq, req) => {
    // Forward Authorization if provided as "x-minimax-api-key"
    const key = req.headers['x-minimax-api-key'];
    if (key) {
      proxyReq.setHeader('Authorization', `Bearer ${key}`);
    }
  },
};

const blockedHeaders = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
  'origin',
  'referer',
]);

const parseHeaderValue = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return value[0] ?? '';
  return String(value);
};

const normalizeTargetUrl = (value) => {
  const raw = parseHeaderValue(value).trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
};

const parseCustomHeaders = (value) => {
  const raw = parseHeaderValue(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((header) => ({
        key: String(header?.key ?? '').trim(),
        value: String(header?.value ?? '').trim(),
      }))
      .filter((header) => header.key && header.value);
  } catch {
    return [];
  }
};

const routes = [
  { path: '/proxy/minimax-intl', target: 'https://api.minimax.io/v1', rewrite: '' },
  { path: '/proxy/minimax-cn', target: 'https://api.minimaxi.com/v1', rewrite: '' },
  { path: '/proxy/moonshot-intl', target: 'https://api.moonshot.ai/v1', rewrite: '' },
  { path: '/proxy/moonshot-cn', target: 'https://api.moonshot.cn/v1', rewrite: '' },
  { path: '/proxy/iflow', target: 'https://apis.iflow.cn/v1', rewrite: '' },
  { path: '/proxy/openai', target: 'https://api.openai.com', rewrite: '/v1' },
  { path: '/proxy/deepseek', target: 'https://api.deepseek.com', rewrite: '' },
  { path: '/proxy/glm-cn', target: 'https://open.bigmodel.cn/api/paas/v4', rewrite: '' },
  { path: '/proxy/glm-intl', target: 'https://api.z.ai/api/paas/v4', rewrite: '' },
  { path: '/proxy/tavily', target: 'https://api.tavily.com', rewrite: '' },
];

for (const route of routes) {
  app.use(
    route.path,
    createProxyMiddleware({
      ...commonOptions,
      target: route.target,
      pathRewrite: { [`^${route.path}`]: route.rewrite },
    })
  );
}

app.use(
  '/proxy/openai-compatible',
  (req, res, next) => {
    const target = normalizeTargetUrl(req.headers['x-openai-compatible-base-url']);
    if (!target) {
      res.status(400).json({ error: 'Missing or invalid OpenAI-Compatible base URL.' });
      return;
    }
    req.openaiCompatibleTarget = target;
    req.openaiCompatibleHeaders = parseCustomHeaders(req.headers['x-openai-compatible-headers']);
    next();
  },
  createProxyMiddleware({
    ...commonOptions,
    target: 'https://api.openai.com',
    pathRewrite: { '^/proxy/openai-compatible': '' },
    router: (req) => req.openaiCompatibleTarget,
    onProxyReq: (proxyReq, req) => {
      commonOptions.onProxyReq?.(proxyReq, req);
      const headers = req.openaiCompatibleHeaders ?? [];
      for (const header of headers) {
        const key = String(header.key ?? '').trim();
        const value = String(header.value ?? '').trim();
        if (!key || !value) continue;
        const lower = key.toLowerCase();
        if (blockedHeaders.has(lower)) continue;
        proxyReq.setHeader(key, value);
      }
    },
  })
);

app.listen(PORT, () => {
  console.log(`LLM proxy listening on http://localhost:${PORT}`);
});
