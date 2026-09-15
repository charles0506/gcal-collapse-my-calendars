// ==UserScript==
// @name         Google 日曆：我的日曆優先
// @namespace    https://claudeD.local/gcal-collapse-my-calendars
// @version      1.2.0
// @description  側欄「我的日曆」預設收合；月檢視每天的事件排序：自己的日曆 → 假日日曆 → 其他訂閱
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

  /* ---------- 功能一：「我的日曆」預設收合 ---------- */

  // 「我的日曆」標題本身就是 <button aria-expanded aria-controls>，點一下即收合。
  // class 是混淆過的會變，靠 aria-expanded + 文字比對；jsname 當備援。
  const MINE_LABELS = ["我的日曆", "My calendars"];
  const OTHER_LABELS = ["其他日曆", "Other calendars"];
  const FALLBACK = 'button[jsname="tTAKKd"][aria-expanded]';
  const MAX_TRIES = 20;

  const handled = new WeakSet();
  let pending = false;
  let tries = 0;

  function sectionButton(labels, fallback) {
    for (const btn of document.querySelectorAll("button[aria-expanded]")) {
      const text = (btn.textContent || "").trim();
      if (labels.some((l) => text.startsWith(l))) return btn;
    }
    return fallback ? document.querySelector(fallback) : null;
  }

  function collapse() {
    const btn = sectionButton(MINE_LABELS, FALLBACK);
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

  /* ---------- 功能二：自己的日曆事件排最上面 ---------- */

  // 事件晶片的無障礙文字含「日曆：<名稱>」，只有非主日曆才有；主日曆（本人帳號）沒有這段。
  // 所以「要往下壓的」= 側欄「其他日曆」區塊列出的名稱。側欄有渲染時就學起來存 localStorage，
  // 之後訂閱新日曆會自動跟上；側欄還沒渲染（或收起來）就用快取／預設清單。
  const STORE_KEY = "gcalOtherCalendars";
  const DEFAULT_OTHER = [
    "2026台灣國定假日（例假日版）",
    "台灣的節慶假日",
    "荒野+368",
    "2026 世界盃賽程",
    "中國行事曆",
    "小安的葡萄園",
  ];
  const COLS = 7;
  const COL_WIDTH = 100 / COLS;

  let otherCache = null;

  function readStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const list = raw ? JSON.parse(raw) : null;
      if (Array.isArray(list) && list.length) return list;
    } catch (e) {
      /* localStorage 被鎖或內容壞掉就當沒有 */
    }
    return null;
  }

  function learnOtherCalendars() {
    const btn = sectionButton(OTHER_LABELS, null);
    if (!btn) return;
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    if (!panel) return;
    const names = [];
    for (const li of panel.querySelectorAll("li")) {
      const box = li.querySelector("[role=checkbox], input[type=checkbox]");
      const name = (box && box.getAttribute("aria-label")) || (li.innerText || "").trim().split("\n")[0];
      if (name) names.push(name.trim());
    }
    if (!names.length) return; // 收合／尚未渲染時 li 是空的，別把快取洗掉
    otherCache = names;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(names));
    } catch (e) {
      /* 存不進去就只留這次的記憶體快取 */
    }
  }

  function otherCalendars() {
    return otherCache || readStore() || DEFAULT_OTHER;
  }

  function calendarOf(chip) {
    const m = /日曆：([^，]+)/.exec(chip.textContent || "");
    return m ? m[1].trim() : null; // null = 主日曆
  }

  // 三層：0 自己的日曆（主日曆 + 側欄「我的日曆」那些）、1 假日日曆、2 其餘訂閱的。
  // 假日那層用名稱比對，明年換成「2027台灣國定假日」之類也吃得到；
  // 要自己指定就設 localStorage.gcalHolidayCalendars（字串陣列，比對用「包含」）。
  const HOLIDAY_KEY = "gcalHolidayCalendars";
  const DEFAULT_HOLIDAY = ["國定假日", "節慶假日", "holiday"];

  function holidayPatterns() {
    try {
      const raw = localStorage.getItem(HOLIDAY_KEY);
      const list = raw ? JSON.parse(raw) : null;
      if (Array.isArray(list) && list.length) return list;
    } catch (e) {
      /* 壞掉就用預設 */
    }
    return DEFAULT_HOLIDAY;
  }

  function rankOf(chip, others, holidays) {
    const name = calendarOf(chip);
    if (!name || !others.includes(name)) return 0; // 主日曆或「我的日曆」裡的
    const lower = name.toLowerCase();
    return holidays.some((h) => lower.includes(String(h).toLowerCase())) ? 1 : 2;
  }

  // 月檢視一週是一個 div[role=row]，晶片絕對定位：left/width 是 7 欄的百分比，top 是第幾列（em）。
  // 重排 = 依層級排序（同層維持原順序）重新貪婪配位，跨天事件要整段欄位都空著才放得下。
  function reorderRow(row, others, holidays) {
    const chips = [...row.querySelectorAll("[data-eventchip]")].filter((c) => /em$/.test(c.style.top || ""));
    if (chips.length < 2) return;

    const items = chips.map((chip, index) => ({
      chip,
      index,
      col: Math.round(parseFloat(chip.style.left) / COL_WIDTH),
      span: Math.max(1, Math.round(parseFloat(chip.style.width) / COL_WIDTH)),
      top: parseFloat(chip.style.top),
      rank: rankOf(chip, others, holidays),
    }));

    const order = [...items].sort(
      (a, b) => a.rank - b.rank || a.top - b.top || a.col - b.col || a.index - b.index
    );

    const taken = [];
    for (const item of order) {
      let slot = 0;
      for (;;) {
        if (!taken[slot]) taken[slot] = new Set();
        let free = true;
        for (let c = item.col; c < item.col + item.span; c++) {
          if (taken[slot].has(c)) {
            free = false;
            break;
          }
        }
        if (free) {
          for (let c = item.col; c < item.col + item.span; c++) taken[slot].add(c);
          break;
        }
        slot++;
      }
      if (slot !== item.top) item.chip.style.top = slot + "em";
    }
  }

  function reorder() {
    const others = otherCalendars();
    const holidays = holidayPatterns();
    const rows = new Set();
    for (const chip of document.querySelectorAll("[data-eventchip]")) {
      const row = chip.closest('div[role="row"]');
      if (row) rows.add(row);
    }
    for (const row of rows) reorderRow(row, others, holidays);
  }

  /* ---------- 觸發 ---------- */

  let scheduled = false;
  let settleTimer = 0;

  function run() {
    collapse();
    learnOtherCalendars();
    reorder();
  }

  // 側欄與月檢視都是 SPA 動態渲染（換月、換檢視都會重建），用 MutationObserver 追，rAF 節流。
  // 只看 childList，不看 attributes，否則自己改 style.top 會把自己叫醒變無限迴圈。
  function schedule() {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        run();
      });
    }
    // 換月／換檢視時 Google 是先塞晶片再自己排版，馬上跑會被它蓋回去；
    // 等 DOM 變動停下來再補跑一次，排序才留得住。
    clearTimeout(settleTimer);
    settleTimer = setTimeout(run, 250);
  }

  run();
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
})();
