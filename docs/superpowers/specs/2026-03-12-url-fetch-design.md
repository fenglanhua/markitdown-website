# URL 抓取轉換功能設計

## 概述

新增讓使用者輸入網頁網址，由後端 proxy 抓取網頁內容，再由瀏覽器端的 Pyodide MarkItDown 轉換為 Markdown 的功能。

## 架構決策

- **後端 proxy**：自建 Node.js (Express) 服務，只負責抓取內容並回傳，不做轉換
- **部署方式**：與靜態網站同一個 nginx 下，用反向代理轉發 `/api/` 路徑到 Node.js 服務
- **轉換**：瀏覽器端 Pyodide MarkItDown 處理（與檔案上傳走同一條路）
- **Content-Type 感知**：proxy 回傳原始 content-type，前端據此判斷副檔名，未來可支援 URL 指向的 PDF 等格式

## Proxy API

### 端點

`GET /api/fetch-url?url=<encoded_url>`

### 成功回應

回傳原始內容（binary），附帶 headers：
- `Content-Type`：來源伺服器回傳的原始 content-type
- `X-Original-Url`：原始請求的 URL
- `X-Content-Length`：內容大小

### 錯誤回應

JSON `{ "error": "錯誤訊息" }` 搭配對應 HTTP status code：
- `400`：無效的 URL、不允許的協定
- `403`：內網 IP（SSRF 防護）
- `413`：回應超過 10MB
- `408`：請求超時（15 秒）
- `502`：目標伺服器無法連線或回應錯誤
- `429`：請求頻率超限

### 安全措施

1. 只允許 `http://` 和 `https://` 協定
2. DNS 解析後封鎖私有 IP（127.0.0.0/8、10.0.0.0/8、172.16.0.0/12、192.168.0.0/16、::1 等）
3. 回應大小上限 10MB
4. 請求超時 15 秒
5. Rate limiting：每個 IP 每分鐘 30 次
6. 設定合理的 User-Agent

### 技術選擇

- Express.js
- `node:dns` 做 IP 檢查
- `express-rate-limit` 做頻率限制

## 前端 UI

### URL 輸入區

在現有拖放區域下方新增 URL 輸入區塊：

```
┌─────────────────────────────────────┐
│        拖放文件至此                    │
│        或點擊選擇檔案                  │
│   支援格式：PDF DOCX XLSX ...         │
└─────────────────────────────────────┘

────────────── 或 ──────────────

┌──────────────────────────────┬──────┐
│  輸入網頁網址...               │ 轉換 │
└──────────────────────────────┴──────┘
```

- 分隔線用「或」字樣分開兩種輸入方式
- 輸入框 placeholder：`輸入網頁網址，例如 https://example.com`
- 「轉換」按鈕在引擎未就緒時 disabled
- 按 Enter 也能觸發轉換
- 基本的 URL 格式前端驗證（必須是 http/https 開頭）

### 轉換流程

1. 使用者輸入 URL 並點擊「轉換」
2. 前端 fetch `/api/fetch-url?url=...` 取得內容
3. 從 response 的 `Content-Type` 判斷副檔名（`text/html` → `.html`、`application/pdf` → `.pdf` 等）
4. 將內容包裝成虛擬 FileItem（filename 取自 URL 的 pathname 或 hostname），送進現有的 Worker 轉換佇列
5. 自動切換到清單狀態，顯示轉換進度

### 狀態處理

- 抓取中：輸入框和按鈕 disabled，按鈕文字改為「抓取中...」
- 抓取失敗：用現有的 error banner 顯示錯誤訊息
- 抓取成功：進入正常的轉換流程

### Content-Type 對應副檔名

| Content-Type | 副檔名 |
|---|---|
| `text/html` | `.html` |
| `application/pdf` | `.pdf` |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` |
| `application/vnd.openxmlformats-officedocument.presentationml.presentation` | `.pptx` |
| `text/csv` | `.csv` |
| `application/epub+zip` | `.epub` |
| 不支援的類型 | 前端顯示錯誤提示 |

## Nginx 設定

在現有 nginx.conf 中新增：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 20s;
}
```

## 新增檔案結構

```
markitdown-website/
├── server/
│   ├── package.json
│   ├── index.js          # Express 入口，啟動 HTTP server
│   └── fetch-url.js      # /fetch-url 路由邏輯（URL 驗證、SSRF 防護、抓取）
```

## 開發環境

- 現有的 `scripts/dev_server.py` 僅提供靜態檔案，開發時需額外啟動 `node server/index.js`
- 或者在 dev_server.py 中加入 `/api/` 的反向代理轉發
