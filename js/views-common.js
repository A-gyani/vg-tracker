// Screens used by more than one role: sign-in and one intervention.
(function () {
  const VG = window.VG;
  const { esc } = VG.ui;
  VG.views = VG.views || {};

  // 1. Sign in (landing page)
  // Left: emblem, department, app name, photo (app/img/landing-photo.jpg; a collage of the five offices shows until added).
  // Right: choose your office (or Secretary / Admin), then sign in.
  const TILES = () => [
    ...VG.config.offices.map((o) => ({ id: o.id, title: o.short, sub: o.name, role: "officer", office: o.id })),
    { id: "SECRETARY", title: "Secretary", sub: "Department view of all five offices", role: "viewer" },
    { id: "ADMIN", title: "Admin", sub: "Interventions, users, schemes and submissions", role: "admin" },
  ];

  VG.views.login = async (el) => {
    const local = VG.config.backend === "local";
    const users = (await VG.store.listUsers()).filter((u) => u.active !== false);
    const sample = local ? await VG.store.isSample() : false;
    const tiles = TILES();
    const tileHtml = (t) => `<button type="button" class="otile" data-tile="${esc(t.id)}">${VG.logos.mark(t.id)}
      <span class="ot-text"><b>${esc(t.title)}</b><small>${esc(t.sub)}</small></span></button>`;

    el.innerHTML = `<div class="landing">
      <section class="land-side">
        <div class="land-brand">
          <img class="land-emblem" src="img/logos/emblem.png" alt="Emblem">
          <div><span>Government of Gujarat</span><b>Sports, Youth &amp; Cultural Activities Department</b></div>
        </div>
        <h1 class="land-name">${esc(VG.config.appName)}</h1>
        <div class="land-visual">
          <div class="mosaic" aria-hidden="true">${VG.config.offices.map((o) =>
            `<div class="tile-${esc(o.id)}" style="--c:var(--o-${esc(o.id)})">${VG.logos.icon(o.id)}<span>${esc(o.short)}</span></div>`).join("")}</div>
          <img src="img/landing-photo.jpg" alt="Map of Gujarat with the department's sports, youth and cultural activities" onload="this.parentNode.classList.add('has-photo')" onerror="this.remove()">
        </div>
      </section>

      <section class="land-main">
        <div id="pickpane">
          <div class="land-head"><h2>Sign in</h2><p>Select your office to continue</p></div>
          <div class="otiles">${tiles.filter((t) => t.role === "officer").map(tileHtml).join("")}</div>
          <div class="land-sub">Department</div>
          <div class="otiles two">${tiles.filter((t) => t.role !== "officer").map(tileHtml).join("")}</div>
        </div>
        <div id="signpane" hidden></div>
        ${local ? `<details class="testmode">
          <summary>Test mode · sample data</summary>
          <p class="muted small">Sample data fills the earlier quarters of this year with made-up reports so the dashboards can be tried. The current quarter stays empty for you to fill.${sample ? " Sample data is loaded." : ""}</p>
          <div class="actions">${sample ? "" : '<button type="button" id="sample">Load sample data</button>'}
            <button type="button" class="secondary" id="reset">Clear all data</button></div>
        </details>` : ""}
      </section>
    </div>`;

    const pick = el.querySelector("#pickpane");
    const sign = el.querySelector("#signpane");

    function open(t) {
      const list = users.filter((u) => u.role === t.role && (t.role !== "officer" || u.office === t.office));
      sign.innerHTML = `<div class="card signcard">
        <button type="button" class="back" id="back">Choose another office</button>
        <div class="sign-who">${VG.logos.mark(t.id, 56)}<div><b>${esc(t.title)}</b><small>${esc(t.sub)}</small></div></div>
        <form id="f" class="form" novalidate>
          <label>Email<input id="email" name="email" type="email" autocomplete="username" required></label>
          <label>Password<input id="password" name="password" type="password" autocomplete="current-password" required></label>
          <p class="error small" id="err" hidden></p>
          <div class="actions"><button>Sign in</button></div>
        </form>
        ${local ? `<div class="testlogins"><span class="muted small">Test mode: any password works. Or choose a test login:</span>
          <div class="chips">${list.map((u) => `<button type="button" class="pick" data-id="${esc(u.id)}">${esc(u.name)}<span>${esc(u.email)}</span></button>`).join("")
            || '<span class="muted small">No test login for this office.</span>'}</div></div>` : ""}
      </div>`;
      pick.hidden = true; sign.hidden = false;
      sign.querySelector("#email").focus();
      sign.querySelector("#back").onclick = () => { sign.hidden = true; pick.hidden = false; };
      sign.querySelectorAll(".pick").forEach((b) => {
        b.onclick = async () => { await VG.auth.signInAs(b.dataset.id); VG.app.go(VG.app.home()); };
      });
      sign.querySelector("#f").onsubmit = async (e) => {
        e.preventDefault();
        const err = sign.querySelector("#err");
        const email = sign.querySelector("#email").value.trim().toLowerCase();
        if (!local) { err.textContent = "Sign-in with email and password is added in the Firebase stage."; err.hidden = false; return; }
        const u = list.find((x) => (x.email || "").toLowerCase() === email);
        if (!u) { err.textContent = "No login with this email for " + t.title + "."; err.hidden = false; return; }
        await VG.auth.signInAs(u.id); VG.app.go(VG.app.home());
      };
    }
    el.querySelectorAll(".otile").forEach((b) => { b.onclick = () => open(tiles.find((t) => t.id === b.dataset.tile)); });

    const s = el.querySelector("#sample");
    if (s) s.onclick = async () => {
      await VG.store.reset();
      await VG.sample.generate({ id: "sample" });
      VG.ui.flash("Sample data loaded");
      VG.app.refresh();
    };
    const r = el.querySelector("#reset");
    if (r) r.onclick = async () => {
      if (!(await VG.ui.confirm("Delete all test data and start again?", "Clear all data", true))) return;
      await VG.store.reset();
      VG.ui.flash("Cleared");
      VG.app.refresh();
    };
  };

  // 6. One intervention: progress graph for each KPI, milestones, and the quarterly reports.
  //    params: { no } (intervention number) or { id } (a step id, from older links); { q } quarter.
  VG.views.ivDetail = async (el, params) => {
    const user = VG.auth.user();
    const L = VG.logic;
    const [steps, reports, schemes] = await Promise.all([VG.store.listSteps(), VG.store.allReports(), VG.store.listSchemes()]);
    const no = params.no || (steps.find((s) => s.id === params.id) || {}).ivNo;
    let units = L.ivUnits(steps, no);
    if (user.role === "officer") units = units.filter((u) => u.office === user.office);
    if (!units.length) throw new Error("Intervention not found. Go back and choose one.");
    const per = params.q || L.latestQuarterWithData(reports);
    const q = L.periodQ(per);
    const year = L.qYearKey(q);
    const first = units[0];
    const rows = units.flatMap((u) => L.kpiRows(u.kpis, reports, q));
    const num = rows.filter((r) => !r.milestones);
    const ms = rows.filter((r) => r.milestones);
    const c = L.count(rows);
    const nextMs = ms.flatMap((r) => r.milestones.filter((m) => m.state !== "done")).sort((a, b) => (a.due > b.due ? 1 : -1))[0];
    const offices = [...new Set(units.map((u) => u.office))];
    const officer = user.role === "officer";
    const back = officer ? VG.ui.link("my", { q }) : offices.length === 1 ? VG.ui.link("office", { id: offices[0], q: per }) : VG.ui.link("overview", { q: per });
    const backLabel = officer ? "My interventions" : offices.length === 1 ? VG.ui.officeShort(offices[0]) : "Dashboard";
    const end = L.qEndMonth(q);
    const dash = '<span class="muted">–</span>';

    const editLink = (r) => user.role === "admin" ? ` · <a ${VG.ui.link("step-edit", { id: r.step.id })}>Edit targets</a>` : "";
    const card = (r) => {
      const qv = L.quarterValues(reports, r.item, q).map((v, j) => (j < Number(q.slice(-1)) ? v : null));
      return `<div class="kcard"><div class="meta"><h3>${esc(r.kpi.text)}</h3>${VG.ui.kpiChip(r.status)}</div>
        ${VG.ui.kpiTags(r.kpi)}${offices.length > 1 ? `<span class="office-line">${VG.ui.swatch(r.unit.office)}${esc(VG.ui.officeShort(r.unit.office))}</span>` : ""}
        ${VG.charts.kpiChart(r.kpi, year, qv)}
        <div class="meta"><span class="muted">${L.qFy(q)}: <b>${r.actual != null ? VG.ui.fmtNum(r.actual) : "–"}</b> of ${esc(r.targetText || "–")} ${L.periodKind(per) === "past" ? "for the year" : "by end of Q" + q.slice(-1)}</span>
          <span class="muted">Target 29-30: <b>${esc((r.kpi.targets || {})["2030"] || "–")}</b>${editLink(r)}</span></div></div>`;
    };
    const msCard = (r) => `<div class="kcard"><div class="meta"><h3>${esc(r.kpi.text)}</h3>${VG.ui.kpiChip(r.status === "none" ? "none" : r.status)}</div>
      ${VG.ui.kpiTags(r.kpi)}${user.role === "admin" ? `<a class="small" ${VG.ui.link("step-edit", { id: r.step.id })}>Edit targets</a>` : ""}<ul class="mlist">${r.milestones.map((m) => `<li class="${m.state}"><span>${m.state === "done" ? "✓ " : ""}${esc(m.label)}</span>
        <b>${m.state === "done" ? "Done " + esc(L.qShort(m.doneIn)) : "Due " + esc(m.due) + (m.state === "overdue" ? " · overdue" : "")}</b></li>`).join("")}</ul></div>`;

    const qrows = L.quarters().slice().reverse().flatMap((p) => units.map((u) => ({ p, u, r: L.report(reports, u.id, p) })))
      .filter((x) => x.r).reverse();

    el.innerHTML = `<div class="page">
      <a class="back" ${back}>${esc(backLabel)}</a>
      <div class="head"><div class="ohead">${VG.logos.mark(offices.length === 1 ? offices[0] : "SECRETARY", 56)}<div>
        <span class="eyebrow">${esc(offices.map((o) => VG.ui.office(o)).join(" · "))} · Intervention ${first.ivNo} · ${esc(first.ivCode)}</span>
        <h1 class="step-title">${esc(first.ivDesc)}</h1></div></div>
        ${user.role === "officer" ? VG.ui.quarterOptions(q) : VG.ui.periodOptions(per)}</div>

      <div class="tiles five">
        ${VG.ui.tile("KPIs", rows.length, `${num.length} number${num.length === 1 ? "" : "s"}${ms.length ? `, ${ms.length} milestone task${ms.length === 1 ? "" : "s"}` : ""}`)}
        ${VG.ui.tile("Achieved", c.achieved, "for " + L.qFy(q))}
        ${VG.ui.tile("On track", c.ontrack, "in step with the year")}
        ${VG.ui.tile("Behind", c.behind, c.behind ? "Needs attention" : "", "", c.behind ? "hot" : "")}
        ${VG.ui.tile("Next milestone", nextMs ? esc(nextMs.due) : "–", nextMs ? esc(nextMs.label) : (ms.length ? "All done" : "None"), "", "tile-text")}
      </div>

      ${num.length ? `<div class="card"><div class="card-head"><h2>Progress by KPI · achieved vs target</h2>${VG.charts.kpiChartLegend()}</div>
        <div class="kgrid">${num.map(card).join("")}</div></div>` : ""}
      ${ms.length ? `<div class="card"><div class="card-head"><h2>Milestone tasks</h2></div><div class="kgrid">${ms.map(msCard).join("")}</div></div>` : ""}

      <div class="card flush"><div class="card-head"><h2>Quarterly reports</h2><span class="muted small">Held up with, and finance (₹ lakh)</span></div>
        <div class="table-wrap"><table class="mreports"><thead><tr><th>Quarter</th>${offices.length > 1 ? "<th>Office</th>" : ""}<th>Held up with</th><th>Expected to move by</th><th>Scheme</th><th class="num">Sanctioned</th><th class="num">Spent</th></tr></thead><tbody>
        ${qrows.map((x) => { const sc = schemes.find((s) => s.id === x.r.schemeId);
          return `<tr><td class="nw">${esc(L.qLabel(x.p))}</td>${offices.length > 1 ? `<td>${esc(VG.ui.officeShort(x.u.office))}</td>` : ""}
          <td>${L.isHeldUp(x.r) ? VG.ui.chip(x.r.heldUp, "warn") : dash}</td><td class="nw">${x.r.moveBy ? VG.ui.month(x.r.moveBy) : dash}</td>
          <td class="small">${sc ? esc(sc.name) : dash}</td><td class="num">${x.r.sanctioned !== "" && x.r.sanctioned != null ? VG.ui.lakh(x.r.sanctioned) : dash}</td>
          <td class="num">${x.r.spent !== "" && x.r.spent != null ? VG.ui.lakh(x.r.spent) : dash}</td></tr>`; }).join("")
          || `<tr><td colspan="7" class="muted">No quarterly reports yet.</td></tr>`}
        </tbody></table></div></div>
    </div>`;
    el.querySelector("#q").onchange = (e) => VG.app.go("iv", { no, q: e.target.value });
  };
})();
