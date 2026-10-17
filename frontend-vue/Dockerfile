# 前端构建阶段：使用 Node 24.18.0 LTS 构建
FROM node:24.18.0 AS builder

LABEL maintainer="Pontus"

WORKDIR /infoq/vue

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

RUN pnpm install --frozen-lockfile --network-concurrency=2

# 允许在构建镜像时覆盖 Vite 生产环境变量
ARG VITE_APP_CONTEXT_PATH=/
ARG VITE_APP_BASE_API=/prod-api
ARG VITE_APP_PORT=80

ENV VITE_APP_CONTEXT_PATH=${VITE_APP_CONTEXT_PATH} \
    VITE_APP_BASE_API=${VITE_APP_BASE_API} \
    VITE_APP_PORT=${VITE_APP_PORT} \
    CI=true \
    NODE_OPTIONS=--max-old-space-size=1280 \
    VITE_BUILD_COMPRESS=none

COPY . ./

RUN pnpm run build:prod

# 运行阶段：使用 nginx 1.30.3 构建
FROM nginx:1.30.3

ENV TZ=Asia/Shanghai \
    NGINX_PORT=80

RUN ln -snf /usr/share/zoneinfo/${TZ} /etc/localtime \
    && echo ${TZ} > /etc/timezone

COPY --from=builder /infoq/vue/dist/ /usr/share/nginx/html/

# 默认容器监听 80，部署时可通过 -e NGINX_PORT=8081 -p 8081:8081 覆盖
EXPOSE 80

CMD ["sh", "-c", "printf '%s\n' 'server {' \"    listen ${NGINX_PORT};\" '    server_name _;' '    root /usr/share/nginx/html;' '    index index.html;' '' '    location / {' '        try_files $uri $uri/ /index.html;' '    }' '}' > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
