## Plan: 證件照圖檔產生器 (ID Photo Generator)

用 HTML + CSS + TypeScript 建立單頁應用，讓使用者選擇證件照類型、匯入照片、手動調整裁切、套用美膚/打亮/亮度，匯出 4x6 吋便利商店列印圖或單張證件照。使用 Vite 作為開發打包工具。

---

### 照片規格

| 類型 | 尺寸 (mm) | 尺寸 (px@300DPI) | 用途 |
|------|-----------|------------------|------|
| 兩吋大頭照 | 35 × 45 | 413 × 531 | 身分證、護照、台胞證 |
| 兩吋半身照 | 35 × 45 | 413 × 531 | 健保卡、兵役體檢、履歷表 |
| 一吋半身照 | 25 × 30 | 295 × 354 | 駕照、身心障礙 |

### 輸出版面 (4x6 吋 = 1200 × 1800 px @300DPI)

| 版面 | 排列 | 方向 |
|------|------|------|
| 兩吋 | 3欄 × 2列 = 6張 | 直式 |
| 一吋 | 4欄 × 2列 = 8張 | 橫式 |
| 兩吋+一吋 | 左側2欄×2列兩吋 + 右側2欄×2列一吋 | 直式 |

每張輸出包含剪裁線 (✂ marks) 和標注文字。

---

### 專案結構

```
ID photo/
├── index.html
├── src/
│   ├── main.ts          # 進入點，初始化 App
│   ├── types.ts         # 型別定義 & 尺寸常數
│   ├── photo-editor.ts  # 裁切框、拖曳、縮放
│   ├── beauty.ts        # 美膚/打亮/亮度濾鏡
│   ├── export.ts        # 4x6排版 + 單張匯出
│   └── styles.css       # 全部樣式
├── package.json
├── tsconfig.json
└── 實際輸出範例/
```

---

### Steps

**Phase 1 — 專案骨架** *(可平行)*

1. 建立 `package.json` + `tsconfig.json` — Vite + TypeScript 基本設定
2. 建立 `index.html` — 頁面結構：左側控制面板 + 右側 canvas 預覽區
3. 建立 `src/styles.css` — 排版與控制面板樣式
4. 建立 `src/types.ts` — `PhotoType` enum、各尺寸常數物件、介面定義

**Phase 2 — 照片匯入與預覽**

5. `src/main.ts` — 照片類型選擇 (4 個 radio)、`<input type="file">` 匯入、載入圖片到 canvas *(depends on 1-4)*
6. `src/photo-editor.ts` — canvas 上繪製照片 + 裁切框 overlay，根據照片類型切換比例引導線

**Phase 3 — 手動調整**

7. `src/photo-editor.ts` 加入拖曳 (mousedown/mousemove/mouseup) 移動照片 *(depends on 6)*
8. 加入縮放滑桿 (range slider) 控制照片放大縮小
9. 大頭照模式顯示頭頂/下巴參考線，半身照模式顯示肩膀參考線

**Phase 4 — 美膚/打亮/亮度**

10. `src/beauty.ts` — 三個 range slider *(parallel with Phase 3)*
    - **簡易美膚**: `ctx.filter = 'blur(Npx)'` + 原圖 alpha 混合
    - **簡易打亮**: `globalCompositeOperation = 'screen'` 疊加白色半透明層
    - **亮度調整**: `ctx.filter = 'brightness(N%)'`
11. 「回復原狀」按鈕 — 重置所有滑桿到預設值

**Phase 5 — 匯出功能**

12. `src/export.ts` — 便利商店列印用圖檔 *(depends on 7-10)*
    - 建立 offscreen canvas (1200×1800 或 1800×1200)
    - 按選擇的版面類型排列照片到網格
    - 繪製剪裁虛線 + ✂ 符號 + 標注文字
    - `canvas.toBlob('image/jpeg', 0.95)` → 下載
13. `src/export.ts` — 單張證件圖檔
    - 根據類型裁切出 413×531 或 295×354 px
    - 下載為 JPEG

---

### UI 流程

1. 選擇照片類型(一吋/兩吋) → 2. 上傳照片 → 3. 顯示範例框線，調整位置/縮放，及時預覽單張結果 → 4. 美膚 → 5. 匯出

**左側面板**: 照片類型選擇、美膚/打亮/亮度滑桿、回復原狀、匯出按鈕
**右側預覽**: Canvas (照片 + 裁切框 overlay)
**底部**: 縮放滑桿 + 微調按鈕

---

### 關鍵技術

- **Canvas 雙層**: 底層畫照片，上層畫裁切框 overlay (用 CSS `pointer-events` 穿透)
- **高解析度匯出**: 預覽用螢幕解析度，匯出用 300 DPI 重新繪製到 offscreen canvas
- **拖曳**: 記錄 `offsetX/Y`，`mousemove` 更新繪製位置，重繪 canvas
- **JPEG 下載**: `canvas.toBlob()` + 建立 `<a download>` 觸發下載

---

### Verification

1. `npm run dev` 啟動，確認頁面載入
2. 上傳照片 → 預覽正確顯示
3. 切換照片類型 → 裁切框比例正確切換
4. 拖曳移動 + 縮放滑桿正常運作
5. 美膚/打亮/亮度即時反映、回復原狀正常
6. 匯出兩吋列印圖 → 1200×1800 JPEG, 3×2 排列
7. 匯出一吋列印圖 → 1800×1200 JPEG, 4×2 排列
8. 匯出兩吋+一吋組合圖 → 左兩吋 + 右一吋排列
9. 單張匯出尺寸正確 (413×531 / 295×354)
10. 比對 `實際輸出範例/` 確認排版一致

---

### Decisions

- 人臉偵測: **手動框選**
- 輸出底圖: **4x6 吋 @300DPI**
- 美膚功能: **實作** (美膚、打亮、亮度)
- 檔案結構: **HTML + CSS + TypeScript** (Vite 打包)
- 「兩吋+一吋」模式: 同一張照片，分別調整兩種裁切框

### Further Considerations

1. **「兩吋+一吋」模式 UX** — 只適用半身照，用半身照位置參數自動產生兩種尺寸
2. **一吋照片尺寸** — 預設使用台灣標準 25×30mm，若需調整可在 `types.ts` 常數中修改。
