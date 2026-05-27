#!/usr/bin/env node
/**
 * 扫描 R2 上 video/{剧目id}/ 下的 mp4，按文件名 ep 集号生成 r2-episode-manifests.json，
 * 并回写 r2-catalog.json 的 end / episode_count。
 *
 * 用法：
 *   npm run sync:r2-episodes              # 扫描目录里全部剧目 + 自动发现 R2 新 id
 *   npm run sync:r2-episodes -- 11 12     # 只同步指定 id
 *   npm run sync:r2-episodes -- --no-discover 11
 *
 * 认证（任选其一）：
 *   - 本机已 wrangler login
 *   - CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseEpisodeNumberFromFilename,
  episodeTitleFromFilename,
  parseSeriesTitleFromFilename,
} from '../public/functions/api/catalog/r2-episodes.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(root, 'public/functions/data/r2-catalog.json');
const manifestPath = path.join(root, 'public/functions/data/r2-episode-manifests.json');
const imageDir = path.join(root, 'public/image');

const bucket = process.env.R2_BUCKET?.trim() || 'video-bucket';
const accountId =
  process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
  process.env.CF_ACCOUNT_ID?.trim() ||
  '';

const argv = process.argv.slice(2);
const noDiscover = argv.includes('--no-discover');
const onlyIds = argv.filter((s) => s !== '--no-discover').map((s) => String(s).trim()).filter(Boolean);

function loadWranglerOAuthToken() {
  const cfg = path.join(process.env.HOME || '', '.wrangler/config/default.toml');
  if (!cfg || !existsSync(cfg)) return '';
  const raw = readFileSync(cfg, 'utf8');
  const m = raw.match(/^oauth_token\s*=\s*"([^"]+)"/m);
  return m?.[1]?.trim() || '';
}

async function resolveAuth() {
  const token =
    process.env.CLOUDFLARE_API_TOKEN?.trim() ||
    process.env.CF_API_TOKEN?.trim() ||
    loadWranglerOAuthToken();
  if (!token) {
    console.error('需要 CLOUDFLARE_API_TOKEN 或先执行 wrangler login');
    process.exit(1);
  }
  let account = accountId;
  if (!account) {
    try {
      const { execSync } = await import('node:child_process');
      const out = execSync('npx wrangler whoami 2>/dev/null', {
        encoding: 'utf8',
        cwd: root,
      });
      const m =
        out.match(/([a-f0-9]{32})/) ||
        out.match(/Account ID[^\n]*\n[^\n]*\n[^\n]*\|\s*([a-f0-9]+)/i);
      account = m?.[1] || '';
    } catch {
      /* ignore */
    }
  }
  if (!account) {
    console.error('请设置 CLOUDFLARE_ACCOUNT_ID 或确保 wrangler whoami 可用');
    process.exit(1);
  }
  return { token, account };
}

