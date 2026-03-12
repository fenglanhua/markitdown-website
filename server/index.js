const express = require('express');
const rateLimit = require('express-rate-limit');
const { fetchUrlHandler } = require('./fetch-url');
const { launchBrowser, closeBrowser } = require('./browser');

const app = express();
const PORT = process.env.PORT || 3002;

app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '請求過於頻繁，請稍後再試' },
});

app.use('/fetch-url', limiter);
app.get('/fetch-url', fetchUrlHandler);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

async function start() {
  try {
    await launchBrowser();
    console.log('Browser ready');
  } catch (err) {
    console.error('Warning: Browser launch failed:', err.message);
    console.error('Will retry on first request');
  }

  app.listen(PORT, () => {
    console.log(`Proxy server listening on port ${PORT}`);
  });
}

// 優雅關閉
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing browser...');
  await closeBrowser();
  process.exit(0);
});

start();

module.exports = app;
