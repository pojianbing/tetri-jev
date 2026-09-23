module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      hasEnvApiKey: Boolean(process.env.TYPESAFE_API_KEY && process.env.TYPESAFE_API_KEY.length > 5),
    })
  );
};
