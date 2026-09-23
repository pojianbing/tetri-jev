module.exports = (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.statusCode = 200;
  res.end('云端 Vercel Serverless 运行中。实时详细请求日志请在 Vercel 控制台的 Functions Logs 中查看。');
};
