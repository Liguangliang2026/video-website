# 统一目录 API（R2 + 剧星）

同源聚合 **Cloudflare R2 自建剧** 与 **剧星第三方剧**，前端只调 `/api/catalog/*`。

## 环境变量

| 变量 | 用途 |
|------|------|
| `DRAMA_*` | 剧星列表/分集（见 API-DRAMA.md） |
| `R2_PUBLIC_BASE` | R2 公网域名，如 `https://pub-xxx.r2.dev`（无末尾 `/`） |

| 变量 | 配置方式 |
|------|----------|
| `DRAMA_BASE_URL`、`R2_PUBLIC_BASE` | `wrangler.toml` → `[vars]`（明文） |
| `DRAMA_APP_ID`、`DRAMA_APP_SECRET` | 仪表板 **加密变量**，或 `wrangler pages secret put` |

启用 `wrangler.toml` 后，仪表板 **不能** 再添加普通文本变量，只能加加密 Secret。

## R2 剧目配置

视频路径：`{R2_PUBLIC_BASE}/video/{剧目id}/任意文件名.mp4`  
文件名须含 **ep + 集号**（如 `reelshort-ep03-Episode 3.mp4`）。

封面：`public/image/{id}.jpg`（如 `11.jpg`）。

### 短剧描述（简介）

| 配置位置 | 字段名 | API / 前端 |
|----------|--------|------------|
| `public/functions/data/r2-catalog.json` | **`description`** 或 **`tagline`** | 列表卡片、`/series/r2/{id}` 详情页 Synopsis |
| 剧星第三方剧 | 接口自带 `recommendation` / `introduce` | 同上 |

R2 示例（改 `tagline` 或改用 `description` 均可）：

```json
{
  "id": "11",
  "title": "Genius Baby Gets Daddy Back",
  "description": "A single mother returns with her genius son to reclaim everything she lost.",
  "cover": "/image/11.jpg",
  "episode_count": 67
}
```

**不能**在 Cloudflare 仪表板里按剧填写描述（没有每部剧的表单）。描述写在上述 JSON 文件里，然后 `npm run deploy` 发布。仪表板只适合配 `RESEND_API_KEY`、`DRAMA_APP_ID` 等环境变量。

### 上新剧（11、12…）推荐流程

```bash
# 1. R2 上传 video/11/*.mp4，本地放 public/image/11.jpg

# 2. 登记 + 扫描分集（二选一）
npm run add:drama -- 11 "正式剧名"
# 或：已有多部时一次性发现 R2 上所有 video/*/ 并刷新
npm run sync:r2-episodes

# 3. 发布（必做，否则线上列表不变）
npm run deploy
```

**线上列表会自动发现**：已绑定 `R2_VIDEOS` 时，`GET /api/catalog/list` 会扫描桶内 `video/{id}/*.mp4`，无需先改 JSON 再 deploy 也能出现 11、12…（标题默认为 id，封面 `/image/{id}.jpg`）。改剧名仍建议写入 `r2-catalog.json` 后 deploy，或跑 sync。

本地维护清单（可选，加速分集回退）：`sync:r2-episodes` 会合并 R2 新 id 到 `r2-catalog.json`。

分集列表解析顺序：

1. **线上**：`R2_VIDEOS` 运行时 `list` 桶内 `video/{id}/`
2. **清单**：`r2-episode-manifests.json`（由 sync 脚本生成）
3. **旧版**：`r2-catalog.json` 的 `prefix` + `start`/`end`

## 接口

### 合并列表（首页）

`GET /api/catalog/list?page=1&page_size=10`

- 第 1 页：**先 R2 全部条目**，剩余槽位为剧星第 1 页
- 第 2 页起：剧星分页
- `?source=r2` 或 `?source=drama` 仅返回单一来源

### 剧集元信息

`GET /api/catalog/meta?source=r2&id=1`  
`GET /api/catalog/meta?source=drama&id=32582`

### 分集播放地址

`GET /api/catalog/episodes?source=r2&id=1`  
`GET /api/catalog/episodes?source=drama&id=32582`

R2 分集 `play_url` 为完整 MP4 URL；剧星为第三方签名 URL。

## 前端路由

| 路径 | 说明 |
|------|------|
| `/` | 合并列表 |
| `/series/r2/1` | R2 剧详情 |
| `/series/drama/32582` | 剧星剧详情 |
| `/drama/32582` | 重定向到 `/series/drama/32582` |

原 `/api/drama/*` 保留，可直接调用。
