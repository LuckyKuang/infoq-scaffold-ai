<div align="center">

<img src="assets/logo.png" width="120" alt="InfoQ-Scaffold-AI Logo" />

# InfoQ-Scaffold-AI

[![CI](https://github.com/LuckyKuang/infoq-scaffold-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/LuckyKuang/infoq-scaffold-ai/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/Version-3.0.0--rc1-f66a39)
![JDK](https://img.shields.io/badge/JDK-21-1677FF)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1.1-6DB33F)
![Vue](https://img.shields.io/badge/Vue-3.5.35-42B883)
![React](https://img.shields.io/badge/React-19.2.7-61DAFB)
[![License](https://img.shields.io/badge/License-MIT-F7C948)](LICENSE)

**AI コラボレーション向けフルスタック・エンジニアリング・スキャフォールド**

[English](README.md) | [簡体字中国語](README_CN.md) | [繁體中文](README_ZH_TW.md) | 日本語

</div>

<!-- readme-section:notice -->
## 重要なお知らせ

本プロジェクトは技術学習、調査、テストを目的としています。利用前に非本番環境で
十分なテスト、検証、セキュリティ評価を行い、MIT ライセンスに従って使用、変更、
配布してください。本プロジェクトの利用に伴うリスク、データ損失、サービス停止は
利用者自身の責任で評価・負担してください。

<!-- readme-section:overview -->
## 概要

`infoq-scaffold-ai` は、AI コラボレーションのルール、実行可能な skill、OpenSpec、
アプリケーションコード、検証、デリバリー証跡を 1 つのリポジトリにまとめ、実行可能な
Spring Boot バックエンドと Vue / React の管理コンソールを提供します。

タスク計画はローカルに保存し、`docs/plan/` と `openspec/changes/` は Git の対象外です。
今後の実行計画も `docs/plan/` に記録し、必要に応じてディレクトリを作成します。
ローカル計画の削除はユーザーが手動で行います。

現在は 3 つのワークスペースを維持しています。

- `backend`：Spring Boot 4.1 マルチモジュール・バックエンド
- `frontend-vue`：Vue 3 + Element Plus 管理コンソール
- `frontend-react`：React 19 + Ant Design 管理コンソール

初期データベースには凍結ベースライン
[`sql/infoq_scaffold_3.0.0.sql`](sql/infoq_scaffold_3.0.0.sql) を使用します。以降の
スキーマまたはシードデータの変更は
`sql/infoq_scaffold_update_YYYYMMDD.sql` の増分スクリプトでのみ行ってください。

<!-- readme-section:features -->
## 主な機能

- JDK 21、MyBatis-Plus、Spring Security を基盤とする Spring Boot 4.1 バックエンド
- 同一のバックエンド API 契約を共有する 2 つの管理コンソール
- [`AGENTS.md`](AGENTS.md)、`skills`、OpenSpec による階層化されたデリバリーフロー
- 凍結 SQL ベースラインと日付別の増分スクリプト
- MySQL、Redis、MinIO、バックエンド、管理コンソールゲートウェイを Docker Compose でデプロイ
- Apple container、WSL2 Docker、Linux Docker の smoke チェックに対応するクロスプラットフォーム `deploy-cli`
- UTF-8、Maven、pnpm、管理コンソール E2E の検証入口

<!-- readme-section:quick-start -->
## クイックスタート

ログイン前に SQL ベースラインをインポートし、MySQL 8 と Redis 7 を起動してください。

### バックエンド

```bash
node tools/backend_mvn.mjs -- clean install -DskipTests
java -jar backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
```

既定の URL：`http://127.0.0.1:8080`。CAPTCHA：`http://127.0.0.1:8080/auth/code`。

### Vue 管理コンソール

```bash
cd frontend-vue
pnpm install
pnpm run dev
```

### React 管理コンソール

```bash
cd frontend-react
pnpm install
pnpm run dev
```

両方の管理コンソールは既定でポート `80` を使用します。同時に起動する場合は、
どちらかの `VITE_APP_PORT` を変更してください。ローカル開発の詳細は
[`DEV_GUIDE.md`](DEV_GUIDE.md) を参照してください。各例はリポジトリのルートから
個別に実行します。無視対象の backend local 設定を先に準備し、`VITE_APP_ENCRYPT=true`
ではバックエンドと対応する RSA 公開鍵・秘密鍵の環境変数を指定してください。

管理コンソールのルート smoke または CAPTCHA ログインには skill を使用します。

```bash
# CAPTCHA E2E はシード回答をバックエンドの Redis に書き込みます。
# 先に INFOQ_TEST_REDIS_HOST/PORT/DATABASE/PASSWORD（必要に応じて TLS）を設定してください。
node skills/test-cli/scripts/run_admin_e2e.mjs --client vue --route-limit 1
node skills/test-cli/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --json

# 先に対象ランタイムの環境ファイルを準備します。deploy/README.md を参照。
# デプロイ状態：macOS は Apple、Linux/WSL2 は Docker を選択
node skills/deploy-cli/scripts/deploy_cli.mjs status
```

<!-- readme-section:deployment -->
## デプロイ方法

| 方法 | ドキュメント |
| --- | --- |
| Linux インストールスクリプト | [デプロイガイド](deploy/README.md) |
| Docker Compose | [Docker ガイド](deploy/DOCKER.md) |
| Apple container | [Apple container](deploy/APPLE_CONTAINER.md) |
| デプロイライフサイクル | [デプロイライフサイクル](deploy/DEPLOYMENT_LIFECYCLE.md) |
| Compose 環境テンプレート | [.env.example](deploy/.env.example) |
| 手動デプロイ | [手動デプロイ](deploy/MANUAL.md) |
| デプロイ前提条件 | [デプロイ前提条件](deploy/README.md) |

| プラットフォーム | フルスタック | 推奨方法 |
| --- | --- | --- |
| Linux | はい | Docker インストールスクリプト |
| Windows | はい | WSL2 Debian/Ubuntu + Docker CE |
| macOS | はい | Colima + Docker |
| macOS | いいえ、バックエンドのみ | Apple container |
| macOS | いいえ、バックエンド + 管理コンソール dev server | Apple container + `pnpm run dev` |

イメージはターゲットホスト上でソースからビルドされます。リポジトリはビルド済みの
アプリケーションイメージを公開していません。Docker パスではイメージ内でバックエンド
jar と管理コンソールの成果物をビルドし、Apple container パスではホスト上で jar を
作成してから、MySQL、Redis、バックエンド API のみを含むスタックを起動します
（Vue/React と Nginx ゲートウェイは含みません）。RC はソースアーカイブのみを
Pre-release として公開し、Latest には設定しません。対象環境の管理された設定を
使ってソースからビルドしてください。正式版は[管理されたビルド方針](docs/RELEASING.md)
に従って jar と管理コンソールの `dist` アーカイブを提供し、コンテナイメージは含みません。

```bash
# Linux / WSL2：確認済みの対象 release tag のソースからデプロイ
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_FRONTEND_TARGET=all \
  INFOQ_ENV_FILE=/absolute/private/production.env bash deploy/install.sh
```

`INFOQ_FRONTEND_TARGET` は必須です：`all`、`vue`、`react` のいずれかを指定します。
本番の基準は Linux Docker です。独立した認証情報、独立した二組の RSA 鍵、
アプリと専用 OSS ホスト名に対応する TLS 証明書を用意してください。管理された
設定は[環境テンプレート](deploy/.env.example)と[デプロイガイド](deploy/README.md)
に従って準備します。`all` の既定ルートは `/vue/`、`/react/`、`/console-oss/` です。
非公開 S3 URL は専用 OSS origin を使用し、署名されたパスを変更しません。
開発用 HTTP はモードを明示する必要があります。

管理画面の access token はメモリ内だけに保持します。再読み込み時は同一 origin の
CSRF 保護された HttpOnly cookie で復元し、React/Vue の scope を分離します。
`INFOQ_PUBLIC_BASE_URL`、`INFOQ_BROWSER_SESSION_COOKIE_PATH`、
`INFOQ_BROWSER_SESSION_SECURE`、`INFOQ_BROWSER_SESSION_TTL_SECONDS` と実際の
リバースプロキシの一致を確認してください。[本番設定](deploy/PRODUCTION.md)を参照してください。

リモートインストールはデプロイガイドに従い、tag を固定してダウンロード後に確認
してください。macOS Colima は shell スクリプトを使用し、Node CLI は macOS で Apple
を選択します。Apple `status` は daemon を起動する場合があります。本番では独立した
認証情報、ビルド鍵の一致、HTTPS、監視、検証済みのバックアップと復旧手順が必要です。
サンプル鍵やビルド成功だけでは本番運用の準備完了を意味しません。

<!-- readme-section:documentation -->
## ドキュメント

README はプロジェクト概要とクイックスタートのみを提供します。詳細な設定と保守は
以下のドキュメントを参照してください。

| ドキュメント | 説明 |
| --- | --- |
| [ドキュメントセンター](docs/README.md) | ユーザードキュメントのナビゲーション |
| [ドキュメント監査](docs/DOCUMENTATION-AUDIT.md) | 対象範囲、修正、検証、運用環境の未解決事項 |
| [コントリビューションガイド](CONTRIBUTING.md) | ツールチェーン、検証、PR フロー |
| [開発ガイド](DEV_GUIDE.md) | ローカル設定とトラブルシューティング |
| [セキュリティポリシー](SECURITY.md) | 脆弱性の報告 |
| [AGENTS.md](AGENTS.md) | リポジトリのコラボレーションルール |
| [デザインシステム](docs/DESIGN.md) | 管理コンソールのビジュアル言語 |
| [リリースプロセス](docs/RELEASING.md) | バージョン、tag、Release workflow、ロールバック |
| [CI 検証](docs/CI_VALIDATION.md) | ワークフローの範囲、dev/prod テストグループ、ローカルゲート、セキュリティスキャン |

## コミュニティ

[Linux DO](https://linux.do) コミュニティで infoq-scaffold-ai についてアイデアを
共有し、議論しましょう。

<!-- readme-section:license -->
## ライセンス

[MIT License](LICENSE)
