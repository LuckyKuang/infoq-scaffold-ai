# Colima 完整栈与隔离验收

Colima 是 macOS 完整 Docker 栈的兼容验证环境。生产基线仍为原生 Linux Docker；虚拟机实测不能证明生产域名、凭据来源、外部 Provider、告警接收、容量 SLO 或业务 RTO/RPO 已达标。

## 安装与独立目标

先记录当前 Docker context、Colima profile 和端口占用。使用本任务独立 profile，禁止接管同名既有实例或修改其它项目的容器、卷和网络。

```bash
brew install colima docker docker-compose docker-buildx
docker context show
colima list
colima start infoq-verify --runtime docker --cpu 6 --memory 8 --disk 30 --root-disk 15 --vm-type vz --mount-type virtiofs --activate=false --ssh-config=false
```

Homebrew 的 Compose/Buildx 需要 Docker CLI 插件发现。在保留 `~/.docker/config.json` 其它字段的前提下，将 `/opt/homebrew/lib/docker/cli-plugins`（Intel Homebrew 按实际 prefix）加入 `cliPluginsExtraDirs`。不得覆盖原 credentials/context 配置，也不默认启用开机服务。验证 `docker compose version` 和 `docker buildx version`，版本以实际输出留证；现代 Compose 插件版本可能大于 2，不能仅靠 major 判断是否支持 Compose specification。

本机 `docker --context colima-infoq-verify ...` 可用于只读检查；隔离运维工具要求 VM 内本机 Unix socket context，拒绝 `DOCKER_HOST` / `DOCKER_CONTEXT` 覆盖。

## VM 原生工作区

`colima ssh --profile infoq-verify -- ...` 进入 Ubuntu VM。先核 `/etc/os-release`、Docker daemon、Compose、Buildx、DNS、磁盘与端口；安装仓库规定的 Node.js 24.18.0、pnpm 10.34.1 及 test-cli Playwright/Chromium 依赖。Node 压缩包须核官方 SHA-256，不能把宿主 macOS 二进制复制后当 Linux 工具运行。

本轮环境出现以下需诊断的情况：

- Ubuntu 镜像 `/etc/resolv.conf` 指向缺失的 systemd-resolved 文件；确认服务/软件包状态后安装并启动 `systemd-resolved`，验证 registry 与 Maven/npm 解析，再重试构建。不要修改项目镜像版本来绕过 DNS。
- macOS VirtioFS 共享路径的 `fs.cpSync` 创建文件后返回 `EACCES`。验收工作副本和所有 bind 数据使用 VM 原生文件系统，真实源文件内容保持一致；不要通过 `0777` 或放宽安全校验绕过。

在 VM 的真实 home（`getent passwd` 核对，勿假设 `/home/<用户名>`）创建隔离工作副本。复制当前源码时排除 `.git`、宿主 `node_modules`、`target`、`dist`、`tmp` 等产物；按 lockfile 安装所需 Linux 依赖。工作副本内临时配置、证书、浏览器、备份与证据继续统一放 `tmp/`。VM 工作副本仅用于验证，修复必须同步回原仓库并留存 hash；禁止把含秘密的 VM `tmp/` 整体复制到公开资产。

## 全流程验收与收口

按 [生产运维 SOP](../docs/PRODUCTION-OPS.md#linux-docker-全栈验收) 在 VM 内先 preview，再显式 execute。四种真实镜像产物还须执行 test-cli OAuth/回跳用例。named volume 与首次生产 bind 初始化分开验证，首装步骤见 [PRODUCTION.md](PRODUCTION.md#首次部署的镜像用户与新目录)。`tools/verify/first_install_acceptance.mjs` 需要 VM 内 root，直接调用安装器并验证重启后的登录、SQL 与对象；默认预览，实际执行参数见其 `--help`。

所有测试使用独立随机凭据、两组 RSA 和测试证书；浏览器忽略测试 CA 的限制仅属于隔离夹具，Node TLS 探针仍核测试证书/主机。生产证书与账号不得混入本轮 fixture。

执行证据必须包含 runner 状态、镜像 ID、实际 daemon UID/GID、HTTP/业务断言、备份完整性、恢复与回滚、容器/卷/网络清理。失败也要核 owned 清理，禁止全局 `prune`。Colima 自身配置/磁盘由外部工具管理，安装产物不要求放仓库 `tmp/`。

2026-10-18 的 `colima-007` 已通过上述真实整栈检查，四种前端产物另通过 24 项路由/Provider 替身流程；`bind-first-003` 在 ext4 上直接首装并通过权限、读写、重启后 SQL/对象/登录持久性，两轮 cleanup 均为 `verified`。双端 A/B/B-warm 实际构建确认密钥轮换使缓存失效、相同输入命中缓存。另导出两端 builder/final 四镜像，核 OCI descriptor 与解压 layer 摘要，扫描全部 53 层、config/history 和 attestation，未发现本轮后端请求私钥（DER/Base64/PEM）及六类服务端 fixture 凭据。导出与原始配置保留在 VM 的受控 `tmp/`，宿主只取脱敏结果和截图。以上结论的环境、测试输入和生产边界保持独立。

固定客户端工具已改为官方固定 Release 二进制/SHA-256 的自建镜像，入口见 [生产配置](PRODUCTION.md)。额外实际执行 `download/upload/public` 三类 bucket 的 plan→migrate private→restore 原权限，对象 hash 保持，备份 `0600`，预览不改策略/不写备份。回读仅按已证实无序的 `Action` 集合比较，原始备份 checksum 与资源身份仍严格核验。

一次性验收完成后停止专用 VM，保留安装、证据和 owned 数据供复核；不要自动删除 profile 或生产/共享数据。宿主 Docker context 若曾切换则恢复原值：

```bash
colima stop --profile infoq-verify
docker context show
```

本轮结束已独立核验 19 个应用/浏览器测试端口可绑定、浏览器进程/容器/卷/owned 网络为零；专用 profile 状态为 `Stopped`，原宿主 context 仍为 `default`。安装和原生工作副本保留，未配置开机自启，未自动 commit/push。

长期本机开发部署应另用明确 profile 和受控部署配置，遵守 [部署生命周期](DEPLOYMENT_LIFECYCLE.md)，避免复用一次性验收数据。
