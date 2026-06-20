# 前端构建阶段：React Pro 需要 Node 22+
FROM node:22.13.1 AS builder

LABEL maintainer="Pontus"

WORKDIR /infoq/react-pro

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --network-concurrency=2

ARG VITE_APP_CONTEXT_PATH=/
ARG VITE_APP_BASE_API=/prod-api
ARG VITE_APP_PORT=80

ENV VITE_APP_CONTEXT_PATH=${VITE_APP_CONTEXT_PATH} \
    VITE_APP_BASE_API=${VITE_APP_BASE_API} \
    VITE_APP_PORT=${VITE_APP_PORT} \
    CI=true \
    NODE_OPTIONS=--max-old-space-size=1536

COPY . ./

RUN pnpm run build

FROM nginx:1.28.2

ENV TZ=Asia/Shanghai \
    NGINX_PORT=80

RUN ln -snf /usr/share/zoneinfo/${TZ} /etc/localtime \
    && echo ${TZ} > /etc/timezone

COPY --from=builder /infoq/react-pro/dist/ /usr/share/nginx/html/

EXPOSE 80

CMD ["sh", "-c", "printf '%s\n' 'server {' \"    listen ${NGINX_PORT};\" '    server_name _;' '    root /usr/share/nginx/html;' '    index index.html;' '' '    location / {' '        try_files $uri $uri/ /index.html;' '    }' '}' > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
