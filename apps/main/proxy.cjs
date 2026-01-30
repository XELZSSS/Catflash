/* global process */
const { app } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let proxyProcess = null;

const getProxyScriptPath = (isDev) => {
  if (isDev) {
    return path.join(app.getAppPath(), 'apps', 'server', 'llm-proxy.mjs');
  }
  return path.join(process.resourcesPath, 'server', 'llm-proxy.mjs');
};

const startProxy = (isDev) => {
  const scriptPath = getProxyScriptPath(isDev);
  proxyProcess = spawn(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      MINIMAX_PROXY_PORT: process.env.MINIMAX_PROXY_PORT ?? '4010',
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
