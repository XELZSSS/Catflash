/* global process */
const { app } = require('electron');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

let proxyProcess = null;

const getProxyScriptPath = (isDev) => {
  if (isDev) {
    return path.join(app.getAppPath(), 'apps', 'server', 'llm-proxy.mjs');
  }
  return path.join(process.resourcesPath, 'server', 'llm-proxy.mjs');
};

const ensureProxyToken = () => {
  const existing = process.env.CATFLASH_PROXY_TOKEN;
  if (existing && existing.trim()) return existing;
  const generated = crypto.randomBytes(24).toString('hex');
  process.env.CATFLASH_PROXY_TOKEN = generated;
  return generated;
};

const startProxy = (isDev) => {
  if (proxyProcess) return;
  const scriptPath = getProxyScriptPath(isDev);
  const proxyToken = ensureProxyToken();
  proxyProcess = spawn(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      MINIMAX_PROXY_PORT: process.env.MINIMAX_PROXY_PORT ?? '4010',
      MINIMAX_PROXY_HOST: process.env.MINIMAX_PROXY_HOST ?? '127.0.0.1',
      CATFLASH_PROXY_TOKEN: proxyToken,
    },
    stdio: isDev ? 'inherit' : 'ignore',
  });

  proxyProcess.on('exit', () => {
    proxyProcess = null;
  });
};

const stopProxy = () => {
  if (!proxyProcess) return;
  proxyProcess.kill();
  proxyProcess = null;
};

module.exports = {
  startProxy,
  stopProxy,
};
