const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('isDirectDownloadType', () => {
  it('辨識 PDF', () => {
    const { isDirectDownloadType } = require('../browser');
    assert.equal(isDirectDownloadType('application/pdf'), true);
  });

  it('辨識 DOCX', () => {
    const { isDirectDownloadType } = require('../browser');
    assert.equal(isDirectDownloadType('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), true);
  });

  it('辨識 XLSX', () => {
    const { isDirectDownloadType } = require('../browser');
    assert.equal(isDirectDownloadType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), true);
  });

  it('辨識 PPTX', () => {
    const { isDirectDownloadType } = require('../browser');
    assert.equal(isDirectDownloadType('application/vnd.openxmlformats-officedocument.presentationml.presentation'), true);
  });

  it('辨識 CSV', () => {
    const { isDirectDownloadType } = require('../browser');
    assert.equal(isDirectDownloadType('text/csv'), true);
  });

  it('辨識 EPUB', () => {
    const { isDirectDownloadType } = require('../browser');
    assert.equal(isDirectDownloadType('application/epub+zip'), true);
  });

  it('忽略 charset 參數', () => {
    const { isDirectDownloadType } = require('../browser');
    assert.equal(isDirectDownloadType('application/pdf; charset=binary'), true);
  });

  it('HTML 不是直接下載類型', () => {
    const { isDirectDownloadType } = require('../browser');
    assert.equal(isDirectDownloadType('text/html'), false);
    assert.equal(isDirectDownloadType('text/html; charset=utf-8'), false);
  });

  it('未知類型不是直接下載類型', () => {
    const { isDirectDownloadType } = require('../browser');
    assert.equal(isDirectDownloadType('application/json'), false);
  });

  it('null/undefined 不是直接下載類型', () => {
    const { isDirectDownloadType } = require('../browser');
    assert.equal(isDirectDownloadType(null), false);
    assert.equal(isDirectDownloadType(undefined), false);
    assert.equal(isDirectDownloadType(''), false);
  });
});

describe('getBrowser / setBrowser', () => {
  it('初始狀態為 null', () => {
    const { getBrowser, setBrowser } = require('../browser');
    setBrowser(null); // 確保清理
    assert.equal(getBrowser(), null);
  });

  it('setBrowser 後可透過 getBrowser 取得', () => {
    const { getBrowser, setBrowser } = require('../browser');
    const fakeBrowser = { isConnected: () => true, close: async () => {} };
    setBrowser(fakeBrowser);
    assert.equal(getBrowser(), fakeBrowser);
    setBrowser(null); // 清理
  });
});

describe('ensureBrowser', () => {
  afterEach(() => {
    const { setBrowser } = require('../browser');
    setBrowser(null);
  });

  it('已連線的 browser 直接回傳', async () => {
    const { ensureBrowser, setBrowser } = require('../browser');
    const fakeBrowser = { isConnected: () => true };
    setBrowser(fakeBrowser);
    const result = await ensureBrowser();
    assert.equal(result, fakeBrowser);
  });

  it('斷線時嘗試 relaunch（無 chrome 則回傳 null）', async () => {
    const { ensureBrowser, setBrowser } = require('../browser');
    const deadBrowser = { isConnected: () => false };
    setBrowser(deadBrowser);
    // 測試環境沒有 chrome-headless-shell，預期 launch 失敗回傳 null
    const result = await ensureBrowser();
    assert.equal(result, null);
  });
});
