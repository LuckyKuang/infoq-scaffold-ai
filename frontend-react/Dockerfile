# syntax=docker/dockerfile:1.7
# 从仓库根 context 构建；生产秘密仅通过 BuildKit secret 挂载。
FROM node:24.18.0 AS builder

LABEL maintainer="Pontus"

WORKDIR /infoq/react

RUN corepack enable pnpm

COPY frontend-react/package.json frontend-react/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --network-concurrency=2

# 允许在构建镜像时覆盖 Vite 生产环境变量
ARG VITE_APP_CONTEXT_PATH=/
ARG VITE_APP_BASE_API=/prod-api
ARG VITE_APP_PORT=80

ENV VITE_APP_CONTEXT_PATH=${VITE_APP_CONTEXT_PATH} \
    VITE_APP_BASE_API=${VITE_APP_BASE_API} \
    VITE_APP_PORT=${VITE_APP_PORT} \
    CI=true \
    NODE_OPTIONS=--max-old-space-size=1280

COPY frontend-react/ ./
COPY tools/production_config.mjs /infoq/tools/production_config.mjs
COPY tools/production_config.d.mts /infoq/tools/production_config.d.mts
COPY deploy/bin/render-gateway.mjs /infoq/deploy/bin/render-gateway.mjs

# 自动生成的浏览器配置摘要参与 RUN 缓存；绝不通过 ARG 传密钥。
ARG INFOQ_FRONTEND_CONFIG_DIGEST
RUN --mount=type=secret,id=production_config,required=true \
    INFOQ_FRONTEND_CONFIG_DIGEST=${INFOQ_FRONTEND_CONFIG_DIGEST} \
    INFOQ_PRODUCTION_CONFIG_FILE=/run/secrets/production_config pnpm run build:prod

# 运行阶段：使用 nginx 1.30.3 构建
FROM nginx:1.30.3

ENV TZ=Asia/Shanghai \
    NGINX_PORT=80

RUN ln -snf /usr/share/zoneinfo/${TZ} /etc/localtime \
    && echo ${TZ} > /etc/timezone

COPY --from=builder /infoq/react/dist/ /usr/share/nginx/html/

# 默认容器监听 80，部署时可通过 -e NGINX_PORT=8081 -p 8081:8081 覆盖
EXPOSE 80

CMD ["sh", "-c", "printf '%s\n' 'server {' \"    listen ${NGINX_PORT};\" '    server_name _;' '    root /usr/share/nginx/html;' '    index index.html;' '' '    location / {' '        try_files $uri $uri/ /index.html;' '    }' '}' > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
