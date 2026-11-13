// Router and page frame. Screens live in views-*.js and register in VG.views.
// Address is a plain #name (e.g. #report); screen parameters are kept in memory for the session.
(function () {
  const VG = window.VG;
  const ALL = ["officer", "admin", "viewer"];

  // route -> [view name, roles allowed]
  const ROUTES = {
    "login": ["login", null],
    "my": ["officerMonth", ["officer"]],
    "report": ["officerReport", ["officer"]],
    "overview": ["overview", ["viewer", "admin"]],
    "office": ["office", ["viewer", "admin"]],
    "kpis": ["kpis", ["viewer", "admin"]],
    "step": ["stepDetail", ALL],
    "status": ["adminStatus", ["admin"]],
    "steps": ["adminSteps", ["admin"]],
    "step-edit": ["adminStepEdit", ["admin"]],
    "users": ["adminUsers", ["admin"]],
    "schemes": ["adminSchemes", ["admin"]],
    "log": ["changeLog", ["admin"]],
  };

  const IC = {
    grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    steps: '<path d="M4 18h5v-5h5V8h6"/>',
    users: '<path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.9M15 4.1a3 3 0 0 1 0 5.8"/>',
    rupee: '<path d="M6 4h12M6 9h12M14 20L7 13h3a4 4 0 0 0 0-8"/>',
    target: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01"/>',
    clock: '<path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>',
  };
  const NAV = {
    officer: [["my", "My steps", "list"]],
    viewer: [["overview", "Dashboard", "grid"], ["kpis", "KPIs", "target"]],
    admin: [["overview", "Dashboard", "grid"], ["kpis", "KPIs", "target"], ["status", "Submissions", "check"], ["steps", "Steps", "steps"],
      ["users", "Users", "users"], ["schemes", "Schemes", "rupee"], ["log", "Change log", "clock"]],
  };
  const PARENT = { report: "my", office: "overview", step: null, "step-edit": "steps" };
  const HOME = { officer: "my", viewer: "overview", admin: "overview" };

  let params = {};
  try { params = JSON.parse(sessionStorage.getItem("vg:params") || "{}"); } catch (e) { params = {}; }
  function keepParams() { try { sessionStorage.setItem("vg:params", JSON.stringify(params)); } catch (e) { /* ignore */ } }

  async function frame(user, path) {
    const shell = document.getElementById("shell");
    const side = document.getElementById("side");
    if (!user) { shell.classList.add("bare"); side.innerHTML = ""; return; }
    shell.classList.remove("bare");
    const active = PARENT[path] !== undefined && PARENT[path] !== null ? PARENT[path] : path;
    const sample = await VG.store.isSample();
    side.innerHTML = `
      <div class="brand"><b class="bn-full">${VG.ui.esc(VG.config.appName)}</b><b class="bn-short">${VG.ui.esc(VG.config.shortName)}</b><span>Viksit Gujarat @2047</span></div>
      <nav>${NAV[user.role].map(([r, label, ic]) =>
        `<a href="#${r}" data-go="${r}"${active === r ? ' class="on" aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${IC[ic]}</svg>${label}</a>`).join("")}</nav>
      <div class="me">
        ${sample ? '<span class="sample-tag">Sample data</span>' : ""}
        <b>${VG.ui.esc(user.name)}</b>
        <span class="office">${user.office ? VG.ui.esc(VG.ui.officeShort(user.office)) : user.role === "admin" ? "Admin" : "Viewer"}</span>
        <button type="button" id="signout">Sign out</button>
      </div>`;
    side.querySelector("#signout").onclick = () => { VG.auth.signOut(); params = {}; keepParams(); location.hash = "#login"; };
  }

  async function render() {
    const path = location.hash.replace(/^#\/?/, "").split("?")[0];
    const user = VG.auth.user();
    const main = document.getElementById("main");

    if (!user && path !== "login") { location.hash = "#login"; return; }
    if (user && (path === "" || path === "login")) { location.hash = "#" + HOME[user.role]; return; }
    const route = ROUTES[path];
    if (!route) { location.hash = "#" + (user ? HOME[user.role] : "login"); return; }
    const [viewName, roles] = route;
    if (roles && !roles.includes(user.role)) { location.hash = "#" + HOME[user.role]; return; }

    await frame(user, path);
    main.innerHTML = "";
    document.getElementById("tip").hidden = true;
    try {
      await VG.views[viewName](main, params[path] || {});
    } catch (e) {
      console.error(e);
      main.innerHTML = `<div class="page"><p class="error">${VG.ui.esc(e.message)}</p></div>`;
    }
    window.scrollTo(0, 0);
  }

  VG.app = {
    go(route, p) {
      params[route] = p || {};
      keepParams();
      if (location.hash === "#" + route) render(); else location.hash = "#" + route;
    },
    refresh: render,
    home() { return HOME[VG.auth.user().role]; },
  };

  // Internal links: <a href="#route" data-go="route" data-p='{"id":..}'>
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-go]");
    if (!a || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    let p = params[a.dataset.go] || {};
    if (a.dataset.p) { try { p = JSON.parse(a.dataset.p); } catch (err) { /* keep */ } }
    VG.app.go(a.dataset.go, p);
  });

  // Tooltip for any element with data-tip
  const tip = () => document.getElementById("tip");
  document.addEventListener("mouseover", (e) => {
    const t = e.target.closest("[data-tip]");
    if (!t) { tip().hidden = true; return; }
    tip().textContent = t.dataset.tip;
    tip().hidden = false;
  });
  document.addEventListener("mousemove", (e) => {
    const el = tip();
    if (el.hidden) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
    el.style.left = x + "px";
    el.style.top = y + "px";
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { const m = document.getElementById("modal"); if (!m.hidden) m.querySelector("#m-no, #m-close")?.click(); }
  });

  window.addEventListener("hashchange", render);
  window.addEventListener("DOMContentLoaded", async () => {
    await VG.store.init();
    await VG.auth.restore();
    render();
  });
})();
