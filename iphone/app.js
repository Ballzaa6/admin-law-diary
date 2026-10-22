/* =====================================================================
   ปกครอง Diary — iPhone Edition Controller (app.js)
   Synced with ../data/vol14_data.js & /api/state
   ===================================================================== */

(function () {
  "use strict";

  const THAI_TO_ARABIC = {
    "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4",
    "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9"
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

  function formatLegalText(rawText) {
    let html = escapeHtml(rawText || "");
    html = html.replace(
      /(ดังนั้น|ด้วยเหตุนี้|จึงวินิจฉัยว่า|จึงพิพากษา|จึงมีคำสั่ง)/g,
      '<span class="kw-conclusion">$1</span>'
    );
    html = html.replace(
      /(จึงเป็นหน่วยงานทางปกครอง|จึงถือเป็นหน่วยงานทางปกครอง|จึงมิใช่หน่วยงานทางปกครอง|ไม่เป็นหน่วยงานทางปกครอง|จึงเป็นเจ้าหน้าที่ของรัฐ|จึงมิใช่เจ้าหน้าที่ของรัฐ|จึงเป็นคำสั่งทางปกครอง|จึงมิใช่คำสั่งทางปกครอง|ไม่ใช่คำสั่งทางปกครอง|จึงเป็นสัญญาทางปกครอง|จึงมิใช่สัญญาทางปกครอง|ไม่ใช่สัญญาทางปกครอง|ชอบด้วยกฎหมาย|ไม่ชอบด้วยกฎหมาย|เป็นการกระทำละเมิด|ไม่เป็นการกระทำละเมิด|อยู่ในอำนาจพิจารณาพิพากษาของศาลปกครอง|ไม่อยู่ในอำนาจพิจารณาพิพากษาของศาลปกครอง|พ้นกำหนดระยะเวลาการฟ้องคดี|ภายในกำหนดระยะเวลาการฟ้องคดี|เป็นผู้มีสิทธิฟ้องคดี|ไม่มีสิทธิฟ้องคดี)/g,
      '<span class="kw-holding">$1</span>'
    );
    html = html.replace(
      /(มาตรา\s*[๐-๙0-9]+(?:\s*วรรค[ก-๙]+)?(?:\s*\([๐-๙0-9]+\))?|ข้อ\s*[๐-๙0-9]+(?:\s*วรรค[ก-๙]+)?)/g,
      '<span class="kw-law">$1</span>'
    );
    return html;
  }

  const baseData = window.ADMIN_LAW_DATA || { toc: [], rulings: [], book_meta: {} };
  const STORAGE_KEY = "admin_law_diary_state_v1";
  const htmlEl = document.documentElement;

  const partsMap = new Map();
  const chaptersMap = new Map();
  const sectionsMap = new Map();

  (baseData.toc || []).forEach(part => {
    partsMap.set(part.id, part);
    (part.chapters || []).forEach(ch => {
      chaptersMap.set(ch.id, ch);
      (ch.sections || []).forEach(sec => {
        sectionsMap.set(sec.id, sec);
      });
    });
  });

  const POPULAR_TOPICS = [
    { label: "🏛️ ประชุมใหญ่", filter: { type: "ga" } },
    { label: "หน่วยงานทางปกครอง", filter: { chapter: "part-1-ch-2" } },
    { label: "คำสั่งทางปกครอง", filter: { q: "คำสั่งทางปกครอง" } },
    { label: "สัญญาทางปกครอง", filter: { chapter: "part-2-ch-20" } },
    { label: "ละเมิดทางปกครอง", filter: { chapter: "part-2-ch-17" } },
    { label: "ระยะเวลาฟ้องคดี", filter: { q: "ระยะเวลาการฟ้องคดี" } },
    { label: "วินัยข้าราชการ", filter: { chapter: "part-2-ch-32" } },
    { label: "การพัสดุ", filter: { chapter: "part-2-ch-19" } },
    { label: "เวนคืน/ที่ดิน", filter: { chapter: "part-2-ch-13" } }
  ];

  const state = {
    tab: "home",
    shelfPart: "all",
    shelfQ: "",
    pageSize: 20,
    filters: {
      q: "",
      part: "",
      chapter: "",
      section: "",
      type: "",
      status: ""
    },
    pickTab: "starred",
    progress: {},
    customRulings: [],
    editedRulings: {},
    deletedIds: {},
    fcDeck: "all",
    fcList: [],
    fcIndex: 0,
    fcFlipped: false
  };

  // =====================================================================
  // State Persistence (Shared with Desktop App)
  // =====================================================================
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
      console.warn(e);
    }

    fetch("/api/state")
      .then(r => (r.ok ? r.json() : null))
      .then(serverData => {
        if (serverData && typeof serverData === "object") {
          if (serverData.progress) state.progress = { ... serverData.progress, ...state.progress };
          if (Array.isArray(serverData.customRulings) && serverData.customRulings.length > state.customRulings.length) {
            state.customRulings = serverData.customRulings;
          }
          if (serverData.editedRulings) state.editedRulings = { ...serverData.editedRulings, ...state.editedRulings };
          if (serverData.deletedIds) state.deletedIds = { ...serverData.deletedIds, ...state.deletedIds };
          saveLocalOnly();
          refreshCurrentTab();
        }
      })
      .catch(() => {});
  }

  function saveLocalOnly() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          progress: state.progress,
          customRulings: state.customRulings,
          editedRulings: state.editedRulings,
          deletedIds: state.deletedIds
        })
      );
    } catch (e) {}
  }

  function saveState() {
    saveLocalOnly();
    fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        progress: state.progress,
        customRulings: state.customRulings,
        editedRulings: state.editedRulings,
        deletedIds: state.deletedIds
      })
    }).catch(() => {});
  }

  function getAllRulings() {
    const merged = [];
    state.customRulings.forEach(cr => {
      if (!state.deletedIds[cr.id]) merged.push(cr);
    });
    (baseData.rulings || []).forEach(r => {
      if (state.deletedIds[r.id]) return;
      const ov = state.editedRulings[r.id];
      merged.push(ov ? { ...r, ...ov } : r);
    });
    return merged;
  }

  function getProgress(id) {
    return state.progress[id] || { read: false, starred: false, review: false, note: "" };
  }

  function updateProgress(id, patch) {
    const cur = getProgress(id);
    state.progress[id] = { ...cur, ...patch, updatedAt: Date.now() };
    saveState();
    updateStatsCounters();
  }

  // =====================================================================
  // Preferences (Theme, Font, Size, Highlight)
  // =====================================================================
  function initPreferences() {
    const theme = localStorage.getItem("hub-theme") || "light";
    const font = localStorage.getItem("hub-font") || "sarabun";
    const size = localStorage.getItem("hub-size") || "md";
    const hl = localStorage.getItem("hub-highlight") || "on";

    setTheme(theme);
    setFont(font);
    setSize(size);
    setHighlight(hl);
  }

  function setTheme(theme) {
    htmlEl.setAttribute("data-theme", theme);
    localStorage.setItem("hub-theme", theme);
    const metaTheme = document.getElementById("meta-theme-color");
    if (metaTheme) {
      metaTheme.setAttribute("content", theme === "dark" ? "#0f110c" : theme === "sepia" ? "#ece2c8" : "#f0f0e0");
    }
    document.querySelectorAll("[data-set-theme]").forEach(b =>
      b.classList.toggle("is-active", b.dataset.setTheme === theme)
    );
  }

  function setFont(font) {
    htmlEl.setAttribute("data-font", font);
    localStorage.setItem("hub-font", font);
    document.querySelectorAll("[data-set-font]").forEach(b =>
      b.classList.toggle("is-active", b.dataset.setFont === font)
    );
  }

  function setSize(size) {
    htmlEl.setAttribute("data-size", size);
    localStorage.setItem("hub-size", size);
    document.querySelectorAll("[data-set-size]").forEach(b =>
      b.classList.toggle("is-active", b.dataset.setSize === size)
    );
  }

  function setHighlight(mode) {
    htmlEl.setAttribute("data-highlight", mode);
    localStorage.setItem("hub-highlight", mode);
    const cb = document.getElementById("toggle-highlight");
    if (cb) cb.checked = mode === "on";
  }

  // =====================================================================
  // Stats & Navigation
  // =====================================================================
  function updateStatsCounters() {
    const all = getAllRulings();
    let starred = 0;
    let read = 0;
    let review = 0;
    let notes = 0;

    all.forEach(r => {
      const p = getProgress(r.id);
      if (p.starred) starred++;
      if (p.read) read++;
      if (p.review) review++;
      if (p.note && p.note.trim()) notes++;
    });

    const total = all.length;
    const pct = total ? Math.round((read / total) * 100) : 0;

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt("stat-all", total.toLocaleString());
    setTxt("stat-starred", starred.toLocaleString());
    setTxt("stat-read", read.toLocaleString());
    setTxt("stat-review", review.toLocaleString());
    setTxt("home-progress-pct", `อ่านแล้ว ${pct}%`);
    setTxt("stat-read-detail", `อ่านเข้าใจแล้ว ${read.toLocaleString()} / ${total.toLocaleString()}`);
    setTxt("stat-note-detail", `โน้ตสรุป ${notes.toLocaleString()} รายการ`);
    setTxt("tab-badge-total", total > 999 ? `${(total / 1000).toFixed(1)}k` : String(total));

    const starBadge = document.getElementById("tab-badge-star");
    if (starBadge) {
      starBadge.style.display = starred > 0 ? "inline-block" : "none";
      starBadge.textContent = String(starred);
    }

    const bar = document.getElementById("stat-bar-fill");
    if (bar) bar.style.width = `${pct}%`;
  }

  function switchTab(tabName) {
    state.tab = tabName;
    document.querySelectorAll(".ios-view").forEach(v =>
      v.classList.toggle("is-active", v.id === `view-${tabName}`)
    );
    document.querySelectorAll(".ios-tab").forEach(t =>
      t.classList.toggle("is-active", t.dataset.tab === tabName)
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
    refreshCurrentTab();
  }

  function refreshCurrentTab() {
    updateStatsCounters();
    if (state.tab === "home") renderHomeTab();
    else if (state.tab === "diary") renderDiaryTab();
    else if (state.tab === "toc") renderTocTab();
    else if (state.tab === "picks") renderPicksTab();
    else if (state.tab === "flashcards") renderFlashcardsTab();
    if (window.lucide) window.lucide.createIcons();
  }

  // =====================================================================
  // TAB 1: HOME
  // =====================================================================
  function renderHomeTab() {
    const topicBox = document.getElementById("home-topic-chips");
    if (topicBox && !topicBox.hasChildNodes()) {
      topicBox.innerHTML = POPULAR_TOPICS.map((t, idx) =>
        `<button type="button" class="ios-chip" data-topic-idx="${idx}">${escapeHtml(t.label)}</button>`
      ).join("");
      topicBox.querySelectorAll("[data-topic-idx]").forEach(btn => {
        btn.addEventListener("click", () => {
          const t = POPULAR_TOPICS[Number(btn.dataset.topicIdx)];
          if (t) jumpToDiaryWithFilter(t.filter);
        });
      });
    }

    renderHomeChapterList();
  }

  function renderHomeChapterList() {
    const container = document.getElementById("home-chapter-list");
    if (!container) return;

    const all = getAllRulings();
    const chCounts = {};
    all.forEach(r => {
      chCounts[r.chapter_id] = (chCounts[r.chapter_id] || 0) + 1;
    });

    const q = normalizeForSearch(state.shelfQ);
    const items = [];

    (baseData.toc || []).forEach(part => {
      if (state.shelfPart !== "all" && part.id !== state.shelfPart) return;
      (part.chapters || []).forEach(ch => {
        if (q && !normalizeForSearch(`${ch.code} ${ch.title}`).includes(q)) return;
        const cnt = chCounts[ch.id] || 0;
        items.push(`
          <div class="chapter-row-card" data-open-ch="${ch.id}">
            <div class="chapter-row-card__ico">
              <i data-lucide="${ch.icon || "book-open"}"></i>
            </div>
            <div class="chapter-row-card__body">
              <div class="chapter-row-card__meta">
                <span>${escapeHtml(part.code)} · ${escapeHtml(ch.code)}</span>
                <span>· ${ch.sections.length} หมวดย่อย</span>
              </div>
              <h3 class="chapter-row-card__title">${escapeHtml(ch.title)}</h3>
            </div>
            <span class="chapter-row-card__badge">${cnt} ฎีกา</span>
          </div>
        `);
      });
    });

    container.innerHTML = items.join("") || `<p style="text-align:center; color:var(--fg-3);">ไม่พบบทที่ค้นหา</p>`;
    container.querySelectorAll("[data-open-ch]").forEach(card => {
      card.addEventListener("click", () => {
        const cid = card.dataset.openCh;
        const ch = chaptersMap.get(cid);
        jumpToDiaryWithFilter({ part: ch ? ch.part_id : "", chapter: cid });
      });
    });
    if (window.lucide) window.lucide.createIcons();
  }

  // =====================================================================
  // TAB 2: DIARY / RULINGS
  // =====================================================================
  function jumpToDiaryWithFilter(newFilters) {
    state.filters = {
      q: newFilters.q || "",
      part: newFilters.part || "",
      chapter: newFilters.chapter || "",
      section: newFilters.section || "",
      type: newFilters.type || "",
      status: newFilters.status || ""
    };
    state.pageSize = 20;
    const qInput = document.getElementById("diary-q");
    if (qInput) qInput.value = state.filters.q;
    switchTab("diary");
  }

  function getFilteredRulings() {
    const all = getAllRulings();
    const qNorm = normalizeForSearch(state.filters.q);
    return all.filter(r => {
      const prog = getProgress(r.id);
      if (state.filters.part && r.part_id !== state.filters.part) return false;
      if (state.filters.chapter && r.chapter_id !== state.filters.chapter) return false;
      if (state.filters.section && r.section_id !== state.filters.section) return false;
      if (state.filters.type) {
        if (state.filters.type === "ga" && !r.is_general_assembly) return false;
        if (state.filters.type === "คำพิพากษา" && r.ruling_type !== "คำพิพากษา") return false;
        if (state.filters.type === "คำสั่ง" && r.ruling_type !== "คำสั่ง") return false;
      }
      if (state.filters.status) {
        if (state.filters.status === "starred" && !prog.starred) return false;
        if (state.filters.status === "review" && !prog.review) return false;
        if (state.filters.status === "read" && !prog.read) return false;
        if (state.filters.status === "unread" && prog.read) return false;
      }
      if (qNorm) {
        const hay = normalizeForSearch(
          `${r.citation} ${r.short_citation} ${r.title} ${r.principle} ${r.facts} ${r.chapter_title} ${r.section_full_title} ${(r.laws || []).join(" ")} ${prog.note || ""}`
        );
        const terms = qNorm.split(" ").filter(Boolean);
        if (!terms.every(t => hay.includes(t))) return false;
      }
      return true;
    });
  }

  function renderRulingCard(r) {
    const prog = getProgress(r.id);
    const isOrder = r.ruling_type === "คำสั่ง";
    const pathStr = (r.section_path && r.section_path.length)
      ? r.section_path[r.section_path.length - 1]
      : r.section_full_title;

    return `
      <article class="ios-ruling-card ${prog.starred ? "is-starred" : ""}" data-card-id="${r.id}">
        <div class="ios-ruling-card__top">
          <span class="ios-ruling-card__cat" data-tap-ch="${r.chapter_id}">
            ${escapeHtml(r.part_code)} · ${escapeHtml(r.chapter_code)} ${escapeHtml(r.chapter_title.slice(0, 26))}${r.chapter_title.length > 26 ? "…" : ""}
          </span>
          <div style="display:flex; align-items:center; gap:5px; flex-shrink:0;">
            ${r.is_general_assembly ? `<span class="ios-ga-badge">ประชุมใหญ่</span>` : ""}
            <span class="ios-cite-pill ${isOrder ? "ios-cite-pill--order" : ""}">${escapeHtml(r.short_citation || r.citation)}</span>
          </div>
        </div>

        <div class="ios-ruling-card__sec">${escapeHtml(pathStr)}</div>

        <h3 class="ios-ruling-card__title" data-open-reader="${r.id}" style="cursor:pointer;">
          ${escapeHtml(r.title)}
        </h3>

        <div class="ios-principle-box" data-open-reader="${r.id}" style="cursor:pointer;">
          <div class="ios-principle-box__hd">
            <i data-lucide="sparkles" style="width:13px;height:13px;"></i>
            <span>หลักกฎหมาย / แนวคำวินิจฉัยสำคัญ</span>
          </div>
          <div>${formatLegalText(r.principle)}</div>
        </div>

        ${prog.note && prog.note.trim() ? `
          <div class="ios-note-box" data-open-reader="${r.id}">
            <strong>📝 โน้ตของฉัน:</strong> ${escapeHtml(prog.note)}
          </div>
        ` : ""}

        <div class="ios-card-actions">
          <button type="button" class="ios-act-btn ${prog.read ? "is-read" : ""}" data-toggle-prop="read" data-id="${r.id}">
            <i data-lucide="check"></i>
            <span>${prog.read ? "อ่านแล้ว" : "อ่าน"}</span>
          </button>
          <button type="button" class="ios-act-btn ${prog.starred ? "is-starred" : ""}" data-toggle-prop="starred" data-id="${r.id}">
            <i data-lucide="star"></i>
            <span>เก็งสอบ</span>
          </button>
          <button type="button" class="ios-act-btn ${prog.review ? "is-review" : ""}" data-toggle-prop="review" data-id="${r.id}">
            <i data-lucide="rotate-ccw"></i>
            <span>ทบทวน</span>
          </button>
          <button type="button" class="ios-act-btn" data-open-reader="${r.id}">
            <i data-lucide="book-open-text"></i>
            <span>ฉบับเต็ม</span>
          </button>
        </div>
      </article>
    `;
  }

  function bindCardEvents(container) {
    if (!container) return;
    container.querySelectorAll("[data-toggle-prop]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const prop = btn.dataset.toggleProp;
        const cur = getProgress(id);
        updateProgress(id, { [prop]: !cur[prop] });
        refreshCurrentTab();
      });
    });

    container.querySelectorAll("[data-open-reader]").forEach(el => {
      el.addEventListener("click", () => {
        openReaderSheet(el.dataset.openReader);
      });
    });

    container.querySelectorAll("[data-tap-ch]").forEach(el => {
      el.addEventListener("click", e => {
        e.stopPropagation();
        const cid = el.dataset.tapCh;
        const ch = chaptersMap.get(cid);
        jumpToDiaryWithFilter({ part: ch ? ch.part_id : "", chapter: cid });
      });
    });
  }

  function renderDiaryTab() {
    const filtered = getFilteredRulings();
    const countLabel = document.getElementById("diary-count-label");
    if (countLabel) countLabel.textContent = `พบ ${filtered.length.toLocaleString()} รายการ`;

    // Sync active filter banner
    const banner = document.getElementById("diary-active-banner");
    const bannerTxt = document.getElementById("diary-active-text");
    const parts = [];
    if (state.filters.chapter) {
      const ch = chaptersMap.get(state.filters.chapter);
      if (ch) parts.push(`${ch.code} ${ch.title.slice(0, 28)}`);
    } else if (state.filters.part) {
      parts.push(state.filters.part === "part-1" ? "ภาค ๑ ภาคทั่วไป" : "ภาค ๒ เฉพาะเรื่อง");
    }
    if (state.filters.section) {
      const sec = sectionsMap.get(state.filters.section);
      if (sec) parts.push(sec.full_title.slice(0, 32));
    }
    if (state.filters.type) parts.push(state.filters.type === "ga" ? "ประชุมใหญ่" : state.filters.type);
    if (state.filters.status) parts.push(`สถานะ: ${state.filters.status}`);

    if (banner && bannerTxt) {
      if (parts.length) {
        banner.style.display = "flex";
        bannerTxt.textContent = parts.join(" › ");
      } else {
        banner.style.display = "none";
      }
    }

    const listEl = document.getElementById("diary-list");
    const visible = filtered.slice(0, state.pageSize);
    if (listEl) {
      if (!visible.length) {
        listEl.innerHTML = `
          <div class="ledger-widget" style="text-align:center; padding:28px 16px;">
            <p style="margin:0 0 12px; font-weight:600;">ไม่พบคำวินิจฉัยในหมวดหรือคำค้นหานี้</p>
            <button type="button" class="ios-btn-primary ios-btn-primary--honey" id="btn-empty-add-ios">
              + บันทึกคำพิพากษาใหม่ในหมวดนี้
            </button>
          </div>
        `;
        document.getElementById("btn-empty-add-ios")?.addEventListener("click", () => openAddSheet(null));
      } else {
        listEl.innerHTML = visible.map(r => renderRulingCard(r)).join("");
        bindCardEvents(listEl);
      }
    }

    const moreBtn = document.getElementById("btn-diary-more");
    if (moreBtn) {
      moreBtn.style.display = filtered.length > state.pageSize ? "inline-flex" : "none";
    }
  }

  // =====================================================================
  // TAB 3: TOC ACCORDION
  // =====================================================================
  function renderTocTab() {
    const container = document.getElementById("toc-accordion-list");
    if (!container) return;

    const q = normalizeForSearch(document.getElementById("toc-q")?.value || "");
    const all = getAllRulings();
    const chCounts = {};
    const secCounts = {};
    all.forEach(r => {
      chCounts[r.chapter_id] = (chCounts[r.chapter_id] || 0) + 1;
      if (r.section_id) secCounts[r.section_id] = (secCounts[r.section_id] || 0) + 1;
    });

    const htmlParts = [];
    (baseData.toc || []).forEach(part => {
      htmlParts.push(`<div class="section-hd" style="margin-top:6px;"><h2 class="section-hd__title">${escapeHtml(part.code)} · ${escapeHtml(part.short_title)}</h2></div>`);
      (part.chapters || []).forEach(ch => {
        const matchedSecs = (ch.sections || []).filter(s =>
          !q || normalizeForSearch(s.full_title).includes(q) || normalizeForSearch(ch.full_title).includes(q)
        );
        if (q && !matchedSecs.length) return;
        const cnt = chCounts[ch.id] || 0;
        htmlParts.push(`
          <details class="ios-toc-ch" ${q ? "open" : ""}>
            <summary>
              <span style="flex:1;">${escapeHtml(ch.code)} · ${escapeHtml(ch.title)}</span>
              <span class="chapter-row-card__badge">${cnt}</span>
            </summary>
            <div class="ios-toc-sec-list">
              <div class="ios-toc-sec-item" data-toc-ch-all="${ch.id}" style="font-weight:700; color:var(--sage-600);">
                <span>📖 เปิดดูทั้งบท (${cnt} รายการ)</span>
                <span>→</span>
              </div>
              ${matchedSecs.map(sec => {
                const sc = secCounts[sec.id] || 0;
                return `
                  <div class="ios-toc-sec-item" data-toc-sec="${sec.id}" data-toc-ch="${ch.id}" style="padding-left:${Math.min(28, (sec.level - 1) * 8 + 8)}px;">
                    <span style="flex:1;">${escapeHtml(sec.full_title)}</span>
                    <span class="chapter-row-card__badge" style="font-size:11px; opacity:${sc ? 1 : 0.45};">${sc}</span>
                  </div>
                `;
              }).join("")}
            </div>
          </details>
        `);
      });
    });

    container.innerHTML = htmlParts.join("");
    container.querySelectorAll("[data-toc-ch-all]").forEach(el => {
      el.addEventListener("click", () => {
        const cid = el.dataset.tocChAll;
        const ch = chaptersMap.get(cid);
        jumpToDiaryWithFilter({ part: ch ? ch.part_id : "", chapter: cid });
      });
    });
    container.querySelectorAll("[data-toc-sec]").forEach(el => {
      el.addEventListener("click", () => {
        const sid = el.dataset.tocSec;
        const cid = el.dataset.tocCh;
        const ch = chaptersMap.get(cid);
        jumpToDiaryWithFilter({ part: ch ? ch.part_id : "", chapter: cid, section: sid });
      });
    });
  }

  // =====================================================================
  // TAB 4: PICKS & NOTES
  // =====================================================================
  function renderPicksTab() {
    const listEl = document.getElementById("picks-list");
    if (!listEl) return;

    const all = getAllRulings();
    const filtered = all.filter(r => {
      const p = getProgress(r.id);
      if (state.pickTab === "starred") return p.starred;
      if (state.pickTab === "review") return p.review;
      if (state.pickTab === "notes") return Boolean(p.note && p.note.trim());
      if (state.pickTab === "ga") return r.is_general_assembly;
      if (state.pickTab === "custom") return r.is_custom;
      return false;
    });

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="ledger-widget" style="text-align:center; padding:28px 16px;">
          <p style="margin:0 0 12px; color:var(--fg-2);">ยังไม่มีรายการในหมวดนี้ แตะปุ่ม ⭐ เก็งสอบ หรือ 📌 ทบทวน ในการ์ดคำพิพากษาเพื่อรวบรวมไว้ทบทวนก่อนสอบ</p>
          <button type="button" class="ios-btn-primary" id="btn-picks-go-diary">ไปที่คลังคำพิพากษา →</button>
        </div>
      `;
      document.getElementById("btn-picks-go-diary")?.addEventListener("click", () => switchTab("diary"));
      return;
    }

    listEl.innerHTML = filtered.slice(0, 50).map(r => renderRulingCard(r)).join("");
    bindCardEvents(listEl);
  }

  // =====================================================================
  // TAB 5: FLASHCARDS (With Touch Swipe Support)
  // =====================================================================
  function buildFlashcardDeck() {
    const all = getAllRulings();
    let pool = all.filter(r => {
      const p = getProgress(r.id);
      if (state.fcDeck === "part-1") return r.part_id === "part-1";
      if (state.fcDeck === "part-2") return r.part_id === "part-2";
      if (state.fcDeck === "starred") return p.starred;
      if (state.fcDeck === "review") return p.review;
      if (state.fcDeck === "ga") return r.is_general_assembly;
      return true;
    });
    if (!pool.length) pool = all;
    const copy = [...pool];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    state.fcList = copy;
    state.fcIndex = 0;
    state.fcFlipped = false;
  }

  function renderFlashcardsTab() {
    if (!state.fcList.length) buildFlashcardDeck();
    const stage = document.getElementById("fc-stage");
    if (!stage) return;

    const r = state.fcList[state.fcIndex];
    if (!r) return;
    const prog = getProgress(r.id);
    const previewFacts = r.facts && r.facts.length > 35
      ? r.facts.slice(0, 340) + (r.facts.length > 340 ? "…" : "")
      : r.section_full_title;

    stage.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:13px; color:var(--fg-3);">
        <span>การ์ดใบที่ ${state.fcIndex + 1} / ${state.fcList.length.toLocaleString()}</span>
        <div style="display:flex; gap:6px;">
          <button type="button" class="ios-icon-btn" id="fc-prev-btn">← ก่อนหน้า</button>
          <button type="button" class="ios-icon-btn" id="fc-next-btn">ถัดไป →</button>
        </div>
      </div>

      <div class="ios-fc-card" id="fc-touch-card">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:8px;">
            <span class="ios-ruling-card__cat">${escapeHtml(r.part_code)} · ${escapeHtml(r.chapter_code)}</span>
            ${r.is_general_assembly ? `<span class="ios-ga-badge">ประชุมใหญ่</span>` : ""}
          </div>
          <div style="font-size:12.5px; color:var(--fg-3); margin-bottom:6px;">
            ${escapeHtml((r.section_path || []).join(" › "))}
          </div>
          <h3 style="font-family:var(--font-display); font-size:18px; margin:0 0 10px;">
            ❓ ${escapeHtml(r.title)}
          </h3>
          <div style="font-size:15px; line-height:1.65; background:var(--cream-100); padding:11px 12px; border-radius:12px; border:1.5px dashed var(--sage-400);">
            ${escapeHtml(previewFacts)}
          </div>
        </div>

        ${!state.fcFlipped ? `
          <div style="text-align:center; padding-top:8px;">
            <span class="ios-btn-primary ios-btn-primary--honey" style="display:inline-flex; width:auto; padding:9px 18px; font-size:14px;">
              แตะเพื่อพลิกดูแนวคำวินิจฉัย
            </span>
          </div>
        ` : `
          <div style="border-top:2px dashed var(--line-ink); padding-top:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <strong style="font-size:13px;">💡 แนวคำวินิจฉัยศาลปกครองสูงสุด</strong>
              <span class="ios-cite-pill">${escapeHtml(r.short_citation)}</span>
            </div>
            <div class="ios-principle-box">
              ${formatLegalText(r.principle)}
            </div>
          </div>
        `}
      </div>

      <div class="ios-fc-controls" style="margin-top:12px;">
        <button type="button" class="ios-act-btn ${prog.review ? "is-review" : ""}" id="fc-btn-review" style="padding:11px 6px;">
          📌 ทบทวนซ้ำ
        </button>
        <button type="button" class="ios-act-btn ${prog.starred ? "is-starred" : ""}" id="fc-btn-star" style="padding:11px 6px;">
          ⭐ เก็งข้อสอบ
        </button>
        <button type="button" class="ios-act-btn is-read" id="fc-btn-read" style="padding:11px 6px;">
          ✅ จำแม่นแล้ว →
        </button>
      </div>
    `;

    const cardEl = document.getElementById("fc-touch-card");
    cardEl?.addEventListener("click", () => {
      state.fcFlipped = !state.fcFlipped;
      renderFlashcardsTab();
    });

    // Touch swipe left / right gesture for iPhone
    let touchStartX = 0;
    cardEl?.addEventListener("touchstart", e => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    cardEl?.addEventListener("touchend", e => {
      const dx = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(dx) > 60) {
        if (dx < 0) {
          state.fcIndex = (state.fcIndex + 1) % state.fcList.length;
        } else {
          state.fcIndex = (state.fcIndex - 1 + state.fcList.length) % state.fcList.length;
        }
        state.fcFlipped = false;
        renderFlashcardsTab();
      }
    }, { passive: true });

    document.getElementById("fc-prev-btn")?.addEventListener("click", () => {
      state.fcIndex = (state.fcIndex - 1 + state.fcList.length) % state.fcList.length;
      state.fcFlipped = false;
      renderFlashcardsTab();
    });
    document.getElementById("fc-next-btn")?.addEventListener("click", () => {
      state.fcIndex = (state.fcIndex + 1) % state.fcList.length;
      state.fcFlipped = false;
      renderFlashcardsTab();
    });
    document.getElementById("fc-btn-review")?.addEventListener("click", () => {
      updateProgress(r.id, { review: true });
      state.fcIndex = (state.fcIndex + 1) % state.fcList.length;
      state.fcFlipped = false;
      renderFlashcardsTab();
    });
    document.getElementById("fc-btn-star")?.addEventListener("click", () => {
      updateProgress(r.id, { starred: !prog.starred });
      renderFlashcardsTab();
    });
    document.getElementById("fc-btn-read")?.addEventListener("click", () => {
      updateProgress(r.id, { read: true, review: false });
      state.fcIndex = (state.fcIndex + 1) % state.fcList.length;
      state.fcFlipped = false;
      renderFlashcardsTab();
    });
  }

  // =====================================================================
  // BOTTOM SHEETS (Reader, Filter, Appearance, Add/Edit)
  // =====================================================================
  function openSheet(id) {
    document.getElementById(id)?.classList.add("is-open");
  }
  function closeSheet(id) {
    document.getElementById(id)?.classList.remove("is-open");
  }

  function openReaderSheet(rulingId) {
    const r = getAllRulings().find(x => x.id === rulingId);
    if (!r) return;
    const prog = getProgress(r.id);

    const citeEl = document.getElementById("reader-cite");
    if (citeEl) citeEl.textContent = r.citation;

    const bodyEl = document.getElementById("reader-body");
    if (bodyEl) {
      const pdfHref = r.pdf_file && r.pdf_page
        ? `../${encodeURIComponent(r.pdf_file)}#page=${r.pdf_page}`
        : null;

      bodyEl.innerHTML = `
        <div style="font-size:12.5px; color:var(--fg-3); font-weight:600;">
          ${escapeHtml(r.part_code)} › ${escapeHtml(r.chapter_code)} ${escapeHtml(r.chapter_title)} › ${escapeHtml((r.section_path || []).join(" › "))}
        </div>

        <h2 style="font-family:var(--font-display); font-size:20px; line-height:1.4; margin:0;">
          ${escapeHtml(r.title)}
        </h2>

        <div class="ios-principle-box">
          <div class="ios-principle-box__hd">💡 หลักกฎหมาย / แนวคำวินิจฉัยสำคัญ</div>
          <div>${formatLegalText(r.principle)}</div>
        </div>

        <div style="background:var(--cream-100); border:1.5px solid var(--line-ink); border-radius:14px; padding:12px; font-size:var(--reader-size); line-height:var(--reader-lh); white-space:pre-line;">
          <strong style="display:block; font-size:13px; color:var(--fg-2); margin-bottom:6px;">📖 ข้อเท็จจริงและเหตุผลแห่งคำวินิจฉัยฉบับเต็ม:</strong>
          ${formatLegalText(r.facts || r.content)}
        </div>

        ${(r.laws && r.laws.length) ? `
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${r.laws.map(l => `<span class="ios-chip" style="font-size:12px;">⚖️ ${escapeHtml(l)}</span>`).join("")}
          </div>
        ` : ""}

        <div class="ios-field" style="margin-top:4px;">
          <label for="reader-note-input">📝 บันทึกช่วยจำเตรียมสอบของฉัน</label>
          <textarea id="reader-note-input" class="ios-textarea" placeholder="จดสรุปหลักสำคัญ หรือข้อสังเกตส่วนตัว...">${escapeHtml(prog.note || "")}</textarea>
          <button type="button" class="ios-btn-primary ios-btn-primary--honey" id="btn-save-reader-note">
            บันทึกโน้ตช่วยจำ
          </button>
        </div>

        <div style="display:flex; justify-content:space-between; gap:8px; padding-top:6px;">
          ${pdfHref ? `
            <a href="${pdfHref}" target="_blank" rel="noopener" class="ios-icon-btn" style="flex:1; height:40px; text-decoration:none;">
              📄 เปิดหน้า PDF ต้นฉบับ
            </a>
          ` : ""}
          <button type="button" class="ios-icon-btn" id="btn-reader-edit" style="flex:1; height:40px;">
            ✏️ แก้ไขรายการนี้
          </button>
        </div>
      `;

      document.getElementById("btn-save-reader-note")?.addEventListener("click", () => {
        const val = document.getElementById("reader-note-input")?.value || "";
        updateProgress(r.id, { note: val.trim() });
        closeSheet("sheet-reader");
        refreshCurrentTab();
      });

      document.getElementById("btn-reader-edit")?.addEventListener("click", () => {
        closeSheet("sheet-reader");
        openAddSheet(r.id);
      });
    }

    openSheet("sheet-reader");
  }

  // Filter Sheet Cascading Selects
  function populateFilterSheetSelects(partId, chId, secId) {
    const partSel = document.getElementById("flt-part");
    const chSel = document.getElementById("flt-chapter");
    const secSel = document.getElementById("flt-section");
    if (!partSel || !chSel || !secSel) return;

    partSel.value = partId || "";
    const chOptions = [`<option value="">ทุกบท (๓๙ บท)</option>`];
    (baseData.toc || []).forEach(p => {
      if (partId && p.id !== partId) return;
      (p.chapters || []).forEach(c => {
        chOptions.push(`<option value="${c.id}">${escapeHtml(p.code)} · ${escapeHtml(c.code)} ${escapeHtml(c.title)}</option>`);
      });
    });
    chSel.innerHTML = chOptions.join("");
    chSel.value = chId || "";

    const secOptions = [`<option value="">ทุกหมวดหมู่ย่อย</option>`];
    const chObj = chaptersMap.get(chSel.value);
    if (chObj) {
      (chObj.sections || []).forEach(s => {
        secOptions.push(`<option value="${s.id}">${escapeHtml(s.full_title)}</option>`);
      });
    }
    secSel.innerHTML = secOptions.join("");
    secSel.value = secId || "";
  }

  // Add / Edit Sheet Cascading Selects
  function populateAddSheetSelects(partId, chId, secId) {
    const pSel = document.getElementById("add-part");
    const cSel = document.getElementById("add-chapter");
    const sSel = document.getElementById("add-section");
    if (!pSel || !cSel || !sSel) return;

    const pObj = partsMap.get(partId) || baseData.toc[0];
    pSel.value = pObj.id;

    cSel.innerHTML = (pObj.chapters || []).map(c =>
      `<option value="${c.id}">${escapeHtml(c.code)} · ${escapeHtml(c.title)}</option>`
    ).join("");
    const targetCh = (chId && chaptersMap.get(chId)?.part_id === pObj.id) ? chId : pObj.chapters[0]?.id;
    cSel.value = targetCh;

    const chObj = chaptersMap.get(targetCh);
    sSel.innerHTML = (chObj?.sections || []).map(s =>
      `<option value="${s.id}">${escapeHtml(s.full_title)}</option>`
    ).join("");
    if (secId && sectionsMap.get(secId)?.chapter_id === targetCh) {
      sSel.value = secId;
    }
  }

  function openAddSheet(editId = null) {
    const titleEl = document.getElementById("add-sheet-title");
    const idIn = document.getElementById("add-id");
    const typeIn = document.getElementById("add-type");
    const citeIn = document.getElementById("add-cite");
    const gaIn = document.getElementById("add-ga");
    const rTitleIn = document.getElementById("add-title");
    const prinIn = document.getElementById("add-principle");
    const factsIn = document.getElementById("add-facts");
    const noteIn = document.getElementById("add-note");

    if (editId) {
      const ex = getAllRulings().find(x => x.id === editId);
      if (!ex) return;
      const prog = getProgress(ex.id);
      titleEl.textContent = `แก้ไข (${ex.short_citation || ex.citation})`;
      idIn.value = ex.id;
      populateAddSheetSelects(ex.part_id, ex.chapter_id, ex.section_id);
      typeIn.value = ex.ruling_type || "คำพิพากษา";
      citeIn.value = ex.citation || "";
      gaIn.checked = Boolean(ex.is_general_assembly);
      rTitleIn.value = ex.title || "";
      prinIn.value = ex.principle || "";
      factsIn.value = ex.facts || "";
      noteIn.value = prog.note || "";
    } else {
      titleEl.textContent = "บันทึกคำพิพากษาใหม่";
      idIn.value = "";
      populateAddSheetSelects(
        state.filters.part || "part-1",
        state.filters.chapter || "",
        state.filters.section || ""
      );
      typeIn.value = "คำพิพากษา";
      citeIn.value = "";
      gaIn.checked = false;
      rTitleIn.value = "";
      prinIn.value = "";
      factsIn.value = "";
      noteIn.value = "";
    }
    openSheet("sheet-add");
  }

  // =====================================================================
  // Global Event Bindings
  // =====================================================================
  function bindEvents() {
    // Bottom Tabs
    document.querySelectorAll(".ios-tab").forEach(tab => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });
    document.querySelector("[data-tab-jump]")?.addEventListener("click", () => switchTab("home"));

    // Home Stat Boxes
    document.querySelectorAll("[data-quick-status]").forEach(box => {
      box.addEventListener("click", () => {
        jumpToDiaryWithFilter({ status: box.dataset.quickStatus });
      });
    });

    // Home Paths
    document.querySelectorAll("[data-path-action]").forEach(card => {
      card.addEventListener("click", () => {
        const act = card.dataset.pathAction;
        if (act === "part-1" || act === "part-2") jumpToDiaryWithFilter({ part: act });
        else if (act === "ga") jumpToDiaryWithFilter({ type: "ga" });
      });
    });

    // Home Shelf Segmented Control & Search
    document.querySelectorAll("[data-shelf-part]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.shelfPart = btn.dataset.shelfPart;
        document.querySelectorAll("[data-shelf-part]").forEach(b =>
          b.classList.toggle("is-active", b.dataset.shelfPart === state.shelfPart)
        );
        renderHomeChapterList();
      });
    });
    document.getElementById("shelf-q")?.addEventListener("input", e => {
      state.shelfQ = e.target.value;
      renderHomeChapterList();
    });

    // Diary Search & Quick Chips
    document.getElementById("diary-q")?.addEventListener("input", e => {
      state.filters.q = e.target.value;
      state.pageSize = 20;
      renderDiaryTab();
    });

    document.querySelectorAll("[data-diary-chip]").forEach(chip => {
      chip.addEventListener("click", () => {
        const mode = chip.dataset.diaryChip;
        document.querySelectorAll("[data-diary-chip]").forEach(c =>
          c.classList.toggle("is-active", c.dataset.diaryChip === mode)
        );
        state.filters.part = "";
        state.filters.type = "";
        state.filters.status = "";
        if (mode === "part-1" || mode === "part-2") state.filters.part = mode;
        else if (mode === "ga") state.filters.type = "ga";
        else if (mode === "starred" || mode === "review" || mode === "unread") state.filters.status = mode;
        state.pageSize = 20;
        renderDiaryTab();
      });
    });

    document.getElementById("btn-clear-filter")?.addEventListener("click", () => {
      jumpToDiaryWithFilter({});
    });

    document.getElementById("btn-diary-more")?.addEventListener("click", () => {
      state.pageSize += 20;
      renderDiaryTab();
    });

    // TOC Search
    document.getElementById("toc-q")?.addEventListener("input", () => renderTocTab());

    // Picks Chips
    document.querySelectorAll("[data-pick-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.pickTab = btn.dataset.pickTab;
        document.querySelectorAll("[data-pick-tab]").forEach(b =>
          b.classList.toggle("is-active", b.dataset.pickTab === state.pickTab)
        );
        renderPicksTab();
      });
    });

    // Flashcards Deck & Shuffle
    document.getElementById("fc-deck")?.addEventListener("change", e => {
      state.fcDeck = e.target.value;
      buildFlashcardDeck();
      renderFlashcardsTab();
    });
    document.getElementById("btn-fc-shuffle")?.addEventListener("click", () => {
      buildFlashcardDeck();
      renderFlashcardsTab();
    });

    // Sheet Open / Close
    document.getElementById("btn-open-aa")?.addEventListener("click", () => openSheet("sheet-aa"));
    document.getElementById("btn-open-add")?.addEventListener("click", () => openAddSheet(null));
    document.getElementById("btn-open-filter")?.addEventListener("click", () => {
      populateFilterSheetSelects(state.filters.part, state.filters.chapter, state.filters.section);
      const tSel = document.getElementById("flt-type");
      if (tSel) tSel.value = state.filters.type || "";
      openSheet("sheet-filter");
    });

    document.querySelectorAll("[data-close-sheet]").forEach(btn => {
      btn.addEventListener("click", () => closeSheet(btn.dataset.closeSheet));
    });
    document.querySelectorAll(".ios-sheet-backdrop").forEach(bd => {
      bd.addEventListener("click", e => {
        if (e.target === bd) bd.classList.remove("is-open");
      });
    });

    // Appearance Controls
    document.querySelectorAll("[data-set-theme]").forEach(b => {
      b.addEventListener("click", () => setTheme(b.dataset.setTheme));
    });
    document.querySelectorAll("[data-set-font]").forEach(b => {
      b.addEventListener("click", () => setFont(b.dataset.setFont));
    });
    document.querySelectorAll("[data-set-size]").forEach(b => {
      b.addEventListener("click", () => setSize(b.dataset.setSize));
    });
    document.getElementById("toggle-highlight")?.addEventListener("change", e => {
      setHighlight(e.target.checked ? "on" : "off");
    });
    document.getElementById("btn-toggle-frame")?.addEventListener("click", e => {
      const isFull = document.body.getAttribute("data-fullwidth") === "true";
      if (isFull) {
        document.body.removeAttribute("data-fullwidth");
        e.target.textContent = "ขยายเต็มจอ";
      } else {
        document.body.setAttribute("data-fullwidth", "true");
        e.target.textContent = "กรอบ iPhone";
      }
    });

    // Filter Sheet Controls
    document.getElementById("flt-part")?.addEventListener("change", e => {
      populateFilterSheetSelects(e.target.value, "", "");
    });
    document.getElementById("flt-chapter")?.addEventListener("change", e => {
      const ch = chaptersMap.get(e.target.value);
      populateFilterSheetSelects(ch ? ch.part_id : document.getElementById("flt-part").value, e.target.value, "");
    });
    document.getElementById("btn-reset-sheet-filter")?.addEventListener("click", () => {
      populateFilterSheetSelects("", "", "");
      document.getElementById("flt-type").value = "";
    });
    document.getElementById("btn-apply-sheet-filter")?.addEventListener("click", () => {
      state.filters.part = document.getElementById("flt-part").value;
      state.filters.chapter = document.getElementById("flt-chapter").value;
      state.filters.section = document.getElementById("flt-section").value;
      state.filters.type = document.getElementById("flt-type").value;
      state.pageSize = 20;
      closeSheet("sheet-filter");
      switchTab("diary");
    });

    // Add Sheet Form Submit
    document.getElementById("add-part")?.addEventListener("change", e => {
      populateAddSheetSelects(e.target.value, "", "");
    });
    document.getElementById("add-chapter")?.addEventListener("change", e => {
      populateAddSheetSelects(document.getElementById("add-part").value, e.target.value, "");
    });

    document.getElementById("form-ios-add")?.addEventListener("submit", e => {
      e.preventDefault();
      const editId = document.getElementById("add-id").value;
      const partId = document.getElementById("add-part").value;
      const chId = document.getElementById("add-chapter").value;
      const secId = document.getElementById("add-section").value;

      const partObj = partsMap.get(partId);
      const chObj = chaptersMap.get(chId);
      const secObj = sectionsMap.get(secId);

      const rType = document.getElementById("add-type").value;
      const citation = document.getElementById("add-cite").value.trim();
      const isGa = document.getElementById("add-ga").checked;
      const title = document.getElementById("add-title").value.trim();
      const principle = document.getElementById("add-principle").value.trim();
      const facts = document.getElementById("add-facts").value.trim() || principle;
      const note = document.getElementById("add-note").value.trim();

      const patch = {
        part_id: partId,
        part_code: partObj ? partObj.code : "ภาค ๑",
        part_title: partObj ? partObj.title : "",
        chapter_id: chId,
        chapter_code: chObj ? chObj.code : "",
        chapter_title: chObj ? chObj.title : "",
        section_id: secId || null,
        section_code: secObj ? secObj.code : "",
        section_title: secObj ? secObj.title : "",
        section_full_title: secObj ? secObj.full_title : "",
        section_path: secObj ? secObj.path : [],
        ruling_type: rType,
        citation,
        short_citation: citation,
        citation_arabic: toArabicDigits(citation),
        is_general_assembly: isGa,
        title,
        principle,
        facts,
        content: facts
      };

      if (editId) {
        const cIdx = state.customRulings.findIndex(x => x.id === editId);
        if (cIdx !== -1) state.customRulings[cIdx] = { ...state.customRulings[cIdx], ...patch };
        else state.editedRulings[editId] = patch;
        updateProgress(editId, { note });
      } else {
        const newId = "custom-" + Date.now();
        state.customRulings.unshift({
          id: newId,
          seq: 10000 + state.customRulings.length + 1,
          is_custom: true,
          ...patch
        });
        updateProgress(newId, { note, starred: true, read: true });
      }

      saveState();
      closeSheet("sheet-add");
      refreshCurrentTab();
    });

    // PDF Upload & JSON Export
    const pdfIn = document.getElementById("input-pdf-upload");
    document.getElementById("btn-upload-pdf")?.addEventListener("click", () => pdfIn?.click());
    pdfIn?.addEventListener("change", async e => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const btn = document.getElementById("btn-upload-pdf");
      if (btn) btn.textContent = "กำลังสกัด PDF...";
      try {
        for (const f of files) {
          const res = await fetch("/api/upload-pdf", {
            method: "POST",
            headers: {
              "Content-Type": "application/pdf",
              "X-Filename": encodeURIComponent(f.name)
            },
            body: f
          });
          if (!res.ok) throw new Error("อัปโหลดไม่สำเร็จ");
        }
        window.location.reload();
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById("btn-export-data")?.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify({
        app: "Admin Law Diary iPhone",
        exportedAt: new Date().toISOString(),
        progress: state.progress,
        customRulings: state.customRulings,
        editedRulings: state.editedRulings,
        deletedIds: state.deletedIds
      }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `admin-law-iphone-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  initPreferences();
  loadState();
  bindEvents();
  refreshCurrentTab();
})();
