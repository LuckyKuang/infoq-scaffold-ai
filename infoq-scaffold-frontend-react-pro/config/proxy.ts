const baseApi = process.env.VITE_APP_BASE_API || '/dev-api';
const proxyTarget =
  process.env.VITE_APP_PROXY_TARGET || 'http://127.0.0.1:8080';

const createAdminProxy = () => ({
  [baseApi]: {
    target: proxyTarget,
    changeOrigin: true,
    ws: true,
    pathRewrite: { [`^${baseApi}`]: '' },
  },
});

export default {
  dev: createAdminProxy(),
  test: createAdminProxy(),
  pre: createAdminProxy(),
};
