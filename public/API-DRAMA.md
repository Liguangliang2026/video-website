# 剧星代理接口说明（Cloudflare Pages Functions）

站点根路径下的 **同源** 接口，由 `public/functions/api/drama/*.js` 实现。浏览器或客户端只需访问本站 URL；**`app_id`、`app_secret`、`sign`、`timestamp` 均在服务端拼接**，不会出现在浏览器地址栏。

## 环境变量（Cloudflare Production）

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DRAMA_BASE_URL` | 是 | 剧星开放域名，如 `https://open-api.zjchjc.cn`（无末尾 `/`） |
| `DRAMA_APP_ID` | 是 | 运营下发 |
| `DRAMA_APP_SECRET` | 是 | 运营下发；建议 Dashboard 用 **密钥** 类型 |
| `DRAMA_AES_KEY` | 仅回调 | `POST /api/drama/callback` 解密用 |
| `DRAMA_AES_IV` | 仅回调 | 同上 |
| `DRAMA_EXPIRE_OFFSET_SEC` | 否 | 剧集/素材 `expire_time = timestamp + 该秒数`，默认 `86400`，最大 `259200` |
| `DRAMA_SKIP_EXPIRE_TIME` | 否 | 设为 `1` / `true` / `yes` 时不传 `expire_time`（走剧星默认 +1 天） |

说明：Dashboard 里 **纯文本 / 密钥** 只影响展示与安全；`timestamp` 由代码生成，**不是**从环境变量读整数。

---

## 接口列表

### 1. 剧列表

- **URL**：`GET /api/drama/list`
- **查询参数**（均可选；未传时由服务端带默认值请求剧星）：
  - `page`：正整数，默认 `1`
  - `page_size`：正整数，默认 `10`，最大 `50`
  - `video_id`：正整数字符串，剧星筛选项
  - `master_video_id`：正整数字符串
  - `update_time_start` / `update_time_end`：Unix 时间戳数字字符串
- **对应剧星**：`GET /api/open/video/list`

### 2. 剧单列表

- **URL**：`GET /api/drama/menu-list`
- **查询参数**：无
- **对应剧星**：`GET /api/open/video/menu/list`

### 3. 剧集列表（分集 + 播放签名等）

- **URL**：`GET /api/drama/episode-list?video_id={数字}`
- **参数**：`video_id` 必填，正整数（与列表返回的 `video_id` 一致）
- **行为**：默认带 `expire_time`（与本次 `timestamp` 同源，`timestamp + DRAMA_EXPIRE_OFFSET_SEC`）；若剧星返回 `10028`，会自动 **再请求一次不传 `expire_time`**
- **对应剧星**：`GET /api/open/video/episode/list`

### 4. 素材列表

- **URL**：`GET /api/drama/material-list?video_id={数字}`
- **参数**：同剧集列表
- **行为**：同剧集列表（含 `expire_time` 与 `10028` 重试）
- **对应剧星**：`GET /api/open/video/material/list`

### 5. 回调解密

- **URL**：`POST /api/drama/callback`
- **Body**：JSON，字段 `data` 或 `encrypt_data` 为 Base64 密文
- **依赖**：`DRAMA_AES_KEY`、`DRAMA_AES_IV`

---

## 线上完整 URL 示例

生产域名以 `https://creativevideo.net` 为例：

| 用途 | URL |
|------|-----|
| 剧列表 | `https://creativevideo.net/api/drama/list` |
| 剧单 | `https://creativevideo.net/api/drama/menu-list` |
| 剧集 | `https://creativevideo.net/api/drama/episode-list?video_id=32582` |
| 素材 | `https://creativevideo.net/api/drama/material-list?video_id=32582` |

---

## 本地联调（直连剧星）

仓库内 `drama-api-demo/`：`npm run list`、`npm run episode -- <video_id>`，使用 `.env` 中同一套变量验证签名与剧星返回。

---

## 部署

本项目通过 **Cloudflare Pages** 与 Git 关联部署。修改 `public/` 或 Functions 后需 **推送仓库** 并在 Dashboard 确认 **Production** 构建成功；仅改环境变量时，保存后建议 **重试部署** 一次。

### Wrangler 直传（`creativevideo`）

```bash
npm run build
wrangler pages deploy . --project-name=creativevideo --cwd=public
```

勿在仓库根目录使用 `wrangler pages deploy public`（不会部署 Functions，`/api` 会返回 HTML）。  
环境变量用 `wrangler pages secret put … --project-name=creativevideo` 或 Dashboard 配置，**不会**读本地 `.dev.vars`。

### 环境变量（必做）

剧星代理 **不会** 读取 `.env` / `.dev.vars` 文件；线上在 Cloudflare 项目 **creativevideo** 配置：

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → 你的站点（如 `creativevideo.net`）
2. **Settings** → **Environment variables**
3. 选择 **Production**（不是 Preview）
4. 添加（名称必须完全一致）：

| 变量名 | 说明 |
|--------|------|
| `DRAMA_BASE_URL` | 如 `https://open-api.zjchjc.cn`（无末尾 `/`） |
| `DRAMA_APP_ID` | 运营下发 |
| `DRAMA_APP_SECRET` | 建议类型选 **Secret** |

5. 保存后进入 **Deployments** → 最新 Production 部署 → **Retry deployment**

### 部署后自检

```text
GET https://你的域名/api/drama/config-check
```

返回 `configured` 三项均为 `true` 且 `code: 0` 后，再访问 `/api/drama/list`。

若 `list` 仍报 `code: -1` 且 `Server misconfiguration: set DRAMA_APP_ID...`，说明 **Production 环境变量未生效**，请核对变量名、环境（Production）并重新部署。

### Git 仓库需包含

推送前确认已提交：`public/functions/`、`package.json`、`src/`、`vite.config.js` 等。未提交 `public/functions` 时，线上可能只有静态页、或沿用旧 Functions 且无环境变量。
