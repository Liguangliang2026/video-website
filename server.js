const http = require('http');
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif'
};

const server = createServer();
server.listen(8000, '0.0.0.0', () => {
  console.log('✅ 启动成功：http://192.168.1.33:8000');
});

function createServer() {
  return http.createServer((req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let url = reqUrl.pathname;
    try {
      url = decodeURIComponent(url);
    } catch (err) {
      // 如果 URL 解码失败，保持原始编码路径
    }

    // 1. API 获取剧集列表
    if (url.startsWith('/api/list')) {
      const drama = reqUrl.searchParams.get('drama');
      const dir = path.join(PUBLIC, 'video', drama);

      fs.readdir(dir, (err, files) => {
        const videos = [];
        if (!err) {
          files.forEach(f => {
            if (f.endsWith('.mp4')) {
              const m = f.match(/(\d+)\.mp4$/);
              videos.push({ file: f, num: m ? m[1] : '0' });
            }
          });
        }
        videos.sort((a, b) => parseInt(a.num) - parseInt(b.num));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(videos));
      });
      return;
    }

    // 2. 静态文件路径（安全、干净、不会吞页面）
    let fileName = url === '/' ? '/index.html' : url;
    fileName = path.normalize(fileName);
    const filePath = path.join(PUBLIC, fileName);

    // 防止路径穿越
    if (!filePath.startsWith(PUBLIC)) {
      res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('403 Forbidden');
    }

    // 3. 文件不存在 → 404
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('404 Not Found');
    }

    // 4. 视频流式播放
    if (filePath.endsWith('.mp4')) {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (!range) {
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Length': fileSize
        });
        return fs.createReadStream(filePath).pipe(res);
      }

      const [startStr, endStr] = range.replace('bytes=', '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4'
      });
      return fs.createReadStream(filePath, { start, end }).pipe(res);
    }

    // 5. 读取 HTML / JS / CSS / 图片
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading file');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
}