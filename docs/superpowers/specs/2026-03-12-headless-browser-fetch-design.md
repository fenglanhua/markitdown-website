# Headless Browser URL 抓取設計規格

## 目標

將 `server/fetch-url.js` 的網頁抓取方式從 Node.js `fetch()` 改為 `puppeteer-core` + `chrome-headless-shell`，使所有 URL 轉換都能取得 JavaScript 渲染後的完整 HTML。

## 背景

目前 URL 抓取使用 Node.js 內建 `fetch()`，只能取得伺服器回傳的原始 HTML。現代網頁大量使用 SPA 框架（React、Vue、Angular 等），實際內容由 JavaScript 動態渲染，`fetch()` 無法取得這些內容。

## 設計

### 技術選型

- **puppeteer-core**：不自帶 Chromium，搭配獨立安裝的 chrome-headless-shell 使用。
- **chrome-headless-shell**：Google 提供的精簡版 headless Chrome，比完整 Chromium 體積小。
- **安裝方式**：透過 `@puppeteer/browsers` CLI 在 Docker 建置時下載。

### Browser 生命週期

伺服器啟動時 launch 一個共用的 browser instance，每次請求開新 page（tab），請求結束後關閉 page。

```
Server 啟動 → launch browser instance（持續運行）
              ↓
Request 1 → browser.newPage() → 導航 → 取得 HTML → page.close()
Request 2 → browser.newPage() → 導航 → 取得 HTML → page.close()
              ↓
Server 關閉 → browser.close()
```

### 抓取流程（fetchUrlHandler 改動）

1. 驗證 URL 格式與協定（不變）
2. DNS 解析 + SSRF 私有 IP 檢查（不變，在 Puppeteer 導航前執行）
3. 開新 page：`browser.newPage()`
4. 導航至目標 URL：`page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 })`
5. 取得渲染後 HTML：`page.content()`
6. 檢查 HTML 大小是否超過 10MB
7. 回傳 HTML bytes + headers，關閉 page

### 回傳格式（不變）

- `Content-Type: text/html; charset=utf-8`
- `X-Original-Url: <原始 URL>`
- Body：渲染後的 HTML 字串

前端不需要任何修改。

### 安全防護

| 項目 | 做法 |
|------|------|
| SSRF 防護 | 維持現有 `resolveAndCheck()` DNS 預檢，在 Puppeteer 導航前阻擋私有 IP |
| 大小限制 | `page.content()` 取得 HTML 後檢查 `Buffer.byteLength(html)` 是否超過 10MB |
| 逾時 | `page.goto()` 設定 `timeout: 15000`（15 秒） |
| 頁面隔離 | 每次請求使用獨立 page，請求結束後 `page.close()` |
| Chrome 沙箱 | `--no-sandbox`（Docker 容器內必要）、`--disable-gpu`、`--disable-dev-shm-usage` |

### Chrome 啟動參數

```javascript
puppeteer.launch({
  executablePath: '/path/to/chrome-headless-shell',
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-software-rasterizer',
    '--disable-extensions',
  ],
});
```

### 錯誤處理

| 情境 | HTTP 回應 |
|------|-----------|
| 導航逾時 | 408 `請求超時（15 秒）` |
| 導航失敗（DNS、連線錯誤等） | 502 `無法連線至目標伺服器：<message>` |
| HTTP 錯誤回應（4xx/5xx） | 502 `目標伺服器回應錯誤：<status>` |
| HTML 超過 10MB | 413 `回應過大，上限為 10MB` |
| Browser instance 不可用 | 503 `瀏覽器引擎暫時無法使用` |

導航失敗的偵測：`page.goto()` 回傳的 response 物件可檢查 `response.status()`，若非 2xx 則視為錯誤。

### 異常恢復

若 browser instance 意外崩潰，下次請求進來時偵測到 `browser.isConnected() === false`，自動重新 launch。

## Docker 變更

### Runner stage 改用 Debian slim

從 `node:lts-alpine` 改為 `node:20-slim`，因為 chrome-headless-shell 需要 glibc 和相關系統函式庫。

### 新增的系統依賴

chrome-headless-shell 所需的最小系統函式庫：

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    fonts-noto-cjk \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*
```

### server-deps stage 變更

同樣改為 Debian-based image（`node:20-slim`），並在此階段用 `@puppeteer/browsers` 下載 chrome-headless-shell：

```dockerfile
FROM node:20-slim AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --production
RUN npx @puppeteer/browsers install chrome-headless-shell@stable
```

### Nginx 安裝方式

從 `apk add nginx` 改為 `apt-get install nginx`。Nginx 設定檔路徑從 `/etc/nginx/http.d/` 改為 `/etc/nginx/conf.d/`。

### server/package.json 變更

新增依賴：

```json
{
  "dependencies": {
    "express": "^4.21.0",
    "express-rate-limit": "^7.5.0",
    "puppeteer-core": "^24.0.0"
  }
}
```

## 不變的部分

- 前端程式碼（`index.html`、`js/main.js`、`css/style.css`）：零修改
- Express 路由結構、Rate limiting、健康檢查端點
- API 路徑 `GET /fetch-url?url=<encoded_url>`
- `sw.js`、`manifest.json`

## 變更檔案清單

| 檔案 | 動作 | 說明 |
|------|------|------|
| `server/fetch-url.js` | 修改 | 抓取邏輯改用 puppeteer-core |
| `server/index.js` | 修改 | 啟動時 launch browser，關閉時 close browser |
| `server/package.json` | 修改 | 新增 puppeteer-core 依賴 |
| `Dockerfile` | 修改 | Runner/server-deps 改用 Debian slim，安裝 chrome-headless-shell 及系統依賴 |
| `docker/start.sh` | 可能修改 | 視 nginx 路徑是否需要調整 |
| `server/__tests__/*.test.js` | 修改 | 更新測試 mock 方式 |