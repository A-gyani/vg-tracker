// Screens used by more than one role: sign-in and step detail.
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
    { id: "ADMIN", title: "Admin", sub: "Steps, users, schemes and submissions", role: "admin" },
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
          <p class="muted small">Sample data fills April to last month with made-up reports so the dashboards can be tried. The current month stays empty for you to fill.${sample ? " Sample data is loaded." : ""}</p>
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

  // 6. Step detail
  VG.views.stepDetail = async (el, params) => {
    const user = VG.auth.user();
    const step = await VG.store.getStep(params.id);
    if (!step) throw new Error("Step not found. Go back and choose a step.");
    if (user.role === "officer" && step.office !== user.office) throw new Error("This step belongs to another office.");

    const [reports, quarterly, schemes] = await Promise.all([VG.store.allReports(), VG.store.allQuarterly(), VG.store.listSchemes()]);
    const months = VG.logic.months();
    const now = VG.logic.latestMonthWithData(reports);
    const eff = VG.logic.effective(reports, step.id, now);
    const ladder = VG.logic.ladder(step);
    const notMoved = VG.logic.monthsNotMoved(reports, step.id, now);
    const held = eff && VG.logic.isHeldUp(eff);
    const stageNo = eff ? ladder.indexOf(eff.position) : -1;
    const dash = '<span class="muted">–</span>';

    const asc = months.slice().reverse();
    const points = asc.map((m) => {
      const r = VG.logic.report(reports, step.id, m);
      const i = r ? ladder.indexOf(r.position) : -1;
      return { label: VG.ui.monthShort(m), index: i >= 0 ? i : null, tip: r ? `${VG.ui.month(m)}: ${r.position}` : "" };
    });

    const rows = months.map((m) => {
      const r = VG.logic.report(reports, step.id, m);
      return r ? `<tr><td class="nw">${VG.ui.month(m)}</td><td><span class="pos">${VG.ui.dots(step, r.position)}<span>${esc(r.position)}</span></span></td>
        <td>${VG.logic.isHeldUp(r) ? VG.ui.chip(r.heldUp, "warn") : dash}</td>
        <td class="nw">${r.nextBy ? VG.ui.month(r.nextBy) : dash}</td><td>${VG.ui.movedChip(VG.logic.moved(reports, step.id, m))}</td></tr>`
        : `<tr class="pending"><td class="nw">${VG.ui.month(m)}</td><td colspan="4" class="small muted">Not reported</td></tr>`;
    }).join("");

    const quarters = [...new Set(asc.map((m) => VG.logic.quarter(m)))];
    const fin = quarters.map((q) => ({ q, r: quarterly[q + "|" + step.id] })).filter((x) => x.r);
    const lastFin = fin.length ? fin[fin.length - 1].r : null;
    const sc = lastFin ? schemes.find((s) => s.id === lastFin.schemeId) : null;

    const officer = user.role === "officer";
    const back = officer ? VG.ui.link("my") : VG.ui.link("office", { id: step.office });
    const backLabel = officer ? "My steps" : VG.ui.officeShort(step.office);
    el.innerHTML = `<div class="page">
      <a class="back" ${back}>${esc(backLabel)}</a>
      <div class="head"><div class="ohead">${VG.logos.mark(step.office, 56)}<div>
        <span class="eyebrow">${esc(VG.ui.office(step.office))} · Intervention ${esc(step.ivNo)} · ${esc(step.ivCode)}</span>
        <span class="step-pill">${esc(step.id)}</span>
        <h1 class="step-title">${esc(step.title)}</h1>
      </div></div></div>

      <div class="tiles">
        ${VG.ui.tile("Current stage", eff ? esc(eff.position) : "Not reported", stageNo >= 0 ? `Stage ${stageNo + 1} of ${ladder.length}` : "", "", "tile-text")}
        ${VG.ui.tile("Months without change", notMoved, notMoved >= 3 ? "Needs attention" : "", "", notMoved >= 3 ? "hot" : "")}
        ${VG.ui.tile("Held up with", held ? esc(eff.heldUp) : "None", "", "", "tile-text")}
        ${VG.ui.tile("Next stage expected by", eff && eff.nextBy ? VG.ui.month(eff.nextBy) : "–",
          VG.logic.isOverdue(step, eff, now) ? VG.ui.chip("Overdue", "crit") : "", "", "tile-text")}
      </div>

      <div class="card"><div class="card-head"><h2>KPIs · target and actual</h2><span class="muted small">Actual as of ${VG.ui.month(now)} for ${VG.logic.fyLabel(now)}; highlighted column is this year's target</span></div>
        ${VG.ui.kpiTable(step, VG.logic.kpiRows(step, reports, now), now)}</div>
      <div class="card"><div class="card-head"><h2>Stage by month</h2><span class="muted small">${step.type === "new" ? "New scheme ladder" : "Ongoing ladder"}</span></div>
        ${points.some((p) => p.index != null) ? `<div class="table-wrap">${VG.charts.stepLine(points, ladder)}</div>` : '<p class="muted">No reports yet.</p>'}
      </div>

      <div class="grid">
        <div class="card flush"><div class="card-head"><h2>Monthly reports</h2></div><div class="table-wrap">
          <table class="mreports"><thead><tr><th>Month</th><th>Position</th><th>Held up with</th><th>Next stage by</th><th>Change</th></tr></thead><tbody>${rows}</tbody></table></div></div>
        <div class="card"><div class="card-head"><h2>Finance</h2><span class="muted small">₹ lakh</span></div>
          ${fin.length ? `${sc ? `<div class="fin-scheme"><b>${esc(sc.name)}</b><span class="muted small">Budget head ${esc(sc.budgetHead)}</span></div>` : ""}
            <div class="table-wrap"><table class="fin"><thead><tr><th>Quarter</th><th class="num">Sanctioned</th><th class="num">Spent</th><th class="num">%</th></tr></thead><tbody>
            ${fin.map((x) => { const s = Number(x.r.sanctioned) || 0, p = Number(x.r.spent) || 0;
              return `<tr><td class="nw">${esc(x.q)}</td><td class="num">${VG.ui.lakh(s)}</td><td class="num">${VG.ui.lakh(p)}</td><td class="num"><b>${VG.ui.pct(p, s)}%</b></td></tr>`; }).join("")}
            </tbody></table></div>`
            : '<p class="muted">None entered.</p>'}
        </div>
      </div>

    </div>`;
  };
})();
