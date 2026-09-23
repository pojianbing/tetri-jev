const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 4000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const AUDIT_LOG_FILE = path.join(__dirname, 'typesafe_audit.log');

function logAudit(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  try {
    fs.appendFileSync(AUDIT_LOG_FILE, line, 'utf-8');
  } catch (_) { }
}

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  // 1. 服务端配置与状态接口
  if (pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        hasEnvApiKey: Boolean(process.env.TYPESAFE_API_KEY && process.env.TYPESAFE_API_KEY.length > 5),
      })
    );
    return;
  }

  // 2. 审计日志查询接口（让前端也可以直接看到真实的云端调用次数）
  if (pathname === '/api/audit-log' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      res.end(fs.readFileSync(AUDIT_LOG_FILE, 'utf-8'));
    } else {
      res.end('暂无任何请求记录。');
    }
    return;
  }

  // 3. TypeSafe Jev 官方代理转发
  if (pathname === '/api/systemone' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      let clientApiKey = req.headers['authorization'];
      if (clientApiKey && clientApiKey.startsWith('Bearer ')) {
        clientApiKey = clientApiKey.replace('Bearer ', '').trim();
      }

      const apiKey = clientApiKey || process.env.TYPESAFE_API_KEY;

      if (!apiKey || apiKey.length < 5) {
        logAudit('❌ 拦截请求: 未提供有效 API Key！');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: '未配置 TypeSafe API Key！只有配置了有效的 Key 才能使用 Jev 自动玩游戏。',
          })
        );
        return;
      }

      const maskedKey = apiKey.slice(0, 4) + '...' + apiKey.slice(-4);
      logAudit(`🚀 [TypeSafe 转发] 发起 Jev 官方决策请求，使用 Key: ${maskedKey}`);

      const start = Date.now();
      const options = {
        hostname: 'api.typesafe.ai',
        port: 443,
        path: '/v1/systemone',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const proxyReq = https.request(options, (proxyRes) => {
        let respData = '';
        proxyRes.on('data', (chunk) => {
          respData += chunk;
        });

        proxyRes.on('end', () => {
          const latency = Date.now() - start;
          if (proxyRes.statusCode === 200) {
            try {
              const parsed = JSON.parse(respData);
              const usage = parsed.usage ? `in:${parsed.usage.input_tokens} out:${parsed.usage.output_tokens}` : 'no-usage';
              const choice = parsed.answers?.best_placement?.choice || 'unknown';
              logAudit(`✅ [TypeSafe 成功] 耗时 ${latency}ms | 状态: ${proxyRes.statusCode} | 选定: ${choice} | Token: [${usage}]`);
            } catch (_) {
              logAudit(`✅ [TypeSafe 成功] 耗时 ${latency}ms | 状态: ${proxyRes.statusCode}`);
            }
          } else {
            logAudit(`⚠️ [TypeSafe 响应异常] 耗时 ${latency}ms | 状态码: ${proxyRes.statusCode} | 应答: ${respData.slice(0, 200)}`);
          }

          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          res.end(respData);
        });
      });

      proxyReq.on('error', (err) => {
        logAudit(`💥 [TypeSafe 连接异常] 错误: ${err.message}`);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '连接 TypeSafe 官方云端失败: ' + err.message }));
      });

      proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  // 4. 静态文件托管
  let reqPath = pathname;
  if (reqPath === '/') reqPath = '/index.html';

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  logAudit(`TypeSafe Jev Tetris server is running at: http://localhost:${PORT}`);
});
