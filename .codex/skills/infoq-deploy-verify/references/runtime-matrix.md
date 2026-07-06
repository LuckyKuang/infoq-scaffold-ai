# 免费商用容器运行时矩阵

## 默认支持范围

本 skill 只默认使用三类免费商用基线运行时：

| 场景 | 默认运行时 | 许可/边界 | 部署根目录建议 |
| --- | --- | --- | --- |
| Windows + WSL2 Debian/Ubuntu | WSL2 子系统内安装 Docker CE / Moby Engine | 使用 Linux 内 Docker Engine，不依赖 Docker Desktop | `/infoq` |
| macOS | Colima + Docker runtime + Docker CLI / Compose | Colima 为 MIT；底层 Lima 为 Apache-2.0；不默认使用 Docker Desktop | `$HOME/infoq`，除非用户显式配置 `/infoq` 可挂载 |
| 原生 Linux 服务器 | Docker CE / Moby Engine | Moby/Docker Engine 使用 Apache-2.0 基线 | `/infoq` |

说明：这里不是法律意见。执行前按当前安装来源和组织政策复核许可；skill 的默认策略是避开 Docker Desktop、商业桌面 GUI 或许可不明确的运行时。

## 运行时选择流程

1. 先执行只读探测：

```bash
uname -s
uname -r
docker version
docker compose version || docker-compose version
docker context ls || true
docker context show || true
docker info --format '{{.OperatingSystem}} | {{.ServerVersion}} | {{.Name}}' || true
```

2. 如果是 WSL2：

```bash
grep -qi microsoft /proc/version && echo wsl2
systemctl is-active docker || service docker status || true
```

要求 `docker info` 能连到 WSL2 内 Docker daemon。不要把 Windows Docker Desktop 暴露进来的 context 当作默认合规路径。

3. 如果是 macOS：

```bash
uname -s
command -v colima
colima status || colima start --runtime docker --cpu 4 --memory 8 --disk 80
docker context use colima
docker info
docker compose version
```

要求当前 Docker context 是 `colima`，且 Compose 可用。macOS 默认 `INFOQ_DEPLOY_ROOT=$HOME/infoq`，因为 Colima 默认更容易挂载用户 home；只有用户明确配置并验证 `/infoq` 可被 Colima VM 挂载时才使用 `/infoq`。

4. 如果是原生 Linux：

```bash
uname -s
systemctl is-active docker || service docker status || true
docker info
docker compose version || docker-compose version
```

要求 Docker daemon 为本机 Docker CE/Moby Engine 路径，并且当前用户有权限执行 Docker 命令。

## 必须停止并询问的情况

- `docker context show` 或 `docker info` 显示 Docker Desktop，且用户没有明确允许使用它。
- 运行时是 Rancher Desktop、Podman、OrbStack 或其他未在本矩阵列出的方案。
- macOS Colima 未安装，且用户没有授权安装依赖。
- Docker Compose 不可用。
- `/tmp/infoq-deploy` 或 `${INFOQ_DEPLOY_ROOT}/server/temp` 无法创建。
- 端口 `80/443/3306/6379/9000/9001/9090/9091/9092/9093` 被占用且用户未授权调整。

## 部署根目录规则

始终显式设置 `INFOQ_DEPLOY_ROOT`，不要依赖脚本自动判断。

WSL2 / 原生 Linux：

```bash
export INFOQ_DEPLOY_ROOT=/infoq
mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"
```

macOS Colima：

```bash
export INFOQ_DEPLOY_ROOT="${HOME}/infoq"
mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"
```

如果用户要求生产化路径 `/infoq`，先验证 Colima mount：

```bash
mkdir -p /infoq/server/temp
docker run --rm -v /infoq:/infoq alpine:3.20 sh -lc 'test -d /infoq/server/temp && echo ok'
```

验证失败时，回到 `$HOME/infoq` 或请用户调整 Colima mount 配置。

## 统一部署命令模板

```bash
cd /path/to/infoq-scaffold-ai
export INFOQ_DEPLOY_ROOT=<runtime-specific-root>
mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"
export SECURITY_TOKEN_SECRET=<at-least-32-chars>
bash script/bin/infoq.sh deploy
bash script/bin/deploy-frontend.sh deploy
```

后续 smoke 命令与 `wsl2-docker-compose.md` 相同。