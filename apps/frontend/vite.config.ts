import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// 代理目标支持用环境变量覆盖（默认 4000），避免把某台机器的端口写死进仓库。
// 本机专属取值放在 apps/frontend/.env.local（已被 gitignore）。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    server: {
      port: 3000,
      allowedHosts: ['lmd.corvinyu.icu'],
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
  };
});
