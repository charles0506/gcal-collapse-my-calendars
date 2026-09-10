// ==UserScript==
// @name         Google 日曆「我的日曆」預設收合
// @namespace    https://claudeD.local/gcal-collapse-my-calendars
// @version      1.0.0
// @description  開 Google 日曆時自動把左側「我的日曆」清單收起來；之後手動展開不會被收回
// @author       claudeD
// @homepageURL  https://github.com/charles0506/gcal-collapse-my-calendars
// @supportURL   https://github.com/charles0506/gcal-collapse-my-calendars/issues
// @downloadURL  https://raw.githubusercontent.com/charles0506/gcal-collapse-my-calendars/main/gcal-collapse-my-calendars.user.js
// @updateURL    https://raw.githubusercontent.com/charles0506/gcal-collapse-my-calendars/main/gcal-collapse-my-calendars.user.js
// @match        https://calendar.google.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // 「我的日曆」標題本身就是 <button aria-expanded aria-controls>，點一下即收合。
  // class 是混淆過的會變，靠 aria-expanded + 文字比對；jsname 當備援。
  const LABELS = ["我的日曆", "My calendars"];
  const FALLBACK = 'button[jsname="tTAKKd"][aria-expanded]';
  const MAX_TRIES = 20;

  const handled = new WeakSet();
  let pending = false;
  let tries = 0;
  let scheduled = false;

  function findButton() {
    for (const btn of document.querySelectorAll("button[aria-expanded]")) {
      const text = (btn.textContent || "").trim();
      if (LABELS.some((l) => text.startsWith(l))) return btn;
    }
    return document.querySelector(FALLBACK);
  }

  function collapse() {
    const btn = findButton();
    if (!btn || handled.has(btn) || pending) return;
    if (btn.getAttribute("aria-expanded") !== "true") {
      handled.add(btn);
      return;
    }
    // 按鈕剛渲染時 jsaction 可能還沒綁好，點了沒反應；確認真的收起來才標記完成，否則重試
    pending = true;
    btn.click();
    setTimeout(() => {
      pending = false;
      if (btn.getAttribute("aria-expanded") === "false" || ++tries >= MAX_TRIES) {
        handled.add(btn);
        tries = 0;
      } else {
        collapse();
      }
    }, 300);
  }

  // 側欄是 SPA 動態渲染，可能晚出現或被重建（新元素 → 再收一次）。
  // 同一顆按鈕只處理一次，所以使用者手動展開後不會被收回。
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      collapse();
    });
  }

  collapse();
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
})();
