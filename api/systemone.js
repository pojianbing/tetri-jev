const https = require('https');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  let clientApiKey = req.headers['authorization'];
  if (clientApiKey && clientApiKey.startsWith('Bearer ')) {
    clientApiKey = clientApiKey.replace('Bearer ', '').trim();
  }

  const apiKey = clientApiKey || process.env.TYPESAFE_API_KEY;

  if (!apiKey || apiKey.length < 5) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: '未配置 TypeSafe API Key！只有配置了有效的 Key 才能使用 Jev 自动玩游戏。',
      })
    );
    return;
  }

  let bodyData = '';
  if (req.body) {
    bodyData = typeof req.body === 'object' ? JSON.stringify(req.body) : String(req.body);
  } else {
    bodyData = await new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
      });
      req.on('end', () => {
        resolve(data);
      });
    });
  }

  const options = {
    hostname: 'api.typesafe.ai',
    port: 443,
    path: '/v1/systemone',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(bodyData),
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let respData = '';
    proxyRes.on('data', (chunk) => {
      respData += chunk;
    });

    proxyRes.on('end', () => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      res.end(respData);
    });
  });

  proxyReq.on('error', (err) => {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: '连接 TypeSafe 官方云端失败: ' + err.message }));
  });

  proxyReq.write(bodyData);
  proxyReq.end();
};
