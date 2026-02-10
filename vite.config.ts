import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const devServerHost = env.VITE_DEV_HOST || '127.0.0.1';
  return {
    root: path.resolve(__dirname, 'apps/renderer'),
    base: './',
    server: {
      port: 3000,
      host: devServerHost,
      proxy: {
        '/minimax-intl': {
          target: 'https://api.minimax.io',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/minimax-intl/, '/v1'),
        },
        '/minimax-cn': {
          target: 'https://api.minimaxi.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/minimax-cn/, '/v1'),
        },
      },
    },
    plugins: [react()],
    define: {
      __APP_ENV__: JSON.stringify(mode),
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
      'process.env.OPENAI_MODEL': JSON.stringify(env.OPENAI_MODEL),
      'process.env.OPENAI_BASE_URL': JSON.stringify(env.OPENAI_BASE_URL),
      'process.env.OPENAI_COMPATIBLE_API_KEY': JSON.stringify(env.OPENAI_COMPATIBLE_API_KEY),
      'process.env.OPENAI_COMPATIBLE_MODEL': JSON.stringify(env.OPENAI_COMPATIBLE_MODEL),
      'process.env.OPENAI_COMPATIBLE_BASE_URL': JSON.stringify(env.OPENAI_COMPATIBLE_BASE_URL),
      'process.env.TAVILY_API_KEY': JSON.stringify(env.TAVILY_API_KEY),
      'process.env.TAVILY_PROJECT_ID': JSON.stringify(env.TAVILY_PROJECT_ID),
      'process.env.TAVILY_SEARCH_DEPTH': JSON.stringify(env.TAVILY_SEARCH_DEPTH),
      'process.env.TAVILY_MAX_RESULTS': JSON.stringify(env.TAVILY_MAX_RESULTS),
      'process.env.TAVILY_TOPIC': JSON.stringify(env.TAVILY_TOPIC),
      'process.env.TAVILY_INCLUDE_ANSWER': JSON.stringify(env.TAVILY_INCLUDE_ANSWER),
      'process.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY),
      'process.env.DEEPSEEK_MODEL': JSON.stringify(env.DEEPSEEK_MODEL),
      'process.env.DEEPSEEK_BASE_URL': JSON.stringify(env.DEEPSEEK_BASE_URL),
      'process.env.GLM_API_KEY': JSON.stringify(env.GLM_API_KEY),
      'process.env.GLM_MODEL': JSON.stringify(env.GLM_MODEL),
      'process.env.GLM_BASE_URL': JSON.stringify(env.GLM_BASE_URL),
      'process.env.MOONSHOT_API_KEY': JSON.stringify(env.MOONSHOT_API_KEY),
      'process.env.MOONSHOT_MODEL': JSON.stringify(env.MOONSHOT_MODEL),
      'process.env.MOONSHOT_BASE_URL': JSON.stringify(env.MOONSHOT_BASE_URL),
      'process.env.IFLOW_API_KEY': JSON.stringify(env.IFLOW_API_KEY),
      'process.env.IFLOW_MODEL': JSON.stringify(env.IFLOW_MODEL),
      'process.env.IFLOW_BASE_URL': JSON.stringify(env.IFLOW_BASE_URL),
      'process.env.MINIMAX_API_KEY': JSON.stringify(env.MINIMAX_API_KEY),
      'process.env.MINIMAX_MODEL': JSON.stringify(env.MINIMAX_MODEL),
      'process.env.MINIMAX_BASE_URL': JSON.stringify(env.MINIMAX_BASE_URL),
      'process.env.MINIMAX_PROXY_PORT': JSON.stringify(env.MINIMAX_PROXY_PORT),
      'process.env.CATFLASH_PROXY_TOKEN': JSON.stringify(env.CATFLASH_PROXY_TOKEN),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'apps/renderer'),
      },
    },
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            genai: ['@google/genai'],
            icons: ['lucide-react'],
            utils: ['uuid'],
          },
        },
      },
    },
  };
});
