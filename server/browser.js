const puppeteer = require('puppeteer-core');

let _browser = null;
let _launching = null; // mutex: 正在啟動中的 Promise

const CHROME_PATH = process.env.CHROME_PATH || '/usr/local/bin/chrome-headless-shell';

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--disable-software-rasterizer',
  '--disable-extensions',
];

// 直接下載的 MIME type 清單
const DIRECT_DOWNLOAD_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'application/epub+zip',
]);

function isDirectDownloadType(contentType) {
  if (!contentType) return false;
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return DIRECT_DOWNLOAD_TYPES.has(mime);
}

async function launchBrowser() {
  _browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: LAUNCH_ARGS,
  });
  console.log('Browser launched');
  return _browser;
}

function getBrowser() {
  return _browser;
}

function setBrowser(b) {
  _browser = b;
}

/**
 * 取得可用的 browser instance。
 * 若已斷線，使用 mutex 確保只有一個請求執行 relaunch。
 * @returns {Promise<import('puppeteer-core').Browser | null>}
 */
async function ensureBrowser() {
  if (_browser && _browser.isConnected()) return _browser;

  // mutex：若有其他請求正在 launch，等待它完成
  if (_launching) {
    await _launching;
    return _browser && _browser.isConnected() ? _browser : null;
  }

  try {
    _launching = launchBrowser();
    await _launching;
    return _browser;
  } catch (err) {
    console.error('Failed to launch browser:', err.message);
    _browser = null;
    return null;
  } finally {
    _launching = null;
  }
}

async function closeBrowser() {
  if (_browser) {
    try {
      await _browser.close();
    } catch { /* ignore */ }
    _browser = null;
  }
}

module.exports = {
  launchBrowser,
  getBrowser,
  setBrowser,
  ensureBrowser,
  closeBrowser,
  isDirectDownloadType,
  DIRECT_DOWNLOAD_TYPES,
};
