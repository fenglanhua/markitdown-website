# 簡化列表頁為純結果檢視 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除列表頁的上傳/URL 輸入功能，僅保留結果檢視、下載與「重新開始」按鈕。

**Architecture:** 純前端變更。移除 index.html 中列表頁的 URL input 和「繼續上傳」按鈕，改為「重新開始」按鈕。js/main.js 移除對應的 DOM 引用、事件監聯、死碼（appendFiles、LIST 分支），並新增重置邏輯。css/style.css 移除 compact 樣式和 `.page--dragging` 死碼。所有變更合併為單一 commit，避免中間態壞掉。

**Tech Stack:** HTML, CSS, vanilla JavaScript

---

## Chunk 1: 所有變更

### Task 1: 修改 index.html — 移除列表頁 URL 輸入並改按鈕

**Files:**
- Modify: `index.html:141-161`

- [ ] **Step 1: 修改 list-header**

將 `index.html` 第 141-149 行（list-header）替換為：

```html
        <div class="list-header">
          <span id="list-progress-text"></span>
          <div class="list-header__actions">
            <button id="btn-restart" class="btn btn--secondary" type="button">重新開始</button>
            <button id="btn-download-zip" class="btn btn--primary" type="button" disabled>全部下載 ZIP</button>
          </div>
        </div>
```

移除的元素：`#url-input-list`、`#btn-fetch-url-list`、`#btn-upload-more`

- [ ] **Step 2: 修改 list-footer**

將 `index.html` 第 153-161 行（list-footer）替換為：

```html
        <div class="list-footer">
          <span id="list-progress-text-footer"></span>
          <div class="list-footer__actions">
            <button id="btn-restart-footer" class="btn btn--secondary" type="button">重新開始</button>
            <button id="btn-download-zip-footer" class="btn btn--primary" type="button" disabled>全部下載 ZIP</button>
          </div>
        </div>
```

移除的元素：`#url-input-list-footer`、`#btn-fetch-url-list-footer`、`#btn-upload-more-footer`

---

### Task 2: 修改 css/style.css — 移除死碼樣式

**Files:**
- Modify: `css/style.css:458-466, 710-722`

- [ ] **Step 1: 移除 `.page--dragging` 樣式**

刪除第 458-466 行（document 層級拖放 overlay，已無使用處）：

```css
.page--dragging::after {
  content: '';
  position: fixed;
  inset: 0;
  border: 3px dashed var(--color-highlight);
  border-radius: var(--radius-sm);
  pointer-events: none;
  z-index: 100;
}
```

- [ ] **Step 2: 移除 compact URL 樣式**

刪除以下兩個 CSS 規則（約第 710-722 行，移除 Step 1 後行號會前移）：

```css
.url-input--compact {
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
  border-radius: 6px;
  width: 200px;
  flex: none;
}

.url-input__btn--compact {
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  white-space: nowrap;
}
```

---

### Task 3: 修改 js/main.js — 移除死碼與列表頁 DOM 引用

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: 移除列表頁 URL 和上傳按鈕的 DOM 引用**

刪除第 25-35 行中以下 6 行：

```js
const btnUploadMore         = document.getElementById('btn-upload-more');
const btnUploadMoreFooter        = document.getElementById('btn-upload-more-footer');
const urlInputList          = document.getElementById('url-input-list');
const btnFetchUrlList       = document.getElementById('btn-fetch-url-list');
const urlInputListFooter    = document.getElementById('url-input-list-footer');
const btnFetchUrlListFooter = document.getElementById('btn-fetch-url-list-footer');
```

新增「重新開始」按鈕引用：

```js
const btnRestart            = document.getElementById('btn-restart');
const btnRestartFooter      = document.getElementById('btn-restart-footer');
```

- [ ] **Step 2: 移除 appendFiles() 函式**

刪除第 344-362 行的 `appendFiles()` 函式（含註解）：

```js
/**
 * 追加新檔案至現有佇列，並在閒置時繼續轉換。
 * 前提：僅在 currentState === STATES.LIST 時呼叫（引擎必然已就緒）。
 * @param {FileList|File[]} files
 */
function appendFiles(files) {
  const seen = new Set(fileQueue.map(i => i.filename));
  const newItems = Array.from(files).map(file => {
    const item = createFileItem(file, seen);
    seen.add(item.filename);
    return item;
  });
  fileQueue.push(...newItems);
  newItems.forEach(item => fileList.appendChild(createFileItemEl(item)));
  updateListHeader();

  const isWorkerFree = !fileQueue.some(i => i.status === 'converting');
  if (isWorkerFree) processNextFile();
}
```

- [ ] **Step 3: 移除 fetchAndConvert() 中 LIST 分支**

在 `fetchAndConvert()` 函式中（約第 297-311 行），將 if/else 分支替換為只保留 UPLOAD 邏輯：

