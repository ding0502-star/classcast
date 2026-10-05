# 課映 ClassCast

繁體中文教學錄影與剪輯網站，使用瀏覽器 MediaRecorder、Canvas 與 Web Audio，影片不傳至伺服器。

## 使用

使用 HTTPS 網址，或執行 `node preview.cjs` 後開啟 http://127.0.0.1:4173 。建議桌面版 Chrome 或 Edge。

支援螢幕、攝影機、子母畫面錄影、麥克風與可用的系統音訊、暫停錄影、匯入影片、MP4/WebM 匯出（依瀏覽器）。

## 教學編輯功能

- **專案儲存**：影片、裁切、字幕、標註、聲音與游標設定自動儲存於 IndexedDB；「我的專案」可以恢復、另存與刪除。「下載專案備份」產生包含原始影片的 `.classcast` 檔，供跨裝置匯入。
- **自動字幕**：使用 Transformers.js 3.8.1 與 Whisper Tiny/Base，在 Worker 內本機辨識。首次需連線下載模型；中文結果透過 OpenCC 轉繁體。先預覽校正，再取代或附加現有字幕。可以取消，不會破壞原有字幕。
- **時間軸**：拖曳兩端裁切、播放位置分割、拖曳片段排序；亦保留數字時間、鍵盤方向鍵與上移按鈕。支援成片順序預覽。
- **教學畫筆**：自由畫筆、螢光筆、橢圓、方框、箭頭；指定筆色、粗細與顯示秒數。錄影和編輯時的標註皆保存為專案圖層，可單獨移除，匯出時燒入成片。
- **滑鼠提示**：圓環、圓點、箭頭、十字，自訂顏色、大小、點擊波紋。影片畫布上的游標軌跡會在播放或錄影期間記錄；暫停時僅預覽。可另將自訂游標套用到整個網站。
- **聲音**：0–200% 音量、成片開頭淡入與結尾淡出、100 Hz 語音高通濾波、輸出限幅。
- **字幕樣式**：字級、文字顏色、底色、不透明度與上／中／下位置；預覽與成片一致。支援手動編輯、SRT 匯入及剪輯後 SRT 匯出。

時間以原始影片秒數為準。第一次加入裁切片段會取代預設完整影片。之後的片段依序串接，字幕自動依片段映射。標題顯示秒數也是原始影片時間。

匯出採即時轉錄，請保持頁面在前景。瀏覽器權限與作業系統決定可用的螢幕／音訊來源。網站無法修改其他應用程式的系統游標，也無法追蹤頁面外的滑鼠座標；請在影片畫布上標註，或透過作業系統設定調整全系統游標。

錄影與預覽分離：單一螢幕／攝影機直接錄製原始 MediaStreamTrack；子母畫面透過 Worker、MediaStreamTrackProcessor、MediaStreamTrackGenerator 與 OffscreenCanvas 逐幀合成，不依賴前景頁面的 requestAnimationFrame。子母畫面背景錄影需要支援這些 API 的桌面 Chrome／Edge；不支援時會明確提示改用螢幕錄影。選「整個螢幕」可錄下跨分頁與跨程式切換；選「分頁」只會錄製所選分頁。

`/local-recording-tests` 使用合成影像驗證：預覽完全不更新時，原生錄影與 Worker 子母畫面的成片仍會更新。測試不要求螢幕、攝影機或麥克風權限。

專案資料屬於特定網站來源和瀏覽器；GitHub Pages 與原有 Sites 網址的本機資料互不共享。清除網站資料或瀏覽器自動回收空間可能移除專案，重要教材應下載備份。大型影片與長音訊受裝置記憶體限制。

模型下載與程式庫載入會連至 Hugging Face / jsDelivr；影片和音訊不會傳到這些服務。自動字幕品質取決於模型、語言、噪音和收音，需要人工校正；Tiny 中文準確率較低，可改用 Base。語音濾波不等同 AI 降噪。未包含雲端專案儲存或多人協作。

## 部署

公開網站：https://ding0502-star.github.io/classcast/

原始碼在 `main`；Pages 使用 `gh-pages` 分支。修改後執行 `git push github main`，再執行 `git subtree push --prefix dist github gh-pages`。所有資產採相對路徑，支援 GitHub Pages 專案子目錄。

## 驗證

執行 `node --test tests/core.test.cjs` 驗證片段分割、字幕時間映射、成片音量與備份驗證。`node preview.cjs` 後開啟 `/local-tests` 可執行瀏覽器整合測試；測試頁不在公開的 `dist` 裡。

瀏覽器驗證包含合成影音匯入、片段分割、字幕樣式與游標設定持久化、IndexedDB 恢復、專案備份、MP4 匯出解碼，以及實際 Whisper 語音辨識。實體攝影機、麥克風與螢幕分享須由使用者授權後測試。

第三方資料： [Transformers.js](https://huggingface.co/docs/transformers.js/v3.0.0/en/api/pipelines)、[Whisper 模型](https://huggingface.co/Xenova/whisper-base)、[OpenCC.js](https://github.com/nk2028/opencc-js)。
