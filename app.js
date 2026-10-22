/* =========================================================
   ปกครอง Diary — Administrative Court Case Law & Exam Prep App
   UX/UI inspired by https://longtundiary.com/
   ========================================================= */

(function () {
  "use strict";

  const THAI_TO_ARABIC = {
    "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4",
    "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9"
  };
  const ARABIC_TO_THAI = {
    "0": "๐", "1": "๑", "2": "๒", "3": "๓", "4": "๔",
    "5": "๕", "6": "๖", "7": "๗", "8": "๘", "9": "๙"
  };

  const THAI_PUA_MAP = {
    "\uf700": "\u0e10", "\uf701": "\u0e34", "\uf702": "\u0e35", "\uf703": "\u0e36",
    "\uf704": "\u0e37", "\uf705": "\u0e48", "\uf706": "\u0e49", "\uf707": "\u0e4a",
    "\uf708": "\u0e4b", "\uf709": "\u0e4c", "\uf70a": "\u0e48", "\uf70b": "\u0e49",
    "\uf70c": "\u0e4a", "\uf70d": "\u0e4b", "\uf70e": "\u0e4c", "\uf70f": "\u0e0d",
    "\uf710": "\u0e31", "\uf711": "\u0e4d", "\uf712": "\u0e47", "\uf713": "\u0e48",
    "\uf714": "\u0e49", "\uf715": "\u0e4a", "\uf716": "\u0e4b", "\uf717": "\u0e4c",
    "\uf718": "\u0e38", "\uf719": "\u0e39", "\uf71a": "\u0e3a", "\uf71d": "\u0e2c"
  };

  function cleanThaiText(str) {
    return String(str ?? "")
      .replace(/[\uf700-\uf71d]/g, c => THAI_PUA_MAP[c] || c)
      .replace(/([\u0e48-\u0e4b])\u0e4d\u0e32/g, "$1\u0e33")
      .replace(/\u0e4d([\u0e48-\u0e4b])\u0e32/g, "$1\u0e33")
      .replace(/\u0e4d\u0e32/g, "\u0e33");
  }

  function toArabicDigits(str) {
    return cleanThaiText(str).replace(/[๐-๙]/g, d => THAI_TO_ARABIC[d] || d);
  }
  function toThaiDigits(str) {
    return cleanThaiText(str).replace(/[0-9]/g, d => ARABIC_TO_THAI[d] || d);
  }
  function normalizeForSearch(str) {
    return toArabicDigits(str).toLowerCase().replace(/\s+/g, " ").trim();
  }
  function escapeHtml(s) {
    return cleanThaiText(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Smart Legal Keyword Highlighter for easy reading
  function formatLegalText(rawText) {
    let html = escapeHtml(rawText || "");
    // Highlight conclusion connectors
    html = html.replace(
      /(ดังนั้น|ด้วยเหตุนี้|จึงวินิจฉัยว่า|จึงพิพากษา|จึงมีคำสั่ง)/g,
      '<span class="kw-conclusion">$1</span>'
    );
    // Highlight key legal holdings
    html = html.replace(
      /(จึงเป็นหน่วยงานทางปกครอง|จึงถือเป็นหน่วยงานทางปกครอง|จึงมิใช่หน่วยงานทางปกครอง|ไม่เป็นหน่วยงานทางปกครอง|จึงเป็นเจ้าหน้าที่ของรัฐ|จึงมิใช่เจ้าหน้าที่ของรัฐ|จึงเป็นคำสั่งทางปกครอง|จึงมิใช่คำสั่งทางปกครอง|ไม่ใช่คำสั่งทางปกครอง|จึงเป็นสัญญาทางปกครอง|จึงมิใช่สัญญาทางปกครอง|ไม่ใช่สัญญาทางปกครอง|ชอบด้วยกฎหมาย|ไม่ชอบด้วยกฎหมาย|เป็นการกระทำละเมิด|ไม่เป็นการกระทำละเมิด|อยู่ในอำนาจพิจารณาพิพากษาของศาลปกครอง|ไม่อยู่ในอำนาจพิจารณาพิพากษาของศาลปกครอง|พ้นกำหนดระยะเวลาการฟ้องคดี|ภายในกำหนดระยะเวลาการฟ้องคดี|เป็นผู้มีสิทธิฟ้องคดี|ไม่มีสิทธิฟ้องคดี)/g,
      '<span class="kw-holding">$1</span>'
    );
    // Highlight statutory sections
    html = html.replace(
      /(มาตรา\s*[๐-๙0-9]+(?:\s*วรรค[ก-๙]+)?(?:\s*\([๐-๙0-9]+\))?|ข้อ\s*[๐-๙0-9]+(?:\s*วรรค[ก-๙]+)?)/g,
      '<span class="kw-law">$1</span>'
    );
    return html;
  }

  // Load dataset
  const baseData = window.ADMIN_LAW_DATA || { toc: [], rulings: [], book_meta: {} };
  const STORAGE_KEY = "admin_law_diary_state_v1";

  // Application State
  const state = {
    currentView: "home",
    viewMode: "card", // 'card' | 'compact'
    shelfFilter: "all",
    shelfSearch: "",
    picksTab: "starred",
    pageSize: 25,
    filters: {
      q: "",
      part: "",
      chapter: "",
      section: "",
      type: "",
      status: ""
    },
    // Persisted user data
    progress: {},       // { [rulingId]: { read: bool, starred: bool, review: bool, note: string, updatedAt: number } }
    customRulings: [],  // Array of user-created ruling objects
    editedRulings: {},  // { [rulingId]: partial override object }
    deletedIds: {},     // { [rulingId]: true }
    // Flashcard state
    fcDeckType: "all",
    fcList: [],
    fcIndex: 0,
    fcFlipped: false
  };

  // Load persisted state from localStorage + optional local server
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state.progress = parsed.progress || {};
        state.customRulings = parsed.customRulings || [];
        state.editedRulings = parsed.editedRulings || {};
        state.deletedIds = parsed.deletedIds || {};
      }
    } catch (e) {
      console.warn("Failed to load localStorage state:", e);
    }
    // Also try fetching from local server.py if running
    fetch("/api/state")
      .then(r => (r.ok ? r.json() : null))
      .then(serverData => {
        if (serverData && serverData.updatedAt) {
          const localUpdated = Number(localStorage.getItem(STORAGE_KEY + "_ts") || 0);
          if (serverData.updatedAt > localUpdated) {
            state.progress = serverData.progress || state.progress;
            state.customRulings = serverData.customRulings || state.customRulings;
            state.editedRulings = serverData.editedRulings || state.editedRulings;
            state.deletedIds = serverData.deletedIds || state.deletedIds;
            refreshAllViews();
          }
        }
      })
      .catch(() => {});
  }

  function saveState() {
    const payload = {
      updatedAt: Date.now(),
      progress: state.progress,
      customRulings: state.customRulings,
      editedRulings: state.editedRulings,
      deletedIds: state.deletedIds
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      localStorage.setItem(STORAGE_KEY + "_ts", String(payload.updatedAt));
    } catch (e) {
      console.warn("Failed to save state to localStorage:", e);
    }
    // Sync to server.py if running
    fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }

  // Build flat lookup maps for Parts, Chapters, Sections
  const partsMap = new Map();
  const chaptersMap = new Map();
  const sectionsMap = new Map();

  baseData.toc.forEach(part => {
    partsMap.set(part.id, part);
    part.chapters.forEach(ch => {
      chaptersMap.set(ch.id, ch);
      ch.sections.forEach(sec => {
        sectionsMap.set(sec.id, sec);
      });
    });
  });

  // Get merged list of all active rulings (base + custom + edits - deleted)
  function getAllRulings() {
    const list = [];
    for (const r of baseData.rulings) {
      if (state.deletedIds[r.id]) continue;
      const override = state.editedRulings[r.id];
      list.push(override ? { ...r, ...override } : r);
    }
    for (const cr of state.customRulings) {
      if (state.deletedIds[cr.id]) continue;
      list.push(cr);
    }
    return list;
  }

  function getRulingProgress(id) {
    return state.progress[id] || { read: false, starred: false, review: false, note: "" };
  }

  function updateRulingProgress(id, patch) {
    const cur = getRulingProgress(id);
    state.progress[id] = { ...cur, ...patch, updatedAt: Date.now() };
    saveState();
    updateGlobalStats();
  }

  // =========================================================
  // UI Preferences: Theme, Sidebar Rail, Font, Size, Highlight
  // =========================================================
  const htmlEl = document.documentElement;

  function initPreferences() {
    const savedTheme = localStorage.getItem("hub-theme") || "light";
    htmlEl.setAttribute("data-theme", savedTheme);

    const savedRail = localStorage.getItem("hub-rail") || "expanded";
    if (savedRail === "collapsed") htmlEl.setAttribute("data-rail", "collapsed");

    const savedFont = localStorage.getItem("hub-font") || "sarabun";
    setReaderFont(savedFont, false);

    const savedSize = localStorage.getItem("hub-size") || "md";
    setReaderSize(savedSize, false);

    const savedHl = localStorage.getItem("hub-hl") || "on";
    setHighlightMode(savedHl, false);
  }

  function setReaderFont(fontKey, persist = true) {
    htmlEl.setAttribute("data-font", fontKey);
    document.querySelectorAll("[data-set-font]").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.setFont === fontKey);
    });
    if (persist) localStorage.setItem("hub-font", fontKey);
  }

  function setReaderSize(sizeKey, persist = true) {
    htmlEl.setAttribute("data-size", sizeKey);
    document.querySelectorAll("[data-set-size]").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.setSize === sizeKey);
    });
    if (persist) localStorage.setItem("hub-size", sizeKey);
  }

  function setHighlightMode(mode, persist = true) {
    htmlEl.setAttribute("data-highlight", mode);
    const btn = document.getElementById("btn-toggle-highlight");
    if (btn) {
      const span = btn.querySelector("span");
      if (span) span.textContent = `ไฮไลต์คำวินิจฉัย: ${mode === "on" ? "เปิด" : "ปิด"}`;
      btn.classList.toggle("hub-btn--primary", mode === "on");
    }
    if (persist) localStorage.setItem("hub-hl", mode);
  }

  // =========================================================
  // Navigation & Page-Flip Animation
  // =========================================================
  function triggerPageFlip() {
    const flip = document.getElementById("page-flip");
    if (!flip) return;
    flip.classList.remove("is-active");
    void flip.offsetWidth;
    flip.classList.add("is-active");
  }

  function navigateTo(viewName, skipFlip = false) {
    if (state.currentView !== viewName && !skipFlip) {
      triggerPageFlip();
    }
    state.currentView = viewName;
    htmlEl.classList.remove("hub-drawer-open");

    document.querySelectorAll(".app-view").forEach(el => {
      el.style.display = el.id === `view-${viewName}` ? "block" : "none";
    });

    document.querySelectorAll("[data-nav]").forEach(btn => {
      if (btn.classList.contains("hub-rail__item") || btn.classList.contains("hub-dock__item")) {
        if (btn.dataset.nav === viewName) {
          btn.setAttribute("aria-current", "page");
        } else {
          btn.removeAttribute("aria-current");
        }
      }
    });

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (viewName === "home") renderHomeView();
    else if (viewName === "diary") renderDiaryView();
    else if (viewName === "toc") renderTocView();
    else if (viewName === "picks") renderPicksView();
    else if (viewName === "flashcards") renderFlashcardsView();

    if (window.lucide) window.lucide.createIcons();
  }

  function openDiaryWithFilter(filterPatch) {
    state.filters = {
      q: "",
      part: "",
      chapter: "",
      section: "",
      type: "",
      status: "",
      ...filterPatch
    };
    state.pageSize = 25;
    syncFilterControlsFromState();
    navigateTo("diary");
  }

  // =========================================================
  // Global Stats & Counters
  // =========================================================
  function updateGlobalStats() {
    const rulings = getAllRulings();
    const total = rulings.length;
    let readCount = 0;
    let starredCount = 0;
    let reviewCount = 0;
    let notesCount = 0;

    for (const r of rulings) {
      const p = state.progress[r.id];
      if (!p) continue;
      if (p.read) readCount++;
      if (p.starred) starredCount++;
      if (p.review) reviewCount++;
      if (p.note && p.note.trim()) notesCount++;
    }

    const pct = total ? Math.round((readCount / total) * 100) : 0;

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setTxt("stat-total", total);
    setTxt("stat-starred", starredCount);
    setTxt("stat-read", readCount);
    setTxt("stat-review", reviewCount);
    setTxt("stat-progress-text", `ความคืบหน้าการอ่าน: ${readCount} / ${total} รายการ (${pct}%)`);
    setTxt("stat-notes-count", `โน้ตที่จดไว้: ${notesCount} รายการ`);
    setTxt("nav-badge-total", total);
    setTxt("nav-badge-starred", starredCount);
    setTxt("nav-badge-custom", state.customRulings.filter(x => !state.deletedIds[x.id]).length);

    const bar = document.getElementById("stat-progress-bar");
    if (bar) bar.style.width = `${pct}%`;
  }

  // =========================================================
  // VIEW 1: HOME HUB (Paths, Library Shelf, Topic Chips)
  // =========================================================
  function renderHomeView() {
    updateGlobalStats();
    renderPathsGrid();
    renderLibraryShelf();
    renderTopicChips();
    if (window.lucide) window.lucide.createIcons();
  }

  function renderPathsGrid() {
    const grid = document.getElementById("paths-grid");
    if (!grid) return;

    const rulings = getAllRulings();
    const gaCount = rulings.filter(r => r.is_general_assembly).length;

    const paths = [
      {
        tab: "VOLUME 01 · ภาคทั่วไป",
        title: "หัวใจการตรวจคำฟ้อง",
        subtitle: "โครงสร้าง อำนาจศาล และเงื่อนไขฟ้องคดี",
        blurb: "ปูพื้นฐาน ๕ บทหลักในภาคทั่วไป ใช้ตรวจสอบว่าคดีอยู่ในอำนาจศาลปกครองและครบเงื่อนไขการฟ้องคดีหรือไม่",
        highlight: {
          badge: "MUST READ · ออกสอบทุกสนาม",
          title: "บทที่ ๓ อำนาจศาลปกครอง (ม.๙) & บทที่ ๔ เงื่อนไขฟ้องคดี",
          filter: { part: "part-1", chapter: "part-1-ch-3" }
        },
        items: [
          { num: "01", title: "บทที่ ๑ โครงสร้างและเขตอำนาจศาลปกครองภูมิภาค ๑๔ แห่ง", sub: "ภาค ๑ · หน้า ๓๗", filter: { part: "part-1", chapter: "part-1-ch-1" } },
          { num: "02", title: "บทที่ ๒ หน่วยงานทางปกครอง และ เจ้าหน้าที่ของรัฐ (ม.๓)", sub: "ภาค ๑ · หน้า ๓๙", filter: { part: "part-1", chapter: "part-1-ch-2" }, stamp: "พื้นฐานสำคัญ" },
          { num: "03", title: "บทที่ ๓ อำนาจพิจารณาพิพากษาของศาลปกครอง (ม.๙ วรรคหนึ่ง)", sub: "ภาค ๑ · หน้า ๔๗", filter: { part: "part-1", chapter: "part-1-ch-3" }, stamp: "ออกสอบบ่อย" },
          { num: "04", title: "บทที่ ๔ เงื่อนไขแห่งการฟ้องคดีปกครอง (ผู้มีสิทธิฟ้อง/เยียวยา/อายุความ)", sub: "ภาค ๑ · หน้า ๙๓", filter: { part: "part-1", chapter: "part-1-ch-4" }, stamp: "ออกสอบบ่อย" },
          { num: "05", title: "บทที่ ๕ วิธีพิจารณาคดีปกครอง (คำฟ้อง/ทุเลาการบังคับ/อุทธรณ์)", sub: "ภาค ๑ · หน้า ๑๙๗", filter: { part: "part-1", chapter: "part-1-ch-5" } }
        ]
      },
      {
        tab: "VOLUME 02 · ภาคเฉพาะเรื่อง",
        title: "คดีปกครองเฉพาะเรื่องยอดฮิต",
        subtitle: "คัดบทสำคัญที่ออกสอบข้อเขียนบ่อยที่สุด",
        blurb: "เจาะลึกแนวคำวินิจฉัยเนื้อหาสาระ (Substantive Law) ตั้งแต่หลักกฎหมายทั่วไป ละเมิด สัญญา ไปจนถึงวินัยข้าราชการ",
        highlight: {
          badge: "HIGH YIELD · ประเด็นข้อสอบตุลาการ/พนักงานคดี",
          title: "บทที่ ๑ การนำหลักกฎหมายทั่วไปตามรัฐธรรมนูญมาใช้วินิจฉัย",
          filter: { part: "part-2", chapter: "part-2-ch-1" }
        },
        items: [
          { num: "01", title: "บทที่ ๑๗ คดีปกครองเกี่ยวกับการกระทำละเมิด", sub: "ภาค ๒ · หน้า ๔๖๕", filter: { part: "part-2", chapter: "part-2-ch-17" }, stamp: "ฮิตติดชาร์ต" },
          { num: "02", title: "บทที่ ๑๘ คดีปกครองเกี่ยวกับความรับผิดอย่างอื่น", sub: "ภาค ๒ · หน้า ๕๒๓", filter: { part: "part-2", chapter: "part-2-ch-18" } },
          { num: "03", title: "บทที่ ๑๙–๒๐ การพัสดุ และ สัญญาทางปกครอง", sub: "ภาค ๒ · หน้า ๕๖๕–๕๗๗", filter: { part: "part-2", chapter: "part-2-ch-20" }, stamp: "ออกสอบบ่อย" },
          { num: "04", title: "บทที่ ๓๑–๓๒ การบริหารงานบุคคล และ วินัยข้าราชการ", sub: "ภาค ๒ · หน้า ๗๐๙–๗๓๓", filter: { part: "part-2", chapter: "part-2-ch-32" }, stamp: "ฎีกาเยอะ" },
          { num: "05", title: "บทที่ ๔ & ๑๓ การควบคุมอาคาร/ผังเมือง และ ที่ดิน", sub: "ภาค ๒ · หน้า ๒๘๕, ๔๑๑", filter: { part: "part-2", chapter: "part-2-ch-4" } }
        ]
      },
      {
        tab: "VOLUME 03 · โหมดเตรียมสอบ",
        title: "สมุดเก็งข้อสอบ & ทบทวน",
        subtitle: "ประชุมใหญ่ · ปักหมุดเก็งสอบ · Flashcards",
        blurb: "รวบรวมคำพิพากษา/คำสั่งของที่ประชุมใหญ่ตุลาการในศาลปกครองสูงสุด และรายการที่คุณปักหมุดไว้ทบทวนโค้งสุดท้าย",
        highlight: {
          badge: `GENERAL ASSEMBLY · ${gaCount} คำวินิจฉัย`,
          title: "รวมคำพิพากษาและคำสั่งประชุมใหญ่ ศาลปกครองสูงสุด",
          filter: { type: "ga" }
        },
        items: [
          { num: "★", title: "รายการที่ปักหมุด ⭐ เก็งข้อสอบของฉัน", sub: "ทบทวนฎีกาเด่นที่คัดไว้", filter: { status: "starred" }, stamp: "เก็งสอบ" },
          { num: "↺", title: "รายการที่ติดป้าย 📌 ต้องทบทวนซ้ำ", sub: "ฎีกาที่ยังไม่แม่น ต้องอ่านซ้ำ", filter: { status: "review" } },
          { num: "✎", title: "รายการที่มี 📝 โน้ตสรุปส่วนตัวของฉัน", sub: "อ่านสรุปข้อสังเกตที่จดไว้", filter: { status: "has_note" } },
          { num: "＋", title: "คำพิพากษาที่ฉันบันทึกเพิ่มเติมเอง", sub: "ฎีกาจากเล่มอื่น / คำบรรยาย", filter: { type: "custom" } },
          { num: "⚡", title: "เปิดโหมด Flashcards ทดสอบความจำ", sub: "Active Recall ถาม-ตอบหลักกฎหมาย", nav: "flashcards", stamp: "แนะนำ" }
        ]
      }
    ];

    grid.innerHTML = paths.map(p => `
      <article class="hub-path">
        <span class="hub-path__tab">${escapeHtml(p.tab)}</span>
        <h3 class="hub-path__title">${escapeHtml(p.title)}</h3>
        <span class="hub-path__subtitle">${escapeHtml(p.subtitle)}</span>
        <p class="hub-path__blurb">${escapeHtml(p.blurb)}</p>

        <button type="button" class="hub-path__highlight" data-path-filter='${JSON.stringify(p.highlight.filter)}'>
          <div>
            <div class="hub-path__highlight-badge">${escapeHtml(p.highlight.badge)}</div>
            <div class="hub-path__highlight-title">${escapeHtml(p.highlight.title)}</div>
          </div>
          <i data-lucide="arrow-up-right"></i>
        </button>

        <ul class="hub-path__list">
          ${p.items.map((it, idx) => `
            <li>
              <button type="button" class="hub-path__item ${idx === 0 ? "hub-path__item--first" : ""}"
                ${it.nav ? `data-nav="${it.nav}"` : `data-path-filter='${JSON.stringify(it.filter)}'`}>
                <span class="hub-path__num">${escapeHtml(it.num)}</span>
                <span class="hub-path__txt">
                  ${escapeHtml(it.title)}
                  <small>${escapeHtml(it.sub)}</small>
                </span>
                ${it.stamp ? `<span class="hub-stamp">${escapeHtml(it.stamp)}</span>` : `<i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--sage-500);"></i>`}
              </button>
            </li>
          `).join("")}
        </ul>
      </article>
    `).join("");

    grid.querySelectorAll("[data-path-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        const f = JSON.parse(btn.dataset.pathFilter);
        openDiaryWithFilter(f);
      });
    });
    grid.querySelectorAll("[data-nav]").forEach(btn => {
      btn.addEventListener("click", () => navigateTo(btn.dataset.nav));
    });
  }

  function renderLibraryShelf() {
    const rulings = getAllRulings();
    // Compute ruling count & read count per chapter
    const chCounts = {};
    const chRead = {};
    rulings.forEach(r => {
      chCounts[r.chapter_id] = (chCounts[r.chapter_id] || 0) + 1;
      if (state.progress[r.id]?.read) {
        chRead[r.chapter_id] = (chRead[r.chapter_id] || 0) + 1;
      }
    });

    const q = normalizeForSearch(state.shelfSearch);
    const wrap1 = document.getElementById("shelf-part1-wrap");
    const wrap2 = document.getElementById("shelf-part2-wrap");
    const shelf1 = document.getElementById("shelf-part1");
    const shelf2 = document.getElementById("shelf-part2");
    if (!shelf1 || !shelf2) return;

    wrap1.style.display = (state.shelfFilter === "all" || state.shelfFilter === "part-1") ? "block" : "none";
    wrap2.style.display = (state.shelfFilter === "all" || state.shelfFilter === "part-2") ? "block" : "none";

    function renderChapterCard(ch, isPart1) {
      const total = chCounts[ch.id] || 0;
      const read = chRead[ch.id] || 0;
      const secCount = ch.sections.length;
      const isHighlighted = isPart1 || total >= 20;
      return `
        <button type="button" class="hub-book ${isPart1 ? "hub-book--sage" : ""}" data-ch-open="${ch.id}">
          <span class="hub-book__stub">${escapeHtml(ch.part_code)} · ${escapeHtml(ch.code)}</span>
          <div class="hub-book__top">
            <span class="hub-book__icon"><i data-lucide="${escapeHtml(ch.icon || "book-open")}"></i></span>
            ${read > 0 ? `<span class="hub-stamp hub-stamp--honey">อ่านแล้ว ${read}/${total}</span>` : ""}
          </div>
          <h4 class="hub-book__name">${escapeHtml(ch.title)}</h4>
          <span class="hub-book__sub">${secCount} หัวข้อย่อยในสารบัญ · หน้า ${ch.book_page}</span>
          <div class="hub-book__foot">
            <span>📚 ${total} คำวินิจฉัย</span>
            <span>เปิดอ่านบทนี้ →</span>
          </div>
        </button>
      `;
    }

    const part1Chs = (baseData.toc[0]?.chapters || []).filter(ch => !q || normalizeForSearch(ch.full_title).includes(q));
    const part2Chs = (baseData.toc[1]?.chapters || []).filter(ch => !q || normalizeForSearch(ch.full_title).includes(q));

    shelf1.innerHTML = part1Chs.length
      ? part1Chs.map(ch => renderChapterCard(ch, true)).join("")
      : `<p class="caption">ไม่พบบทที่ตรงกับคำค้นหาในภาค ๑</p>`;

    shelf2.innerHTML = part2Chs.length
      ? part2Chs.map(ch => renderChapterCard(ch, false)).join("")
      : `<p class="caption">ไม่พบบทที่ตรงกับคำค้นหาในภาค ๒</p>`;

    document.querySelectorAll("[data-ch-open]").forEach(btn => {
      btn.addEventListener("click", () => {
        const cid = btn.dataset.chOpen;
        const ch = chaptersMap.get(cid);
        openDiaryWithFilter({
          part: ch ? ch.part_id : "",
          chapter: cid
        });
      });
    });
  }

  function renderTopicChips() {
    const container = document.getElementById("topic-chips");
    if (!container) return;

    const topics = [
      { label: "หน่วยงานทางปกครอง", q: "หน่วยงานทางปกครอง" },
      { label: "เจ้าหน้าที่ของรัฐ", q: "เจ้าหน้าที่ของรัฐ" },
      { label: "กฎ (การออกกฎ)", q: "การออกกฎ" },
      { label: "คำสั่งทางปกครอง", q: "คำสั่งทางปกครอง" },
      { label: "การละเลยต่อหน้าที่ / ล่าช้า", q: "ละเลยต่อหน้าที่" },
      { label: "ละเมิดทางปกครอง", q: "กระทำละเมิด" },
      { label: "สัญญาทางปกครอง", q: "สัญญาทางปกครอง" },
      { label: "ผู้มีสิทธิฟ้องคดี (ม.๔๒)", q: "มาตรา ๔๒" },
      { label: "การแก้ไขเยียวยาทุกข์ชั้นต้น", q: "แก้ไขหรือบรรเทา" },
      { label: "ระยะเวลาการฟ้องคดี (อายุความ)", q: "ระยะเวลาการฟ้องคดี" },
      { label: "การทุเลาการบังคับตามคำสั่ง", q: "ทุเลาการบังคับ" },
      { label: "หลักความได้สัดส่วน", q: "หลักความได้สัดส่วน" },
      { label: "หลักความเสมอภาค / ไม่เลือกปฏิบัติ", q: "ความเท่าเทียม" },
      { label: "การควบคุมอาคาร", q: "ควบคุมอาคาร" },
      { label: "ที่ดิน / ทางสาธารณประโยชน์", q: "สาธารณประโยชน์" },
      { label: "การจัดซื้อจัดจ้าง / พัสดุ", q: "การจัดซื้อจัดจ้าง" },
      { label: "อนุญาโตตุลาการ", q: "อนุญาโตตุลาการ" },
      { label: "ข้อมูลข่าวสารของราชการ", q: "ข้อมูลข่าวสาร" },
      { label: "บริหารงานบุคคล / เลื่อนตำแหน่ง", q: "บริหารงานบุคคล" },
      { label: "วินัยข้าราชการ / ไล่ออก-ปลดออก", q: "โทษทางวินัย" },
      { label: "ความรับผิดทางละเมิดของเจ้าหน้าที่", q: "ความรับผิดทางละเมิดของเจ้าหน้าที่" },
      { label: "ประชุมใหญ่ตุลาการศาลปกครองสูงสุด", q: "ประชุมใหญ่" }
    ];

    const rulings = getAllRulings();
    container.innerHTML = topics.map(t => {
      const nq = normalizeForSearch(t.q);
      const count = rulings.filter(r =>
        normalizeForSearch((r.facts || r.content || "") + " " + r.section_full_title + " " + r.chapter_title + " " + r.citation).includes(nq)
      ).length;
      return `
        <button type="button" class="hub-chip" data-topic-q="${escapeHtml(t.q)}">
          <span>${escapeHtml(t.label)}</span>
          <span class="hub-chip__count">${count}</span>
        </button>
      `;
    }).join("");

    container.querySelectorAll("[data-topic-q]").forEach(btn => {
      btn.addEventListener("click", () => {
        openDiaryWithFilter({ q: btn.dataset.topicQ });
      });
    });
  }

  // =========================================================
  // VIEW 2: DIARY / ARCHIVE (Filter & Rulings List)
  // =========================================================
  function populateChapterFilterDropdown(selectedPartId, selectedChapterId) {
    const chSel = document.getElementById("filter-chapter");
    if (!chSel) return;
    let html = `<option value="">ทุกบท (${selectedPartId ? "ในภาคที่เลือก" : "ครบ ๓๙ บทตามสารบัญ"})</option>`;
    baseData.toc.forEach(part => {
      if (selectedPartId && part.id !== selectedPartId) return;
      html += `<optgroup label="${escapeHtml(part.title)}">`;
      part.chapters.forEach(ch => {
        const sel = ch.id === selectedChapterId ? "selected" : "";
        html += `<option value="${ch.id}" ${sel}>${escapeHtml(ch.code)} · ${escapeHtml(ch.title)}</option>`;
      });
      html += `</optgroup>`;
    });
    chSel.innerHTML = html;
  }

  function populateSectionFilterDropdown(selectedChapterId, selectedSectionId) {
    const secSel = document.getElementById("filter-section");
    if (!secSel) return;
    if (!selectedChapterId) {
      secSel.innerHTML = `<option value="">ทุกหมวดหมู่ย่อยในสารบัญ (เลือกบทเพื่อกรองหมวดย่อย)</option>`;
      return;
    }
    const ch = chaptersMap.get(selectedChapterId);
    if (!ch) return;
    let html = `<option value="">ทุกหมวดหมู่ย่อยใน ${escapeHtml(ch.code)} (${ch.sections.length} หมวดย่อย)</option>`;
    ch.sections.forEach(sec => {
      const indent = "—".repeat(Math.max(0, sec.level - 1));
      const prefix = indent ? `${indent} ` : "";
      const sel = sec.id === selectedSectionId ? "selected" : "";
      html += `<option value="${sec.id}" ${sel}>${prefix}${escapeHtml(sec.full_title)}</option>`;
    });
    secSel.innerHTML = html;
  }

  function syncFilterControlsFromState() {
    const qInput = document.getElementById("filter-q");
    const partSel = document.getElementById("filter-part");
    const typeSel = document.getElementById("filter-type");
    const statusSel = document.getElementById("filter-status");

    if (qInput) qInput.value = state.filters.q || "";
    if (partSel) partSel.value = state.filters.part || "";
    populateChapterFilterDropdown(state.filters.part, state.filters.chapter);
    populateSectionFilterDropdown(state.filters.chapter, state.filters.section);
    if (typeSel) typeSel.value = state.filters.type || "";
    if (statusSel) statusSel.value = state.filters.status || "";
  }

  function getFilteredRulings() {
    const rulings = getAllRulings();
    const { q, part, chapter, section, type, status } = state.filters;
    const nq = normalizeForSearch(q);

    // If a parent section is selected, include all its child sub-sections in the same chapter!
    let allowedSectionIds = null;
    if (section) {
      allowedSectionIds = new Set([section]);
      const selSec = sectionsMap.get(section);
      if (selSec) {
        const ch = chaptersMap.get(selSec.chapter_id);
        if (ch) {
          const startIdx = ch.sections.findIndex(s => s.id === section);
          if (startIdx !== -1) {
            for (let i = startIdx + 1; i < ch.sections.length; i++) {
              if (ch.sections[i].level > selSec.level) {
                allowedSectionIds.add(ch.sections[i].id);
              } else {
                break;
              }
            }
          }
        }
      }
    }

    return rulings.filter(r => {
      if (part && r.part_id !== part) return false;
      if (chapter && r.chapter_id !== chapter) return false;
      if (allowedSectionIds && !allowedSectionIds.has(r.section_id)) return false;

      if (type === "ga") {
        if (!r.is_general_assembly) return false;
      } else if (type === "custom") {
        if (!r.is_custom) return false;
      } else if (type) {
        if (r.ruling_type !== type) return false;
      }

      const prog = getRulingProgress(r.id);
      if (status === "starred" && !prog.starred) return false;
      if (status === "review" && !prog.review) return false;
      if (status === "read" && !prog.read) return false;
      if (status === "unread" && prog.read) return false;
      if (status === "has_note" && !(prog.note && prog.note.trim())) return false;

      if (nq) {
        const haystack = normalizeForSearch(
          `${r.citation} ${r.short_citation} ${r.title} ${r.principle} ${r.facts || r.content || ""} ${r.chapter_title} ${(r.section_path || []).join(" ")} ${(r.laws || []).join(" ")} ${prog.note || ""}`
        );
        // Support multi-word search
        const terms = nq.split(" ").filter(Boolean);
        for (const term of terms) {
          if (!haystack.includes(term)) return false;
        }
      }
      return true;
    });
  }

  function renderActiveFilterChips() {
    const wrap = document.getElementById("active-filters");
    if (!wrap) return;
    const chips = [];
    const { q, part, chapter, section, type, status } = state.filters;

    if (q) chips.push({ key: "q", label: `คำค้น: "${q}"` });
    if (part) {
      const pObj = partsMap.get(part);
      chips.push({ key: "part", label: pObj ? pObj.title : part });
    }
    if (chapter) {
      const chObj = chaptersMap.get(chapter);
      chips.push({ key: "chapter", label: chObj ? `${chObj.code} ${chObj.title}` : chapter });
    }
    if (section) {
      const secObj = sectionsMap.get(section);
      chips.push({ key: "section", label: secObj ? secObj.full_title : section });
    }
    if (type) {
      const mapType = { ga: "ประชุมใหญ่", custom: "ที่บันทึกเพิ่มเอง", "คำพิพากษา": "คำพิพากษา", "คำสั่ง": "คำสั่ง" };
      chips.push({ key: "type", label: `ประเภท: ${mapType[type] || type}` });
    }
    if (status) {
      const mapSt = { starred: "⭐ เก็งข้อสอบ", review: "📌 ต้องทบทวนซ้ำ", read: "✅ อ่านแล้ว", unread: "⏳ ยังไม่อ่าน", has_note: "📝 มีโน้ตสรุป" };
      chips.push({ key: "status", label: `สถานะ: ${mapSt[status] || status}` });
    }

    if (!chips.length) {
      wrap.innerHTML = "";
      return;
    }

    wrap.innerHTML = chips.map(c => `
      <button type="button" class="hub-chip is-active" data-clear-filter="${c.key}">
        <span>${escapeHtml(c.label)}</span>
        <span>×</span>
      </button>
    `).join("") + `
      <button type="button" class="hub-chip" data-clear-filter="all">ล้างตัวกรองทั้งหมด</button>
    `;

    wrap.querySelectorAll("[data-clear-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        const k = btn.dataset.clearFilter;
        if (k === "all") {
          state.filters = { q: "", part: "", chapter: "", section: "", type: "", status: "" };
        } else if (k === "part") {
          state.filters.part = "";
          state.filters.chapter = "";
          state.filters.section = "";
        } else if (k === "chapter") {
          state.filters.chapter = "";
          state.filters.section = "";
        } else {
          state.filters[k] = "";
        }
        state.pageSize = 25;
        syncFilterControlsFromState();
        renderDiaryView();
      });
    });
  }

  function renderRulingCardHtml(r) {
    const prog = getRulingProgress(r.id);
    const isOrder = r.ruling_type === "คำสั่ง";
    const citeClass = isOrder ? "ruling-cite-badge--order" : "ruling-cite-badge--judgment";
    const pathStr = (r.section_path && r.section_path.length)
      ? r.section_path.join(" › ")
      : r.section_full_title;

    const showFactsDrawer = r.facts && r.facts.trim() && r.facts.trim() !== r.principle.trim();

    return `
      <article class="ruling-card ${prog.starred ? "is-starred" : ""}" id="card-${r.id}">
        <div class="ruling-card__top">
          <div class="ruling-card__breadcrumb">
            <span class="ruling-card__ch-badge" data-filter-ch="${r.chapter_id}" title="คลิกเพื่อดูทั้งบทนี้">
              ${escapeHtml(r.part_code)} · ${escapeHtml(r.chapter_code)} ${escapeHtml(r.chapter_title.slice(0, 38))}${r.chapter_title.length > 38 ? "…" : ""}
            </span>
            <span class="ruling-card__sec-badge" data-filter-sec="${r.section_id || ""}" data-filter-sec-ch="${r.chapter_id}" title="คลิกเพื่อกรองเฉพาะหัวข้อย่อยนี้">
              ${escapeHtml(pathStr)}
            </span>
          </div>

          <div class="ruling-card__badges">
            ${r.is_general_assembly ? `<span class="hub-stamp">🏛️ ประชุมใหญ่</span>` : ""}
            ${r.is_custom ? `<span class="hub-stamp hub-stamp--sage">✍️ บันทึกเอง (${escapeHtml(r.source_vol || "เพิ่มเติม")})</span>` : ""}
            <span class="ruling-cite-badge ${citeClass}" title="${escapeHtml(r.citation)}">
              ${escapeHtml(r.short_citation || r.citation)}
            </span>
          </div>
        </div>

        <h3 class="ruling-card__title">${escapeHtml(r.title)}</h3>

        <div class="ruling-principle">
          <div class="ruling-principle__label">
            <i data-lucide="sparkles" style="width:14px;height:14px;"></i>
            หลักกฎหมาย / แนวคำวินิจฉัยสำคัญ
          </div>
          <div>${formatLegalText(r.principle)}</div>
        </div>

        ${showFactsDrawer ? `
          <details class="ruling-details">
            <summary>
              <i data-lucide="book-open-text" style="width:16px;height:16px;"></i>
              อ่านข้อเท็จจริงและเหตุผลแห่งคำวินิจฉัยฉบับเต็ม (${escapeHtml(r.citation)})
            </summary>
            <div class="ruling-facts">${formatLegalText(r.facts)}</div>
          </details>
        ` : ""}

        ${(r.laws && r.laws.length) ? `
          <div class="ruling-laws">
            ${r.laws.map(law => `
              <button type="button" class="law-pill" data-law-q="${escapeHtml(law)}">⚖️ ${escapeHtml(law)}</button>
            `).join("")}
          </div>
        ` : ""}

        ${prog.note && prog.note.trim() ? `
          <div class="exam-note-display">
            <div class="exam-note-display__hd">
              <i data-lucide="pen-line" style="width:16px;height:16px;"></i> บันทึกช่วยจำเตรียมสอบของฉัน:
            </div>
            <div style="white-space:pre-line;">${escapeHtml(prog.note)}</div>
          </div>
        ` : ""}

        <!-- Inline Note Editor (Hidden until toggled) -->
        <div class="inline-note-editor" id="note-editor-${r.id}" style="display:none; background:var(--cream-100); padding:12px; border:2px solid var(--line-ink); border-radius:var(--radius-md);">
          <label style="font-weight:600; font-size:14px; display:block; margin-bottom:6px;">📝 จดบันทึกช่วยจำเตรียมสอบ / จุดออกสอบ:</label>
          <textarea class="form-textarea" id="note-textarea-${r.id}" style="min-height:80px; width:100%;">${escapeHtml(prog.note || "")}</textarea>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
            <button type="button" class="hub-btn hub-btn--xs hub-btn--ghost" data-cancel-note="${r.id}">ปิด</button>
            <button type="button" class="hub-btn hub-btn--xs hub-btn--primary" data-save-note="${r.id}">บันทึกโน้ต</button>
          </div>
        </div>

        <div class="ruling-card__actions">
          <div class="ruling-status-group">
            <button type="button" class="status-toggle ${prog.read ? "is-read" : ""}" data-toggle-status="read" data-id="${r.id}">
              <i data-lucide="check-circle-2"></i> ${prog.read ? "อ่านเข้าใจแล้ว" : "ทำเครื่องหมายว่าอ่านแล้ว"}
            </button>
            <button type="button" class="status-toggle ${prog.starred ? "is-starred" : ""}" data-toggle-status="starred" data-id="${r.id}">
              <i data-lucide="star"></i> ${prog.starred ? "เก็งข้อสอบ ⭐" : "ปักหมุดเก็งข้อสอบ"}
            </button>
            <button type="button" class="status-toggle ${prog.review ? "is-review" : ""}" data-toggle-status="review" data-id="${r.id}">
              <i data-lucide="rotate-ccw"></i> ${prog.review ? "ต้องทบทวนซ้ำ 📌" : "ทบทวนซ้ำ"}
            </button>
            <button type="button" class="status-toggle" data-open-note="${r.id}">
              <i data-lucide="sticky-note"></i> ${prog.note && prog.note.trim() ? "แก้ไขโน้ตสรุป" : "จดโน้ตสรุป"}
            </button>
          </div>

          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            ${r.pdf_page && r.pdf_file ? `
              <a href="${encodeURIComponent(r.pdf_file)}#page=${r.pdf_page}" target="_blank" rel="noopener" class="hub-btn hub-btn--xs" title="เปิดอ่านในไฟล์ PDF ต้นฉบับ หน้า ${r.book_page || r.pdf_page}">
                <i data-lucide="file-text"></i> หน้า ${r.book_page || r.pdf_page} (PDF)
              </a>
            ` : ""}
            <button type="button" class="hub-btn hub-btn--xs" data-edit-ruling="${r.id}" title="แก้ไขข้อมูลคำพิพากษานี้">
              <i data-lucide="edit-3"></i> แก้ไข
            </button>
            ${r.is_custom ? `
              <button type="button" class="hub-btn hub-btn--xs hub-btn--tomato" data-delete-ruling="${r.id}" title="ลบรายการนี้">
                <i data-lucide="trash-2"></i>
              </button>
            ` : ""}
          </div>
        </div>
      </article>
    `;
  }

  function renderCompactLedgerRowHtml(r) {
    const prog = getRulingProgress(r.id);
    return `
      <details class="ledger-row">
        <summary>
          <span class="ruling-cite-badge ${r.ruling_type === "คำสั่ง" ? "ruling-cite-badge--order" : "ruling-cite-badge--judgment"}" style="text-align:center;">
            ${escapeHtml(r.short_citation)}
          </span>
          <span style="font-weight:500;">
            ${prog.starred ? "⭐ " : ""}${prog.read ? "✅ " : ""}${r.is_general_assembly ? `<span class="hub-stamp" style="margin-right:6px;">ประชุมใหญ่</span>` : ""}
            ${escapeHtml(r.title)}
          </span>
          <span class="caption" style="font-family:var(--font-mono); white-space:nowrap;">${escapeHtml(r.part_code)} · ${escapeHtml(r.chapter_code)}</span>
          <i data-lucide="chevron-down" style="width:18px;height:18px;color:var(--fg-3);"></i>
        </summary>
        <div class="ledger-row__body">
          ${renderRulingCardHtml(r)}
        </div>
      </details>
    `;
  }

  function bindCardInteractions(container) {
    if (!container) return;

    container.querySelectorAll("[data-toggle-status]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const field = btn.dataset.toggleStatus;
        const cur = getRulingProgress(id);
        updateRulingProgress(id, { [field]: !cur[field] });
        if (state.currentView === "diary") renderDiaryView();
        else if (state.currentView === "picks") renderPicksView();
      });
    });

    container.querySelectorAll("[data-open-note]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.openNote;
        const editor = document.getElementById(`note-editor-${id}`);
        if (editor) {
          editor.style.display = editor.style.display === "none" ? "block" : "none";
          const ta = document.getElementById(`note-textarea-${id}`);
          if (ta) ta.focus();
        }
      });
    });

    container.querySelectorAll("[data-cancel-note]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.cancelNote;
        const editor = document.getElementById(`note-editor-${id}`);
        if (editor) editor.style.display = "none";
      });
    });

    container.querySelectorAll("[data-save-note]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.saveNote;
        const ta = document.getElementById(`note-textarea-${id}`);
        if (ta) {
          updateRulingProgress(id, { note: ta.value.trim() });
          if (state.currentView === "diary") renderDiaryView();
          else if (state.currentView === "picks") renderPicksView();
        }
      });
    });

    container.querySelectorAll("[data-filter-ch]").forEach(badge => {
      badge.addEventListener("click", () => {
        const cid = badge.dataset.filterCh;
        const ch = chaptersMap.get(cid);
        openDiaryWithFilter({ part: ch ? ch.part_id : "", chapter: cid });
      });
    });

    container.querySelectorAll("[data-filter-sec]").forEach(badge => {
      badge.addEventListener("click", () => {
        const sid = badge.dataset.filterSec;
        const cid = badge.dataset.filterSecCh;
        const ch = chaptersMap.get(cid);
        openDiaryWithFilter({ part: ch ? ch.part_id : "", chapter: cid, section: sid });
      });
    });

    container.querySelectorAll("[data-law-q]").forEach(pill => {
      pill.addEventListener("click", () => {
        openDiaryWithFilter({ q: pill.dataset.lawQ });
      });
    });

    container.querySelectorAll("[data-edit-ruling]").forEach(btn => {
      btn.addEventListener("click", () => {
        openRulingModal(btn.dataset.editRuling);
      });
    });

    container.querySelectorAll("[data-delete-ruling]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.deleteRuling;
        if (confirm("ต้องการลบคำพิพากษานี้ออกจากสมุดบันทึกใช่หรือไม่?")) {
          state.deletedIds[id] = true;
          saveState();
          refreshAllViews();
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function renderDiaryView() {
    updateGlobalStats();
    const filtered = getFilteredRulings();
    const container = document.getElementById("rulings-container");
    const countEl = document.getElementById("filter-count");
    const loadMoreBtn = document.getElementById("btn-load-more");
    const headingEl = document.getElementById("diary-heading");

    if (headingEl) {
      if (state.filters.chapter) {
        const ch = chaptersMap.get(state.filters.chapter);
        headingEl.textContent = ch ? `${ch.code} · ${ch.title}` : "คลังคำพิพากษา";
      } else if (state.filters.part) {
        const p = partsMap.get(state.filters.part);
        headingEl.textContent = p ? p.title : "คลังคำพิพากษา";
      } else {
        headingEl.textContent = "คลังคำพิพากษาทั้งหมด";
      }
    }

    if (countEl) {
      countEl.textContent = `พบ ${filtered.length} รายการ`;
    }

    renderActiveFilterChips();

    const visible = filtered.slice(0, state.pageSize);
    if (!visible.length) {
      container.innerHTML = `
        <div class="ink-outline" style="padding:36px; text-align:center;">
          <h3 style="margin:0 0 8px;">ยังไม่มีคำพิพากษาในหมวดหมู่หรือคำค้นหานี้</h3>
          <p style="margin:0 auto 18px; max-width:50ch;">
            ในบางหัวข้อย่อยของสารบัญอาจยังไม่มีคำพิพากษาบรรจุอยู่ คุณสามารถกดปุ่มด้านล่างเพื่อบันทึกคำพิพากษาเพิ่มเติม หรืออัปโหลดไฟล์ PDF เล่มอื่นเข้าสู่คลังได้ทันที
          </p>
          <button type="button" class="hub-btn hub-btn--md hub-btn--honey" id="btn-empty-add">
            <i data-lucide="plus-circle"></i> บันทึกคำพิพากษาใหม่ในหมวดนี้
          </button>
        </div>
      `;
      const emptyAdd = document.getElementById("btn-empty-add");
      if (emptyAdd) {
        emptyAdd.addEventListener("click", () => openRulingModal(null, state.filters));
      }
    } else {
      container.innerHTML = visible.map(r =>
        state.viewMode === "compact" ? renderCompactLedgerRowHtml(r) : renderRulingCardHtml(r)
      ).join("");
      bindCardInteractions(container);
    }

    if (loadMoreBtn) {
      loadMoreBtn.style.display = filtered.length > state.pageSize ? "inline-flex" : "none";
    }
    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================
  // VIEW 3: TOC EXPLORER (สารบัญหนังสือครบ 632 หมวด)
  // =========================================================
  function renderTocView() {
    const container = document.getElementById("toc-tree-container");
    if (!container) return;

    const searchInput = document.getElementById("toc-search");
    const q = normalizeForSearch(searchInput ? searchInput.value : "");

    const rulings = getAllRulings();
    const secCounts = {};
    const chCounts = {};
    rulings.forEach(r => {
      chCounts[r.chapter_id] = (chCounts[r.chapter_id] || 0) + 1;
      if (r.section_id) {
        secCounts[r.section_id] = (secCounts[r.section_id] || 0) + 1;
      }
    });

    container.innerHTML = baseData.toc.map(part => {
      const chaptersHtml = part.chapters.map(ch => {
        const matchingSecs = ch.sections.filter(sec =>
          !q || normalizeForSearch(sec.full_title).includes(q) || normalizeForSearch(ch.full_title).includes(q)
        );
        if (q && !matchingSecs.length && !normalizeForSearch(ch.full_title).includes(q)) {
          return "";
        }
        const totalInCh = chCounts[ch.id] || 0;
        const isOpenAttr = q ? "open" : "";
        return `
          <details class="toc-ch-details" ${isOpenAttr}>
            <summary>
              <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <span class="hub-pill hub-pill--sage">${escapeHtml(ch.code)}</span>
                <span>${escapeHtml(ch.title)}</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                <span class="hub-pill" style="font-family:var(--font-mono); font-size:12px;">${totalInCh} คำวินิจฉัย · หน้า ${ch.book_page}</span>
                <button type="button" class="hub-btn hub-btn--xs" data-toc-open-ch="${ch.id}">ดูทั้งบท</button>
              </div>
            </summary>
            <div class="toc-sec-list">
              ${matchingSecs.map(sec => {
                const cnt = secCounts[sec.id] || 0;
                return `
                  <div class="toc-sec-row toc-sec-row--lvl-${sec.level}">
                    <a style="cursor:pointer; text-decoration:none; flex:1;" data-toc-open-sec="${sec.id}" data-toc-ch="${ch.id}">
                      ${escapeHtml(sec.full_title)}
                      <span class="caption" style="font-family:var(--font-mono); margin-left:6px;">(หน้า ${sec.book_page})</span>
                    </a>
                    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                      ${cnt > 0
                        ? `<button type="button" class="hub-btn hub-btn--xs hub-btn--primary" data-toc-open-sec="${sec.id}" data-toc-ch="${ch.id}">${cnt} ฎีกา</button>`
                        : `<span class="caption" style="font-size:12px;">ว่าง</span>`
                      }
                      <button type="button" class="hub-btn hub-btn--xs hub-btn--honey" data-toc-add-sec="${sec.id}" data-toc-ch="${ch.id}" title="บันทึกคำพิพากษาเพิ่มในหัวข้อนี้">
                        + เพิ่มฎีกา
                      </button>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </details>
        `;
      }).filter(Boolean).join("");

      return `
        <div class="toc-part-card">
          <div class="toc-part-card__head">
            <div>
              <span class="hub-eyebrow" style="margin:0;">${escapeHtml(part.code)}</span>
              <h2 style="margin:2px 0 0;">${escapeHtml(part.title)}</h2>
            </div>
            <span class="caption">${escapeHtml(part.subtitle)} (${part.chapters.length} บท)</span>
          </div>
          ${chaptersHtml || `<p class="caption">ไม่พบหัวข้อที่ตรงกับคำค้นหา</p>`}
        </div>
      `;
    }).join("");

    container.querySelectorAll("[data-toc-open-ch]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const cid = btn.dataset.tocOpenCh;
        const ch = chaptersMap.get(cid);
        openDiaryWithFilter({ part: ch ? ch.part_id : "", chapter: cid });
      });
    });

    container.querySelectorAll("[data-toc-open-sec]").forEach(el => {
      el.addEventListener("click", () => {
        const sid = el.dataset.tocOpenSec;
        const cid = el.dataset.tocCh;
        const ch = chaptersMap.get(cid);
        openDiaryWithFilter({ part: ch ? ch.part_id : "", chapter: cid, section: sid });
      });
    });

    container.querySelectorAll("[data-toc-add-sec]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const sid = btn.dataset.tocAddSec;
        const cid = btn.dataset.tocCh;
        const ch = chaptersMap.get(cid);
        openRulingModal(null, {
          part: ch ? ch.part_id : "part-1",
          chapter: cid,
          section: sid
        });
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================
  // VIEW 4: MY EXAM PICKS & NOTES
  // =========================================================
  function renderPicksView() {
    updateGlobalStats();
    const container = document.getElementById("picks-container");
    if (!container) return;

    const rulings = getAllRulings();
    const filtered = rulings.filter(r => {
      const p = getRulingProgress(r.id);
      if (state.picksTab === "starred") return p.starred;
      if (state.picksTab === "review") return p.review;
      if (state.picksTab === "notes") return Boolean(p.note && p.note.trim());
      if (state.picksTab === "ga") return r.is_general_assembly;
      if (state.picksTab === "custom") return r.is_custom;
      return false;
    });

    if (!filtered.length) {
      const emptyMessages = {
        starred: "ยังไม่มีรายการที่ปักหมุด ⭐ เก็งข้อสอบ — คุณสามารถกดปุ่ม 'ปักหมุดเก็งข้อสอบ' ในการ์ดคำพิพากษาใดก็ได้เพื่อรวบรวมไว้ที่นี่",
        review: "ยังไม่มีรายการที่ติดป้าย 📌 ต้องทบทวนซ้ำ",
        notes: "ยังไม่มีรายการที่คุณจดบันทึกช่วยจำ — กดปุ่ม 'จดโน้ตสรุป' ในการ์ดคำพิพากษาเพื่อเพิ่มข้อสังเกตส่วนตัว",
        ga: "ไม่พบคำวินิจฉัยประชุมใหญ่",
        custom: "ยังไม่มีคำพิพากษาที่คุณบันทึกเพิ่มเอง — กดปุ่ม '+ บันทึกคำพิพากษาใหม่' เพื่อเพิ่มฎีกาเข้าสมุดได้เลย"
      };
      container.innerHTML = `
        <div class="ink-outline" style="padding:36px; text-align:center;">
          <p style="margin:0 auto 16px; max-width:52ch;">${escapeHtml(emptyMessages[state.picksTab])}</p>
          <button type="button" class="hub-btn hub-btn--sm hub-btn--primary" data-nav="diary">ไปที่คลังคำพิพากษา →</button>
        </div>
      `;
      container.querySelector("[data-nav]")?.addEventListener("click", () => navigateTo("diary"));
      return;
    }

    container.innerHTML = filtered.map(r => renderRulingCardHtml(r)).join("");
    bindCardInteractions(container);
  }

  // =========================================================
  // VIEW 5: FLASHCARDS / ACTIVE RECALL
  // =========================================================
  function buildFlashcardDeck() {
    const rulings = getAllRulings();
    let pool = rulings.filter(r => {
      const p = getRulingProgress(r.id);
      if (state.fcDeckType === "part-1") return r.part_id === "part-1";
      if (state.fcDeckType === "part-2") return r.part_id === "part-2";
      if (state.fcDeckType === "starred") return p.starred;
      if (state.fcDeckType === "review") return p.review;
      if (state.fcDeckType === "ga") return r.is_general_assembly;
      return true;
    });
    if (!pool.length) pool = rulings;
    // Shuffle copy
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    state.fcList = shuffled;
    state.fcIndex = 0;
    state.fcFlipped = false;
  }

  function renderFlashcardsView() {
    if (!state.fcList.length) {
      buildFlashcardDeck();
    }
    const stage = document.getElementById("flashcard-stage");
    if (!stage) return;

    const r = state.fcList[state.fcIndex];
    if (!r) {
      stage.innerHTML = `<div class="ink-outline" style="padding:32px; text-align:center;">ไม่มีการ์ดในชุดที่เลือก</div>`;
      return;
    }

    const prog = getRulingProgress(r.id);
    const total = state.fcList.length;
    const idx = state.fcIndex + 1;
    const pathStr = (r.section_path || []).join(" › ");

    // Create a question prompt from the facts (without giving away the citation or final sentence)
    const questionPreview = r.facts && r.facts.length > 40
      ? r.facts.slice(0, 420) + (r.facts.length > 420 ? "…" : "")
      : `ประเด็นตามหมวด: ${pathStr}`;

    stage.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <span class="hub-pill hub-pill--sage">การ์ดใบที่ ${idx} / ${total}</span>
        <div style="display:flex; gap:8px;">
          <button type="button" class="hub-btn hub-btn--xs" id="fc-prev" ${state.fcIndex === 0 ? "disabled" : ""}>← ก่อนหน้า</button>
          <button type="button" class="hub-btn hub-btn--xs" id="fc-next">ใบถัดไป →</button>
        </div>
      </div>

      <div class="flashcard-box ${state.fcFlipped ? "is-flipped" : ""}" id="fc-card">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
            <span class="ruling-card__ch-badge">${escapeHtml(r.part_code)} · ${escapeHtml(r.chapter_code)} ${escapeHtml(r.chapter_title)}</span>
            ${r.is_general_assembly ? `<span class="hub-stamp">🏛️ ประชุมใหญ่</span>` : ""}
          </div>
          <div class="caption" style="margin-bottom:8px; font-weight:600; color:var(--sage-600);">
            หมวดหมู่สารบัญ: ${escapeHtml(pathStr)}
          </div>
          <h3 style="margin:6px 0 14px; font-size:22px;">
            ❓ ประเด็นวินิจฉัย: ${escapeHtml(r.title)}
          </h3>
          <p style="font-size:var(--reader-font-size); line-height:var(--reader-line-height); background:var(--cream-100); padding:14px 16px; border-radius:var(--radius-md); border:1.5px dashed var(--sage-400);">
            ${escapeHtml(questionPreview)}
          </p>
        </div>

        ${!state.fcFlipped ? `
          <div style="text-align:center; padding-top:12px;">
            <span class="hub-btn hub-btn--md hub-btn--honey">
              <i data-lucide="eye"></i> คลิกเพื่อพลิกดูแนวคำวินิจฉัยศาลปกครองสูงสุด
            </span>
          </div>
        ` : `
          <div class="flashcard-answer">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
              <span class="ruling-principle__label" style="margin:0;">💡 แนวคำวินิจฉัยศาลปกครองสูงสุด</span>
              <span class="ruling-cite-badge">${escapeHtml(r.citation)}</span>
            </div>
            <div class="ruling-principle" style="margin-bottom:12px;">
              ${formatLegalText(r.principle)}
            </div>
            ${prog.note ? `<div class="exam-note-display"><strong>📝 โน้ตของฉัน:</strong> ${escapeHtml(prog.note)}</div>` : ""}
          </div>
        `}
      </div>

      <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
        <button type="button" class="hub-btn hub-btn--sm ${prog.review ? "hub-btn--tomato" : ""}" id="fc-mark-review">
          <i data-lucide="rotate-ccw"></i> ยังไม่แม่น · ทบทวนซ้ำ 📌
        </button>
        <button type="button" class="hub-btn hub-btn--sm ${prog.starred ? "hub-btn--honey" : ""}" id="fc-mark-star">
          <i data-lucide="star"></i> ปักหมุดเก็งข้อสอบ ⭐
        </button>
        <button type="button" class="hub-btn hub-btn--sm hub-btn--primary" id="fc-mark-read">
          <i data-lucide="check-circle-2"></i> จำแม่นแล้ว · ไปใบถัดไป →
        </button>
      </div>
    `;

    document.getElementById("fc-card")?.addEventListener("click", () => {
      state.fcFlipped = !state.fcFlipped;
      renderFlashcardsView();
    });
    document.getElementById("fc-prev")?.addEventListener("click", () => {
      if (state.fcIndex > 0) {
        state.fcIndex--;
        state.fcFlipped = false;
        renderFlashcardsView();
      }
    });
    document.getElementById("fc-next")?.addEventListener("click", () => {
      state.fcIndex = (state.fcIndex + 1) % state.fcList.length;
      state.fcFlipped = false;
      renderFlashcardsView();
    });
    document.getElementById("fc-mark-review")?.addEventListener("click", () => {
      updateRulingProgress(r.id, { review: true });
      state.fcIndex = (state.fcIndex + 1) % state.fcList.length;
      state.fcFlipped = false;
      renderFlashcardsView();
    });
    document.getElementById("fc-mark-star")?.addEventListener("click", () => {
      updateRulingProgress(r.id, { starred: !prog.starred });
      renderFlashcardsView();
    });
    document.getElementById("fc-mark-read")?.addEventListener("click", () => {
      updateRulingProgress(r.id, { read: true, review: false });
      state.fcIndex = (state.fcIndex + 1) % state.fcList.length;
      state.fcFlipped = false;
      renderFlashcardsView();
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================
  // MODAL: ADD / EDIT RULING
  // =========================================================
  const modalEl = document.getElementById("modal-ruling");
  const formPart = document.getElementById("form-part");
  const formChapter = document.getElementById("form-chapter");
  const formSection = document.getElementById("form-section");

  function syncModalCascadingSelects(partId, chapterId, sectionId) {
    if (!formPart || !formChapter || !formSection) return;
    const pObj = partsMap.get(partId) || baseData.toc[0];
    formPart.value = pObj.id;

    formChapter.innerHTML = pObj.chapters.map(ch =>
      `<option value="${ch.id}">${escapeHtml(ch.code)} · ${escapeHtml(ch.title)}</option>`
    ).join("");

    const targetChId = chapterId && chaptersMap.get(chapterId)?.part_id === pObj.id
      ? chapterId
      : pObj.chapters[0]?.id;
    formChapter.value = targetChId;

    const chObj = chaptersMap.get(targetChId);
    if (chObj && chObj.sections.length) {
      formSection.innerHTML = chObj.sections.map(sec => {
        const indent = "—".repeat(Math.max(0, sec.level - 1));
        return `<option value="${sec.id}">${indent ? indent + " " : ""}${escapeHtml(sec.full_title)}</option>`;
      }).join("");
      if (sectionId && sectionsMap.get(sectionId)?.chapter_id === chObj.id) {
        formSection.value = sectionId;
      }
    } else {
      formSection.innerHTML = `<option value="">(หมวดหลักของบท)</option>`;
    }
  }

  function openRulingModal(editRulingId = null, defaultContext = {}) {
    const titleEl = document.getElementById("modal-ruling-title");
    const idInput = document.getElementById("form-id");
    const typeInput = document.getElementById("form-type");
    const citeInput = document.getElementById("form-citation");
    const sourceInput = document.getElementById("form-source");
    const gaInput = document.getElementById("form-ga");
    const rTitleInput = document.getElementById("form-title");
    const principleInput = document.getElementById("form-principle");
    const factsInput = document.getElementById("form-facts");
    const lawsInput = document.getElementById("form-laws");
    const noteInput = document.getElementById("form-note");
    const starInput = document.getElementById("form-starred");

    if (editRulingId) {
      const existing = getAllRulings().find(x => x.id === editRulingId);
      if (!existing) return;
      const prog = getRulingProgress(existing.id);
      titleEl.textContent = `แก้ไขคำวินิจฉัย (${existing.short_citation || existing.citation})`;
      idInput.value = existing.id;
      syncModalCascadingSelects(existing.part_id, existing.chapter_id, existing.section_id);
      typeInput.value = existing.ruling_type || "คำพิพากษา";
      citeInput.value = existing.citation || "";
      sourceInput.value = existing.source_vol || "";
      gaInput.checked = Boolean(existing.is_general_assembly);
      rTitleInput.value = existing.title || "";
      principleInput.value = existing.principle || "";
      factsInput.value = existing.facts || existing.content || "";
      lawsInput.value = (existing.laws || []).join(", ");
      noteInput.value = prog.note || "";
      starInput.checked = Boolean(prog.starred);
    } else {
      titleEl.textContent = "บันทึกคำพิพากษา / คำสั่งศาลปกครองใหม่";
      idInput.value = "";
      syncModalCascadingSelects(
        defaultContext.part || state.filters.part || "part-1",
        defaultContext.chapter || state.filters.chapter || "",
        defaultContext.section || state.filters.section || ""
      );
      typeInput.value = "คำพิพากษา";
      citeInput.value = "";
      sourceInput.value = "บันทึกเพิ่มเติม";
      gaInput.checked = false;
      rTitleInput.value = "";
      principleInput.value = "";
      factsInput.value = "";
      lawsInput.value = "";
      noteInput.value = "";
      starInput.checked = true;
    }

    modalEl.classList.add("is-open");
  }

  function closeRulingModal() {
    modalEl.classList.remove("is-open");
  }

  // =========================================================
  // Export / Import JSON Backup
  // =========================================================
  function exportUserData() {
    const payload = {
      app: "Admin Law Diary",
      exportedAt: new Date().toISOString(),
      progress: state.progress,
      customRulings: state.customRulings,
      editedRulings: state.editedRulings,
      deletedIds: state.deletedIds
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-law-diary-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importUserData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.progress) state.progress = { ...state.progress, ...data.progress };
        if (Array.isArray(data.customRulings)) {
          const existingIds = new Set(state.customRulings.map(x => x.id));
          data.customRulings.forEach(cr => {
            if (!existingIds.has(cr.id)) state.customRulings.push(cr);
          });
        }
        if (data.editedRulings) state.editedRulings = { ...state.editedRulings, ...data.editedRulings };
        if (data.deletedIds) state.deletedIds = { ...state.deletedIds, ...data.deletedIds };
        saveState();
        refreshAllViews();
        alert("นำเข้าข้อมูลสมุดบันทึกเรียบร้อยแล้ว!");
      } catch (err) {
        alert("ไฟล์ JSON ไม่ถูกต้อง");
      }
    };
    reader.readAsText(file);
  }

  function refreshAllViews() {
    updateGlobalStats();
    if (state.currentView === "home") renderHomeView();
    else if (state.currentView === "diary") renderDiaryView();
    else if (state.currentView === "toc") renderTocView();
    else if (state.currentView === "picks") renderPicksView();
    else if (state.currentView === "flashcards") renderFlashcardsView();
  }

  // =========================================================
  // Event Listeners Binding
  // =========================================================
  function bindGlobalEvents() {
    // Sidebar & Theme toggles
    document.getElementById("rail-toggle")?.addEventListener("click", () => {
      const isCollapsed = htmlEl.getAttribute("data-rail") === "collapsed";
      if (isCollapsed) {
        htmlEl.removeAttribute("data-rail");
        localStorage.setItem("hub-rail", "expanded");
      } else {
        htmlEl.setAttribute("data-rail", "collapsed");
        localStorage.setItem("hub-rail", "collapsed");
      }
    });

    document.getElementById("theme-toggle")?.addEventListener("click", () => {
      const cur = htmlEl.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next = cur === "dark" ? "light" : "dark";
      htmlEl.setAttribute("data-theme", next);
      localStorage.setItem("hub-theme", next);
    });

    document.getElementById("rail-hamburger")?.addEventListener("click", () => {
      htmlEl.classList.add("hub-drawer-open");
    });
    document.getElementById("rail-close")?.addEventListener("click", () => {
      htmlEl.classList.remove("hub-drawer-open");
    });
    document.getElementById("rail-backdrop")?.addEventListener("click", () => {
      htmlEl.classList.remove("hub-drawer-open");
    });

    // Comfort Bar font & size buttons
    document.querySelectorAll("[data-set-font]").forEach(btn => {
      btn.addEventListener("click", () => setReaderFont(btn.dataset.setFont));
    });
    document.querySelectorAll("[data-set-size]").forEach(btn => {
      btn.addEventListener("click", () => setReaderSize(btn.dataset.setSize));
    });
    document.getElementById("btn-toggle-highlight")?.addEventListener("click", () => {
      const cur = htmlEl.getAttribute("data-highlight") === "off" ? "off" : "on";
      setHighlightMode(cur === "on" ? "off" : "on");
    });

    // Navigation buttons
    document.querySelectorAll("[data-nav]").forEach(el => {
      el.addEventListener("click", () => navigateTo(el.dataset.nav));
    });

    // Quick filters in sidebar & footer
    document.querySelectorAll("[data-quick-filter]").forEach(el => {
      el.addEventListener("click", () => {
        const qf = el.dataset.quickFilter;
        if (qf === "part-1" || qf === "part-2") openDiaryWithFilter({ part: qf });
        else if (qf === "ga") openDiaryWithFilter({ type: "ga" });
        else if (qf === "custom") openDiaryWithFilter({ type: "custom" });
      });
    });

    // Hero stat cards click-to-filter
    document.querySelectorAll("[data-stat-filter]").forEach(card => {
      card.addEventListener("click", () => {
        const sf = card.dataset.statFilter;
        if (sf === "all") openDiaryWithFilter({});
        else openDiaryWithFilter({ status: sf });
      });
    });

    // Shelf tabs & search
    document.querySelectorAll("[data-shelf-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.shelfFilter = btn.dataset.shelfFilter;
        document.querySelectorAll("[data-shelf-filter]").forEach(b =>
          b.classList.toggle("is-active", b.dataset.shelfFilter === state.shelfFilter)
        );
        renderLibraryShelf();
        if (window.lucide) window.lucide.createIcons();
      });
    });
    document.getElementById("shelf-search")?.addEventListener("input", e => {
      state.shelfSearch = e.target.value;
      renderLibraryShelf();
      if (window.lucide) window.lucide.createIcons();
    });

    // Diary filter inputs
    document.getElementById("filter-q")?.addEventListener("input", e => {
      state.filters.q = e.target.value;
      state.pageSize = 25;
      renderDiaryView();
    });
    document.getElementById("filter-part")?.addEventListener("change", e => {
      state.filters.part = e.target.value;
      state.filters.chapter = "";
      state.filters.section = "";
      populateChapterFilterDropdown(state.filters.part, "");
      populateSectionFilterDropdown("", "");
      state.pageSize = 25;
      renderDiaryView();
    });
    document.getElementById("filter-chapter")?.addEventListener("change", e => {
      state.filters.chapter = e.target.value;
      state.filters.section = "";
      if (state.filters.chapter) {
        const ch = chaptersMap.get(state.filters.chapter);
        if (ch) state.filters.part = ch.part_id;
        const partSel = document.getElementById("filter-part");
        if (partSel) partSel.value = state.filters.part;
      }
      populateSectionFilterDropdown(state.filters.chapter, "");
      state.pageSize = 25;
      renderDiaryView();
    });
    document.getElementById("filter-section")?.addEventListener("change", e => {
      state.filters.section = e.target.value;
      state.pageSize = 25;
      renderDiaryView();
    });
    document.getElementById("filter-type")?.addEventListener("change", e => {
      state.filters.type = e.target.value;
      state.pageSize = 25;
      renderDiaryView();
    });
    document.getElementById("filter-status")?.addEventListener("change", e => {
      state.filters.status = e.target.value;
      state.pageSize = 25;
      renderDiaryView();
    });

    // View mode toggle (card vs compact)
    document.querySelectorAll("[data-view-mode]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.viewMode = btn.dataset.viewMode;
        document.querySelectorAll("[data-view-mode]").forEach(b =>
          b.classList.toggle("is-active", b.dataset.viewMode === state.viewMode)
        );
        renderDiaryView();
      });
    });

    document.getElementById("btn-load-more")?.addEventListener("click", () => {
      state.pageSize += 30;
      renderDiaryView();
    });

    // TOC Explorer events
    document.getElementById("toc-search")?.addEventListener("input", () => renderTocView());
    document.getElementById("btn-toc-expand-all")?.addEventListener("click", () => {
      document.querySelectorAll(".toc-ch-details").forEach(d => d.setAttribute("open", ""));
    });
    document.getElementById("btn-toc-collapse-all")?.addEventListener("click", () => {
      document.querySelectorAll(".toc-ch-details").forEach(d => d.removeAttribute("open"));
    });

    // Picks view tabs
    document.querySelectorAll("[data-picks-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.picksTab = btn.dataset.picksTab;
        document.querySelectorAll("[data-picks-tab]").forEach(b =>
          b.classList.toggle("is-active", b.dataset.picksTab === state.picksTab)
        );
        renderPicksView();
      });
    });

    // Flashcards controls
    document.getElementById("fc-deck-select")?.addEventListener("change", e => {
      state.fcDeckType = e.target.value;
      buildFlashcardDeck();
      renderFlashcardsView();
    });
    document.getElementById("btn-fc-shuffle")?.addEventListener("click", () => {
      buildFlashcardDeck();
      renderFlashcardsView();
    });

    // Add Ruling Modal triggers
    ["btn-open-add-rail", "btn-open-add-top", "btn-hero-add", "btn-diary-add"].forEach(id => {
      document.getElementById(id)?.addEventListener("click", () => openRulingModal(null, state.filters));
    });
    document.getElementById("btn-close-modal")?.addEventListener("click", closeRulingModal);
    document.getElementById("btn-cancel-modal")?.addEventListener("click", closeRulingModal);
    modalEl?.addEventListener("click", e => {
      if (e.target === modalEl) closeRulingModal();
    });

    formPart?.addEventListener("change", () => {
      syncModalCascadingSelects(formPart.value, "", "");
    });
    formChapter?.addEventListener("change", () => {
      syncModalCascadingSelects(formPart.value, formChapter.value, "");
    });

    // Submit Add / Edit Ruling Form
    document.getElementById("form-ruling")?.addEventListener("submit", e => {
      e.preventDefault();
      const editId = document.getElementById("form-id").value;
      const partId = formPart.value;
      const chapterId = formChapter.value;
      const sectionId = formSection.value;

      const partObj = partsMap.get(partId);
      const chObj = chaptersMap.get(chapterId);
      const secObj = sectionsMap.get(sectionId);

      const rulingType = document.getElementById("form-type").value;
      const citation = document.getElementById("form-citation").value.trim();
      const sourceVol = document.getElementById("form-source").value.trim() || "บันทึกเพิ่มเติม";
      const isGa = document.getElementById("form-ga").checked;
      const title = document.getElementById("form-title").value.trim();
      const principle = document.getElementById("form-principle").value.trim();
      const facts = document.getElementById("form-facts").value.trim() || principle;
      const lawsRaw = document.getElementById("form-laws").value;
      const laws = lawsRaw.split(",").map(s => s.trim()).filter(Boolean);
      const note = document.getElementById("form-note").value.trim();
      const starred = document.getElementById("form-starred").checked;

      // Make short citation
      let shortCite = citation;
      const mShort = citation.match(/ที่\s*(.+)$/);
      if (mShort) {
        shortCite = (rulingType === "คำสั่ง" && !mShort[1].startsWith("คส.") ? "คส. " : "") + mShort[1];
      }

      const recordPatch = {
        source_vol: sourceVol,
        part_id: partId,
        part_code: partObj ? partObj.code : "ภาค ๑",
        part_title: partObj ? partObj.title : "",
        chapter_id: chapterId,
        chapter_code: chObj ? chObj.code : "",
        chapter_title: chObj ? chObj.title : "",
        section_id: sectionId || null,
        section_code: secObj ? secObj.code : "",
        section_title: secObj ? secObj.title : (chObj ? chObj.title : ""),
        section_full_title: secObj ? secObj.full_title : (chObj ? chObj.full_title : ""),
        section_path: secObj ? secObj.path : (chObj ? [chObj.full_title] : []),
        ruling_type: rulingType,
        citation,
        short_citation: shortCite,
        citation_arabic: toArabicDigits(citation),
        is_general_assembly: isGa,
        title,
        principle,
        facts,
        content: principle + (facts && facts !== principle ? "\n\n" + facts : ""),
        laws
      };

      if (editId) {
        const customIdx = state.customRulings.findIndex(x => x.id === editId);
        if (customIdx !== -1) {
          state.customRulings[customIdx] = { ...state.customRulings[customIdx], ...recordPatch };
        } else {
          state.editedRulings[editId] = recordPatch;
        }
        updateRulingProgress(editId, { note, starred });
      } else {
        const newId = "custom-" + Date.now();
        const newRuling = {
          id: newId,
          seq: 10000 + state.customRulings.length + 1,
          year: "๒๕๖๘",
          book_page: secObj ? secObj.book_page : (chObj ? chObj.book_page : null),
          pdf_page: null,
          is_custom: true,
          ...recordPatch
        };
        state.customRulings.unshift(newRuling);
        updateRulingProgress(newId, { note, starred, read: true });
      }

      saveState();
      closeRulingModal();
      refreshAllViews();
    });

    // Export / Import buttons
    document.getElementById("btn-export-json")?.addEventListener("click", exportUserData);
    document.getElementById("foot-export")?.addEventListener("click", exportUserData);
    document.getElementById("btn-import-json")?.addEventListener("click", () => {
      document.getElementById("input-import-file")?.click();
    });
    document.getElementById("input-import-file")?.addEventListener("change", e => {
      const f = e.target.files?.[0];
      if (f) importUserData(f);
      e.target.value = "";
    });

    // Upload additional PDF volumes & Rebuild repository
    const pdfInput = document.getElementById("input-upload-pdf");
    ["btn-upload-pdf-top", "btn-hero-upload-pdf", "foot-upload-pdf"].forEach(id => {
      document.getElementById(id)?.addEventListener("click", () => {
        pdfInput?.click();
      });
    });

    pdfInput?.addEventListener("change", async e => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const topBtn = document.getElementById("btn-upload-pdf-top");
      const origHtml = topBtn ? topBtn.innerHTML : "";
      try {
        let lastMeta = null;
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (topBtn) {
            topBtn.disabled = true;
            topBtn.textContent = `กำลังสกัดข้อมูล PDF (${i + 1}/${files.length}): ${f.name}...`;
          }
          const res = await fetch("/api/upload-pdf", {
            method: "POST",
            headers: {
              "Content-Type": "application/pdf",
              "X-Filename": encodeURIComponent(f.name)
            },
            body: f
          });
          if (!res.ok) throw new Error("ไม่สามารถอัปโหลดไปยังเซิร์ฟเวอร์ได้ (กรุณาเปิดผ่านไฟล์ เปิดแอปเตรียมสอบศาลปกครอง.command)");
          const data = await res.json();
          if (!data.ok) throw new Error(data.error || "สกัดข้อมูล PDF ไม่สำเร็จ");
          lastMeta = data.meta;
        }
        alert(`อัปโหลดและจำแนกคำวินิจฉัยเข้าสู่สารบัญเรียบร้อยแล้ว! (รวมในคลังทั้งหมด ${lastMeta?.total_rulings || ""} รายการ)`);
        window.location.reload();
      } catch (err) {
        alert(err.message || "เกิดข้อผิดพลาดในการอัปโหลดไฟล์ PDF");
        if (topBtn) {
          topBtn.disabled = false;
          topBtn.innerHTML = origHtml;
          if (window.lucide) window.lucide.createIcons();
        }
      } finally {
        e.target.value = "";
      }
    });

    document.getElementById("foot-rescan-pdf")?.addEventListener("click", async () => {
      try {
        const res = await fetch("/api/rebuild", { method: "POST" });
        if (!res.ok) throw new Error("กรุณารันผ่านเซิร์ฟเวอร์ (เปิดแอปเตรียมสอบศาลปกครอง.command)");
        const data = await res.json();
        if (data.ok) {
          alert(`สแกนไฟล์ PDF ในโฟลเดอร์เรียบร้อยแล้ว! รวมคำวินิจฉัยทั้งหมด ${data.meta?.total_rulings || ""} รายการ`);
          window.location.reload();
        }
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Initialize App
  initPreferences();
  loadState();
  populateChapterFilterDropdown("", "");
  populateSectionFilterDropdown("", "");
  bindGlobalEvents();
  renderHomeView();
})();
