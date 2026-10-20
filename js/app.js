// Shared app logic: storage, auth gate, theme, top bar, helpers.
// Prototype note: storage is the browser's localStorage and the login gate is client-side only.
// A real deployment needs server-side auth (e.g. Discord OAuth + role check) and an API/database.
(function () {
  const KEY = "aoc.db.v16"; // bumped when the seed's shape changes
  const SESSION = "aoc.session";
  const THEME = "aoc.theme";

  function safeGet(store, k) { try { return store.getItem(k); } catch { return null; } }
  function safeSet(store, k, v) { try { store.setItem(k, v); } catch { /* storage blocked */ } }

  // ---------- Theme (applied immediately to avoid flash) ----------
  const theme = safeGet(localStorage, THEME) || "ops";
  document.documentElement.setAttribute("data-theme", theme);

  // ---------- Store ----------
  let db = null;
  function load() {
    if (db) return db;
    const raw = safeGet(localStorage, KEY);
    if (raw) { try { db = JSON.parse(raw); } catch { db = null; } }
    if (!db) db = structuredClone(window.AOC_SEED);
    else mergeNewSeed(db);
    ensureShared(db);
    return db;
  }
  // Products added after a browser first saved data still get their example content and status
  function mergeNewSeed(d) {
    const seed = window.AOC_SEED;
    for (const [cid, products] of Object.entries(seed.content)) {
      d.content[cid] = d.content[cid] || {};
      for (const [pid, val] of Object.entries(products)) {
        if (!(pid in d.content[cid])) {
          d.content[cid][pid] = structuredClone(val);
          const c = d.campaigns.find(x => x.id === cid), sc = seed.campaigns.find(x => x.id === cid);
          if (c && sc?.status?.[pid]) { c.status = c.status || {}; c.status[pid] = c.status[pid] || sc.status[pid]; }
        }
      }
    }
    d.submissions = d.submissions || [];
    (seed.submissions || []).forEach(s => { if (!d.submissions.some(x => x.id === s.id)) d.submissions.push(structuredClone(s)); });
    // group sign-in fields added after first save
    seed.groups.forEach(sg => {
      const g = d.groups.find(x => x.id === sg.id);
      if (g && !g.login) { g.login = sg.login; g.code = sg.code; }
    });
  }
  // Seeded "published" products get a shared snapshot so the unit portal has something to show
  function ensureShared(d) {
    d.campaigns.forEach(c => {
      c.shared = c.shared || {};
      Object.entries(c.status || {}).forEach(([pid, s]) => {
        if (s === "approved" && !c.approvals?.[pid]) {
          c.approvals = c.approvals || {};
          c.approvals[pid] = { by: "OVERLORD", role: "CFACC", when: "2026-10-19T18:00:00Z" };
        }
        if (s === "published" && !c.shared[pid] && d.content[c.id]?.[pid]) {
          const rel = c.releases?.[pid];
          const when = rel?.when || "2026-10-19T06:00:00Z";
          c.approvals = c.approvals || {};
          c.approvals[pid] = c.approvals[pid] || { by: "OVERLORD", role: "CFACC", when };
          c.shared[pid] = { groups: c.groups.filter(g => d.groups.find(x => x.id === g)?.status === "active"),
            when, by: "OVERLORD", version: rel?.v || 1, approval: c.approvals[pid],
            data: structuredClone(d.content[c.id][pid]) };
        }
      });
    });
  }
  function save() { safeSet(localStorage, KEY, JSON.stringify(db)); }

  const Store = {
    get db() { return load(); },
    save,
    reset() { try { localStorage.removeItem(KEY); } catch {} db = null; load(); },
    campaign(id) { return load().campaigns.find(c => c.id === id) || load().campaigns[0]; },
    group(id) { return load().groups.find(g => g.id === id); },
    currentCampaignId() {
      const fromUrl = new URLSearchParams(location.search).get("c");
      return fromUrl || safeGet(localStorage, "aoc.campaign") || load().campaigns[0].id;
    },
    setCurrentCampaign(id) { safeSet(localStorage, "aoc.campaign", id); },
    content(cid, pid) {
      const d = load();
      d.content[cid] = d.content[cid] || {};
      return d.content[cid][pid];
    },
    setContent(cid, pid, data) {
      const d = load();
      d.content[cid] = d.content[cid] || {};
      d.content[cid][pid] = data;
      save();
    },
    status(cid, pid) { return (Store.campaign(cid).status || {})[pid] || "none"; },
    setStatus(cid, pid, s) {
      const c = Store.campaign(cid);
      c.status = c.status || {};
      c.status[pid] = s;
      c.updated = c.updated || {};
      c.updated[pid] = new Date().toISOString();
      // approval stamp; any return to draft/review clears it so changes are re-approved
      c.approvals = c.approvals || {};
      if (s === "approved") { const u = Auth.user(); c.approvals[pid] = { by: u?.callsign, role: u?.role, when: c.updated[pid] }; }
      else if (s !== "published") delete c.approvals[pid];
      save();
    },
    approval(cid, pid) { return Store.campaign(cid).approvals?.[pid]; },
    // Publishing freezes a snapshot: units always receive the released version, never a live draft
    shared(cid, pid) { return Store.campaign(cid).shared?.[pid]; },
    publish(cid, pid, groups, data) {
      const c = Store.campaign(cid);
      c.shared = c.shared || {};
      const prev = c.shared[pid];
      c.shared[pid] = { groups, when: new Date().toISOString(), by: Auth.user()?.callsign, version: (prev?.version || 0) + 1,
        approval: c.approvals?.[pid], data: structuredClone(data) };
      save();
    },
    // Products released to a given group in a campaign
    sharedWith(cid, gid) {
      const c = Store.campaign(cid);
      return Object.entries(c.shared || {}).filter(([, s]) => s.groups.includes(gid)).map(([pid, s]) => ({ pid, ...s }));
    },
    // Highest version of a product a group has pulled (0 = never)
    received(cid, gid, pid) {
      return (load().receipts || []).filter(r => r.cid === cid && r.gid === gid && r.pid === pid).reduce((m, r) => Math.max(m, r.v), 0);
    },
    markReceived(cid, gid, pid, v) {
      const d = load();
      d.receipts = d.receipts || [];
      if (Store.received(cid, gid, pid) >= v) return;
      d.receipts.push({ cid, gid, pid, v, when: new Date().toISOString() });
      save();
    },
    submission(id) { return (load().submissions || []).find(s => s.id === id); },
    saveSubmission(sub) {
      const d = load();
      d.submissions = d.submissions || [];
      sub.updated = new Date().toISOString();
      const i = d.submissions.findIndex(s => s.id === sub.id);
      if (i >= 0) d.submissions[i] = sub; else d.submissions.unshift(sub);
      save();
    },
    addRequest(cid, gid, product, note) {
      const d = load();
      d.requests.unshift({ id: "r" + Date.now(), campaign: cid, group: gid, product, note, when: new Date().toISOString(), state: "open" });
      save();
    },
    log(cid, text, by) {
      const d = load();
      d.activity = d.activity || [];
      d.activity.unshift({ cid, text, when: new Date().toISOString(), by: by || Auth.user()?.callsign });
      d.activity = d.activity.slice(0, 50);
      save();
    }
  };

  // ---------- Auth ----------
  // What each CAOC role may do. Everyone on staff can build products and submit them for review.
  const PERMS = {
    CFC: ["approve", "publish", "decideProposals"],   // manages the CAOC, assists the CFACC
    CFACC: ["approve", "publish"]                       // deliverables built and approved
  };
  const Auth = {
    user() { try { return JSON.parse(safeGet(sessionStorage, SESSION)); } catch { return null; } },
    can(perm) { return (PERMS[Auth.user()?.role] || []).includes(perm); },
    login(callsign, password) {
      const u = load().users.find(x => x.callsign.toLowerCase() === String(callsign).trim().toLowerCase());
      if (!u || u.password !== password) return false;
      safeSet(sessionStorage, SESSION, JSON.stringify({ callsign: u.callsign, name: u.name, role: u.role }));
      return true;
    },
    logout() { try { sessionStorage.removeItem(SESSION); } catch {} location.href = "login.html"; },
    require() {
      if (!Auth.user()) {
        location.replace("login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search));
        throw new Error("auth required");
      }
    }
  };

  // Participating-group accounts for the unit portal (separate session from staff)
  const UNIT_SESSION = "aoc.unitSession";
  const UnitAuth = {
    group() {
      try { const s = JSON.parse(safeGet(sessionStorage, UNIT_SESSION)); return s && load().groups.find(g => g.id === s.id); } catch { return null; }
    },
    login(loginId, code) {
      const g = load().groups.find(x => x.login && x.login.toLowerCase() === String(loginId).trim().toLowerCase());
      if (!g || g.code !== code) return "Unknown group login or wrong access code.";
      if (g.status !== "active") return "This group's registration is still pending AOC approval.";
      safeSet(sessionStorage, UNIT_SESSION, JSON.stringify({ id: g.id }));
      return true;
    },
    logout() { try { sessionStorage.removeItem(UNIT_SESSION); } catch {} location.href = "unit-login.html"; },
    require() {
      if (!UnitAuth.group()) { location.replace("unit-login.html"); throw new Error("unit auth required"); }
    }
  };

  // ---------- Helpers ----------
  function download(name, text, type = "text/plain") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  // Plain-text version of a rendered product (tables become tab-separated rows)
  function htmlToText(html) {
    const el = document.createElement("article");
    el.className = "doc";
    el.style.cssText = "position:absolute;left:-10000px;top:0;max-height:none;width:900px";
    el.innerHTML = html;
    document.body.appendChild(el);
    const t = el.innerText;
    el.remove();
    return t;
  }
  const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  }
  function zulu(d = new Date()) {
    const p = n => String(n).padStart(2, "0");
    const mon = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getUTCMonth()];
    return `${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}Z ${mon} ${String(d.getUTCFullYear()).slice(2)}`;
  }
  const STATUS_LABEL = { none: "Not started", draft: "Draft", review: "In review", approved: "Approved", published: "Published" };

  const LOGO = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="6" stroke-dasharray="2 2"/>
    <path d="M16 3v6M16 23v6M3 16h6M23 16h6"/><path d="M16 16 L25 9" stroke-width="2.5"/></svg>`;

  // ---------- Chrome ----------
  function renderChrome(opts = {}) {
    // Op Status is shared: a unit sees it as their group, staff see it as observers
    const unit = opts.unit ? UnitAuth.group() : null;
    const u = unit ? null : Auth.user();
    const pending = (load().submissions || []).filter(s => s.status === "submitted").length;
    const banner = document.createElement("div");
    banner.className = "banner";
    banner.textContent = "UNCLASSIFIED // EXERCISE — DCS WORLD SIMULATION ONLY";
    document.body.prepend(banner);

    if (opts.bar === false) return;
    const bar = document.createElement("header");
    bar.className = "topbar";
    bar.innerHTML = `
      <a class="brand" href="${unit ? "unit.html" : "index.html"}">${LOGO}<span>VIRTUAL AOC<small>${opts.unit ? "OP STATUS · UNIT PORTAL" : "COMBINED AIR OPERATIONS CENTER"}</small></span></a>
      <nav class="topnav">${(unit
        ? [["unit.html", "Op Status"], ["campaign-submit.html", "Submit a campaign"]]
        : u ? [["index.html", "Dashboard"], ["unit.html", "Op Status"], ["campaign-review.html", "Proposals" + (pending ? ` (${pending})` : "")]] : [])
        .map(([href, label]) => `<a href="${href}" ${location.pathname.endsWith(href) ? 'aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
      <span class="spacer"></span>
      <span class="zulu" id="zulu"></span>
      <div class="theme-picker" role="group" aria-label="Visual style">
        <span>STYLE</span>
        <button data-set="ops" title="Option A — Ops Floor"></button>
        <button data-set="nvg" title="Option B — Night Vision"></button>
        <button data-set="staff" title="Option C — Staff Paper"></button>
      </div>
      ${u ? `<div class="user-chip"><b>${esc(u.callsign)}</b><span class="role">${esc(u.role)}</span>
        <button class="btn sm ghost" id="logout">Sign out</button></div>` : ""}
      ${unit ? `<div class="user-chip"><b>${esc(unit.name)}</b><span class="role">${esc(unit.airframes)}</span>
        <button class="btn sm ghost" id="logout">Sign out</button></div>` : ""}`;
    banner.after(bar);

    const tick = () => { const z = document.getElementById("zulu"); if (z) z.textContent = zulu(); };
    tick(); setInterval(tick, 15000);

    bar.querySelectorAll(".theme-picker button").forEach(b => {
      b.setAttribute("aria-pressed", String(b.dataset.set === document.documentElement.dataset.theme));
      b.onclick = () => {
        document.documentElement.setAttribute("data-theme", b.dataset.set);
        safeSet(localStorage, THEME, b.dataset.set);
        bar.querySelectorAll(".theme-picker button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      };
    });
    const lo = document.getElementById("logout");
    if (lo) lo.onclick = unit ? UnitAuth.logout : Auth.logout;
  }

  window.AOC = { Store, Auth, UnitAuth, esc, toast, zulu, renderChrome, download, htmlToText, STATUS_LABEL, LOGO };
})();
