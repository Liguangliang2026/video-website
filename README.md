# Short Dramas (Vue 3 + Cloudflare Pages)

前端为 **Vue 3 + Vite + Vue Router**，构建产物输出到 `public/`。  
后端 API 仍为 **Cloudflare Pages Functions**，路径不变：`public/functions/api/**`。

## 目录结构

| 路径 | 说明 |
|------|------|
| `src/` | Vue 源码 |
| `index.html` | Vite 入口 |
| `public/functions/` | Cloudflare Functions（勿改路由结构） |
| `cf-static/_redirects` | SPA 回退（构建时复制到 `public/`） |
| `legacy-static/` | 迁移前的静态 HTML 备份 |

## 开发

`npm run dev` **只启动 Vue 前端**（5173），不会执行 `public/functions` 里的 Cloudflare Functions。  
若只开前端、未开 API，访问 `/api/*` 会 **502**（Vite 代理连不上 8788）。

### 方式 A：本地跑完整 API（推荐联调剧星）

**终端 1** — Functions（8788）：

```bash
cp .dev.vars.example .dev.vars   # 填入 DRAMA_APP_ID 等，与线上一致
npm run dev:api
```

**终端 2** — 前端（5173）：

```bash
npm run dev
```

Functions 只在 **`public/functions/`**（不要建根目录 `functions` 符号链接，否则 `npm run deploy` 可能报 `functionsWorker-*.js` 找不到）。

### 方式 B：直接代理到线上（最省事）

```bash
cp .env.example .env
# 编辑 .env：VITE_API_PROXY=https://creativevideo.net
npm run dev
```

无需 wrangler，但依赖线上环境与域名可访问。

## 部署（Wrangler 直传，不用 Git）

### 1. 构建并发布（目录必须是 `public`，不要 `deploy .`）

```bash
npm run deploy
```

等价于：

```bash
npm run build
wrangler pages deploy . --project-name=creativevideo --cwd=public
```

**必须在 `public/` 目录下发布**（或 `--cwd=public`），这样才会上传 `public/functions/`。  
若用 `wrangler pages deploy public`（在仓库根目录执行），**只会传静态页，不会传 Functions**，`/api/*` 会返回 HTML，前端报 `Unexpected token '<'`。

| 错误做法 | 原因 |
|----------|------|
| `wrangler pages deploy .` | 根目录 `index.html` 是 Vite 开发入口，未包含构建后的 `assets/`，前端会坏 |
| 不先 `npm run build` | `public/index.html` / `public/assets/` 是旧的或不存在 |

发布目录 `public/` 内应同时有：`index.html`、`assets/`、`functions/`、`_redirects`。

### 2. 环境变量（`wrangler.toml` + 加密 Secret）

本项目在 Cloudflare 上启用了 **`wrangler.toml` 管理变量**，因此：

| 类型 | 在哪里配 |
|------|----------|
| **明文**（`DRAMA_BASE_URL`、`R2_PUBLIC_BASE`） | 编辑仓库根目录 **`wrangler.toml`** 的 `[vars]`，保存后 `npm run deploy` |
| **密钥**（`DRAMA_APP_ID`、`DRAMA_APP_SECRET`） | **仪表板** → creativevideo → Environment variables → 添加 **加密** 变量，或命令行 `wrangler pages secret put` |

**1）改 `wrangler.toml`（明文，按你的真实值修改）：**

```toml
[vars]
DRAMA_BASE_URL = "https://open-api.zjchjc.cn"
R2_PUBLIC_BASE = "https://pub-你的id.r2.dev"
```

**2）补密钥（若还没有 `DRAMA_APP_ID`）：**

```bash
wrangler pages secret put DRAMA_APP_ID --project-name=creativevideo
# DRAMA_APP_SECRET 仪表板里若已有可跳过
npm run deploy:secrets   # 查看已配置的 Secret
```

**3）重新部署：**

```bash
npm run deploy
```

本地开发仍可用 `.dev.vars`（`npm run dev:api`），与线上 `wrangler.toml` 互不影响。

### deploy 报错 `functionsWorker-*.js` 找不到

1. 删除仓库根目录的 `functions` 符号链接（若存在）：`rm -f functions`
2. 清理缓存：`rm -rf .wrangler ~/Documents/.wrangler`
3. 升级 wrangler：`npm install wrangler@latest -D`
4. 再执行 `npm run deploy`

剧星 + R2 合并接口说明见 [public/API-CATALOG.md](public/API-CATALOG.md)。  
除 `DRAMA_*` 外还需配置 **`R2_PUBLIC_BASE`**（R2 公网域名，与旧版 player 里 `R2_BASE` 相同）。

### 3. 部署后检查

```bash
curl -s https://creativevideo.net/api/drama/config-check
curl -s "https://creativevideo.net/api/drama/list?page=1&page_size=5"
```

`config-check` 里三项 `configured` 均为 `true` 后，列表接口应返回 `code: 0`。

更多说明见 [public/API-DRAMA.md](public/API-DRAMA.md)。

## 路由

| 路径 | 页面 |
|------|------|
| `/` | 首页（轮播 + 剧列表） |
| `/drama/:videoId` | 剧集详情 |
| `/vip` | 会员订阅（示例） |
