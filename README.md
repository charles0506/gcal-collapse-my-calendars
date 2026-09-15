# Google 日曆：我的日曆優先（userscript）

兩件事：

1. 側欄「我的日曆」預設收合（只剩標題列，「其他日曆」不動）。
2. 月檢視每一天的事件，**自己的日曆排最上面**，訂閱來的（側欄「其他日曆」那區）壓到下面。

## 為什麼

訂閱的日曆（例：荒野+368）一開，每天的格子被它的事件塞滿，自己的行程被擠到下面看不到。
Google 日曆沒有「依日曆排序」的設定，只能自己排。

## 做法

- **收合**：「我的日曆」標題是 `<button aria-expanded aria-controls>`（jsname `tTAKKd`），點一下即收合。
  class 是混淆過的會變，用 `button[aria-expanded]` + 文字開頭比對，jsname 當備援。
  同一顆按鈕只處理一次 → 手動展開不會被收回。
- **判斷哪些是訂閱日曆**：事件晶片的無障礙文字含「日曆：<名稱>」，只有非主日曆才有。
  側欄「其他日曆」清單（`li` 裡 `[role=checkbox]` 的 `aria-label`）就是要壓下去的名單，
  讀到就存 `localStorage.gcalOtherCalendars`，之後新訂閱會自動跟上；側欄還沒渲染時用快取／內建預設清單。
- **重排**：月檢視一週是一個 `div[role=row]`，晶片絕對定位（`left`/`width` 是 7 欄百分比、`top` 是第幾列 em）。
  依「自己的在前、其餘維持原順序」重新貪婪配位，跨天事件要整段欄位都空著才放得下，再寫回 `style.top`。
- **時機**：MutationObserver（rAF + 變動停止後 250ms 補跑）。換月／換檢視時 Google 是先塞晶片再自己排版，
  只跑一次會被它蓋回去。只看 `childList` 不看 `attributes`，避免自己改 `top` 把自己叫醒。

## 限制

一格塞不下時 Google 只渲染前幾個、其餘收進「還有 N 個」，**沒渲染的晶片不在 DOM 裡**，腳本救不回來。
要多看幾個就把瀏覽器縮放調小或視窗拉高（格子變高 → 可見列數變多）。

## 手動指定要壓下去的日曆

腳本自己會學。要手動改的話，在 calendar.google.com 的 devtools console 執行：

```js
localStorage.setItem("gcalOtherCalendars", JSON.stringify(["荒野+368", "台灣的節慶假日"]));
```

## 安裝

裝好 Tampermonkey / Violentmonkey 後點開：

<https://raw.githubusercontent.com/charles0506/gcal-collapse-my-calendars/main/gcal-collapse-my-calendars.user.js>

已設 `@updateURL`，改版推上 GitHub 並調高 `@version` 會自動更新。
