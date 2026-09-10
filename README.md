# Google 日曆「我的日曆」預設收合（userscript）

開 `calendar.google.com` 時自動把左側「我的日曆」清單收起來，只剩標題列；「其他日曆」不動。

## 做法

- 「我的日曆」標題是 `<button aria-expanded="true" aria-controls="...">`（jsname `tTAKKd`），點一下即收合。
- class 名稱是混淆過的會變，所以用 `button[aria-expanded]` + 文字開頭「我的日曆 / My calendars」比對，jsname 當備援。
- 側欄是 SPA 動態渲染，用 MutationObserver（rAF 節流）等按鈕出現；點完 300ms 後確認 `aria-expanded="false"`
  才算完成，沒收起來就重試（最多 20 次，防 jsaction 還沒綁好）。
- 同一顆按鈕只處理一次 → 之後手動展開不會被收回；側欄被重建（新按鈕元素）才會再收一次。

## 安裝

裝好 Tampermonkey / Violentmonkey 後點開：

<https://raw.githubusercontent.com/charles0506/gcal-collapse-my-calendars/main/gcal-collapse-my-calendars.user.js>

已設 `@updateURL`，改版推上 GitHub 並調高 `@version` 會自動更新。
