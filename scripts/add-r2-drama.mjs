#!/usr/bin/env node
/**
 * 登记一部新剧并同步 R2 分集。
 *
 * 用法：
 *   npm run add:drama -- 11
 *   npm run add:drama -- 11 "My Drama Title"
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(root, 'public/functions/data/r2-catalog.json');

const [id, ...titleParts] = process.argv.slice(2).map((s) => String(s).trim()).filter(Boolean);

if (!id) {
  console.error('用法: npm run add:drama -- <id> [title]');
  console.error('示例: npm run add:drama -- 11 "Season Eleven"');
  process.exit(1);
}

const title = titleParts.join(' ').trim() || id;
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
catalog.dramas = Array.isArray(catalog.dramas) ? catalog.dramas : [];

let drama = catalog.dramas.find((d) => String(d.id) === id);
if (drama) {
  drama.title = title;
  console.info(`已更新 id=${id} 标题为 "${title}"`);
} else {
  drama = {
    id,
    title,
    start: 1,
    end: 1,
    tagline: 'Hosted on Cloudflare R2',
    cover: `/image/${id}.jpg`,
    episode_count: 1,
  };
  catalog.dramas.push(drama);
  console.info(`已登记新剧 id=${id} title="${title}"`);
}

catalog.dramas.sort((a, b) => Number(a.id) - Number(b.id) || String(a.id).localeCompare(String(b.id)));
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

execSync(`node scripts/sync-r2-episodes.mjs --no-discover ${id}`, {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});

console.info('完成。请执行 npm run deploy 发布到线上。');