async function listR2Prefix(token, account, prefix) {
  const keys = [];
  let cursor;
  do {
    const params = new URLSearchParams({ prefix, limit: '1000' });
    if (cursor) params.set('cursor', cursor);
    const url = `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucket}/objects?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.errors?.[0]?.message || JSON.stringify(data.errors) || res.statusText);
    }
    const result = data.result;
    const objects = Array.isArray(result) ? result : result?.objects || [];
    for (const o of objects) {
      const key = typeof o === 'string' ? o : o?.key;
      if (key) keys.push(key);
    }
    const info = data.result_info || {};
    cursor = info.is_truncated ? info.cursor : undefined;
  } while (cursor);
  return keys;
}

function sortDramaIds(ids) {
  return [...ids].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  });
}

async function discoverR2DramaIds(token, account) {
  const keys = await listR2Prefix(token, account, 'video/');
  const ids = new Set();
  for (const key of keys) {
    const m = key.match(/^video\/([^/]+)\/.+\.mp4$/i);
    if (m) ids.add(m[1]);
  }
  return sortDramaIds(ids);
}

function defaultDramaEntry(id) {
  const sid = String(id);
  const coverFile = path.join(imageDir, `${sid}.jpg`);
  return {
    id: sid,
    title: sid,
    start: 1,
    end: 1,
    tagline: 'Hosted on Cloudflare R2',
    cover: existsSync(coverFile) ? `/image/${sid}.jpg` : '',
    episode_count: 1,
  };
}

function sortCatalogDramas(dramas) {
  return [...dramas].sort((a, b) => {
    const na = Number(a.id);
    const nb = Number(b.id);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a.id).localeCompare(String(b.id));
  });
}

const auth = await resolveAuth();

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
catalog.dramas = Array.isArray(catalog.dramas) ? catalog.dramas : [];

if (!onlyIds.length && !noDiscover) {
  console.info(`发现 R2 桶 ${bucket} 下 video/*/ …`);
  const discovered = await discoverR2DramaIds(auth.token, auth.account);
  const byId = new Map(catalog.dramas.map((d) => [String(d.id), d]));
  let added = 0;
  for (const id of discovered) {
    if (!byId.has(id)) {
      const entry = defaultDramaEntry(id);
      catalog.dramas.push(entry);
      byId.set(id, entry);
      added += 1;
      console.info(`  新增目录 id=${id}（标题默认 "${entry.title}"，可在 r2-catalog.json 改 title）`);
    }
  }
  if (!added) console.info('  无新剧目，将刷新已有条目分集清单');
}

const targetIds = onlyIds.length ? onlyIds : catalog.dramas.map((d) => String(d.id));
const dramas = catalog.dramas.filter((d) => targetIds.includes(String(d.id)));

const manifests = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : {};

for (const drama of dramas) {
  const id = String(drama.id);
  const prefix = `video/${id}/`;
  console.info(`扫描 ${bucket}/${prefix} …`);
  let objects;
  try {
    objects = await listR2Prefix(auth.token, auth.account, prefix);
  } catch (e) {
    console.warn(`  跳过 ${id}:`, e.message);
    continue;
  }

  /** @type {Map<number, string>} */
  const byEp = new Map();
  for (const key of objects) {
    const file = key.split('/').pop() || '';
    if (!/\.mp4$/i.test(file)) continue;
    const ep = parseEpisodeNumberFromFilename(file);
    if (!ep) {
      console.warn(`  无法解析集号: ${file}`);
      continue;
    }
    const prev = byEp.get(ep);
    if (!prev || file.length > prev.length) byEp.set(ep, file);
  }

  const entries = [...byEp.entries()].sort((a, b) => a[0] - b[0]);
  manifests[id] = entries.map(([ep, file]) => ({
    episode_index: ep,
    file,
    episode_title: episodeTitleFromFilename(file, ep),
  }));

  if (entries.length) {
    const maxEp = entries[entries.length - 1][0];
    drama.start = 1;
    drama.end = maxEp;
    drama.episode_count = entries.length;
    delete drama.prefix;
    if (!drama.cover) drama.cover = `/image/${id}.jpg`;
    const sid = String(drama.id);
    const currentTitle = String(drama.title ?? '').trim();
    if (!currentTitle || currentTitle === sid) {
      const ep1 = entries.find(([ep]) => ep === 1)?.[1] || entries[0][1];
      const parsed = parseSeriesTitleFromFilename(ep1);
      if (parsed && parsed !== sid) drama.title = parsed;
    }
    console.info(`  id=${id}: ${entries.length} 集 (1–${maxEp}) «${drama.title}»`);
  } else {
    console.warn(`  id=${id}: 未找到 mp4`);
  }
}

catalog.dramas = sortCatalogDramas(catalog.dramas);

writeFileSync(manifestPath, `${JSON.stringify(manifests, null, 2)}\n`);
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.info('已写入', manifestPath);
console.info('已更新', catalogPath);
console.info('下一步: npm run deploy');