原：
```js
    if (currentState === STATES.LIST) {
      // 追加到現有清單
      fileQueue.push(item);
      fileList.appendChild(createFileItemEl(item));
      updateListHeader();
      const isWorkerFree = !fileQueue.some(i => i.status === 'converting');
      if (isWorkerFree) processNextFile();
    } else {
      // 新佇列
      fileQueue = [item];
      currentIndex = -1;
      showState(STATES.LIST);
      renderFileList();
      processNextFile();
    }
```

改為：
```js
    // 新佇列
    fileQueue = [item];
    currentIndex = -1;
    showState(STATES.LIST);
    renderFileList();
    processNextFile();
```

- [ ] **Step 4: 移除清單拖放事件處理**

刪除第 600-620 行（清單拖放事件）：

```js
// ── 清單拖放事件（全頁範圍）────────────────────────────────────────────────

document.addEventListener('dragover', (e) => {
  if (currentState !== STATES.LIST) return;
  e.preventDefault();
  document.body.classList.add('page--dragging');
});

document.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) {
    document.body.classList.remove('page--dragging');
  }
});

document.addEventListener('drop', (e) => {
  if (currentState !== STATES.LIST) return;
  e.preventDefault();
  document.body.classList.remove('page--dragging');
  const files = e.dataTransfer?.files;
  if (files?.length) appendFiles(files);
});
```

- [ ] **Step 5: 簡化 fileInput change handler**

將第 622-631 行的 change handler 簡化，移除 LIST 分支：

原：
```js
fileInput.addEventListener('change', () => {
  const files = fileInput.files;
  if (!files?.length) return;
  if (currentState === STATES.LIST) {
    appendFiles(files);   // Task 9 實作
  } else {
    handleFiles(files);
  }
  fileInput.value = '';
});
```

改為：
```js
fileInput.addEventListener('change', () => {
  const files = fileInput.files;
  if (!files?.length) return;
  handleFiles(files);
  fileInput.value = '';
});
```

- [ ] **Step 6: 移除列表頁 URL 事件監聽與「繼續上傳」按鈕事件**

刪除第 636-637 行：
```js
btnUploadMore.addEventListener('click', () => fileInput.click());
btnUploadMoreFooter.addEventListener('click', () => fileInput.click());
```

刪除第 671-695 行（列表頁 URL 抓取事件）：
```js
// 列表頁 URL 抓取（header）
btnFetchUrlList.addEventListener('click', () => {
  ...
});
urlInputList.addEventListener('keydown', (e) => {
  ...
});

// 列表頁 URL 抓取（footer）
btnFetchUrlListFooter.addEventListener('click', () => {
  ...
});
urlInputListFooter.addEventListener('keydown', (e) => {
  ...
});
```

---

### Task 4: 新增「重新開始」邏輯與 disabled 控制

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: 在 updateListHeader() 中控制「重新開始」按鈕 disabled 狀態**

在 `updateListHeader()` 函式末尾（`btnDownloadZipFooter.disabled = zipDisabled;` 之後），新增：

```js
  btnRestart.disabled = isProcessing;
  btnRestartFooter.disabled = isProcessing;
```

- [ ] **Step 2: 新增 resetToUpload() 函式與事件綁定**

在「按鈕事件」區段（`btnErrorDismiss.addEventListener` 之前），新增：

```js
/** 重置所有狀態，回到初始上傳畫面 */
function resetToUpload() {
  fileQueue = [];
  currentIndex = -1;
  fileList.innerHTML = '';
  urlInput.value = '';
  fileInput.value = '';
  dismissError();
  showState(STATES.UPLOAD);
}

btnRestart.addEventListener('click', resetToUpload);
btnRestartFooter.addEventListener('click', resetToUpload);
```

- [ ] **Step 3: Commit 所有變更**

```bash
git add index.html css/style.css js/main.js
git commit -m "refactor: 簡化列表頁為純結果檢視，新增重新開始按鈕"
```

---

### Task 5: 手動驗證

- [ ] **Step 1: 啟動開發環境**

```bash
docker compose -f docker-compose-dev.yml up --build
```

- [ ] **Step 2: 驗證清單**

在瀏覽器開啟 http://localhost:8080，依序確認：

1. 上傳檔案 → 列表頁僅顯示結果 + 「重新開始」+ 「全部下載 ZIP」
2. 無 URL 輸入框或「繼續上傳」按鈕
3. 拖放檔案到列表頁 → 無任何反應
4. 轉換進行中 → 「重新開始」按鈕為 disabled
5. 轉換完成 → 點擊「重新開始」→ 回到空白上傳頁
6. 再次上傳 → 正常運作（確認重置完整）
7. 開啟 console → 無錯誤
8. 上傳頁的 URL 輸入功能仍正常運作

- [ ] **Step 3: 最終 commit（如有修正）**

```bash
git add -A
git commit -m "fix: 驗證後修正"
```
