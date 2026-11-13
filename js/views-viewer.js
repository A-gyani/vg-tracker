// Dashboard (Secretary and admin) and one office's page.
(function () {
  const VG = window.VG;
  const { esc } = VG.ui;
  const C = () => VG.charts;

  async function load() {
    const [steps, reports, quarterly, subs] = await Promise.all([
      VG.store.listSteps(), VG.store.allReports(), VG.store.allQuarterly(), VG.store.allSubmissions()]);
    return { steps, reports, quarterly, subs };
  }

  function trendChart(a) {
    return C().columns(a.trend.map((t) => ({
      label: VG.ui.monthShort(t.month), value: t.moved, hi: t.month === a.month,
      tip: `${VG.ui.month(t.month)}\n${t.moved} steps moved\n${t.reported} of ${a.total.total} reported`,
    })), { height: 200 });
  }

  function stageStrip(stages, ladder, title) {
    const total = stages.reduce((x, y) => x + y, 0);
    return `<div class="form" style="gap:10px"><div class="card-head"><h3>${title}</h3><span class="muted small">${total} steps</span></div>
      ${C().strip(ladder, stages)}</div>`;
  }

  const SHORT = 90; // characters of step text shown in the Needs attention table
  const TOP = 10;   // rows shown in Needs attention before "Show all"

  // 4. Dashboard
  VG.views.overview = async (el, params) => {
    const d = await load();
    const month = params.m || VG.logic.latestMonthWithData(d.reports);
    const a = VG.logic.analytics(month, d.steps, d.reports, d.quarterly, d.subs);
    const T = a.total;
    const prevA = VG.logic.analytics(VG.logic.addMonths(month, -1), d.steps, d.reports, d.quarterly, d.subs).total;
    const delta = (now, before, goodUp) => {
      const diff = now - before;
      if (!before && !now) return "";
      if (diff === 0) return "Same as last month";
      const up = diff > 0;
      return `<span style="color:${up === goodUp ? "var(--good-ink)" : "var(--crit-ink)"}">${up ? "▲" : "▼"} ${Math.abs(diff)}</span> vs last month`;
    };
    const submitted = a.offices.filter((o) => o.submitted).length;

    // stuck list
    const active = d.steps.filter((s) => s.active !== false);
    const attention = active.map((s) => {
      const eff = VG.logic.effective(d.reports, s.id, month);
      return { s, eff, n: VG.logic.monthsNotMoved(d.reports, s.id, month), held: VG.logic.isHeldUp(eff), overdue: VG.logic.isOverdue(s, eff, month) };
    }).filter((x) => x.held || x.n >= 3 || x.overdue).sort((x, y) => (y.n - x.n) || (y.held - x.held));

    const heldRows = Object.entries(a.heldBy).sort((x, y) => y[1] - x[1]);
    const fin = a.offices.filter((o) => o.sanctioned);
    const short = (t) => t.length > SHORT ? t.slice(0, SHORT - 2).trimEnd() + "…" : t;

    el.innerHTML = `<div class="page">
      <div class="head">
        <div><span class="eyebrow">Viksit Gujarat action steps · ${a.quarter}</span><h1>Dashboard · ${VG.ui.month(month)}</h1></div>
        ${VG.ui.monthOptions(month)}
      </div>

      <div class="tiles five">
        <div class="tile ring-tile">${C().ring(T.total ? T.reported / T.total : 0, 54)}
          <div style="display:flex;flex-direction:column;gap:2px"><span class="label">Steps reported</span><b class="num">${T.reported} of ${T.total}</b>
          <span class="sub">${submitted} of ${a.offices.length} offices submitted</span></div></div>
        ${VG.ui.tile("Moved this month", T.moved, delta(T.moved, prevA.moved, true))}
        ${VG.ui.tile("Held up", T.held, delta(T.held, prevA.held, false), "", T.held ? "hot" : "")}
        ${VG.ui.tile("KPIs achieved or on track", `${T.kpi.achieved + T.kpi.ontrack}<small>of ${T.kpi.total - T.kpi.none}</small>`, T.kpi.behind ? VG.ui.chip(T.kpi.behind + " behind", "serious") : "")}
        ${VG.ui.tile("Funds spent", T.sanctioned ? VG.ui.pct(T.spent, T.sanctioned) : 0, `${VG.ui.lakh(T.spent)} of ${VG.ui.lakh(T.sanctioned)}`, "%")}
      </div>

      <div class="grid g-wide">
        <div class="card"><div class="card-head"><h2>Steps moved each month</h2><span class="muted small">Position or expected date changed</span></div>
          ${trendChart(a)}</div>
        <div class="card"><div class="card-head"><h2>Held up with</h2><span class="muted small">${T.held} steps</span></div>
          ${heldRows.length ? C().hbars(heldRows.map(([k, v]) => ({ label: k, value: v, color: "var(--serious)", tip: `${k}\n${v} steps` })), { stacked: true }) : '<p class="muted">Nothing held up.</p>'}</div>
      </div>

      <div class="card">
        <div class="card-head"><h2>KPI achievement · ${VG.logic.fyLabel(month)}</h2><a class="small" ${VG.ui.link("kpis", { m: month })}>All KPIs, targets and actuals →</a></div>
        ${VG.views._kpiLegend()}
        <div class="hbars">${a.offices.map((o) => `
          <a class="hbar" ${VG.ui.link("kpis", { m: month, office: o.id })} style="color:inherit;text-decoration:none"
             data-tip="${esc(`${o.name}\n${o.kpi.achieved} achieved · ${o.kpi.ontrack} on track\n${o.kpi.behind} behind · ${o.kpi.unreported} not reported`)}">
            <span class="lab">${VG.ui.swatch(o.id)} ${esc(o.short)}</span>${VG.views._kpiMix(o.kpi)}<span class="val">${o.kpi.total - o.kpi.none}</span></a>`).join("")}</div>
      </div>

      <div class="form" style="gap:12px">
        <div class="card-head"><h2>Offices</h2><span class="muted small">Bar shows average progress along each step's stages</span></div>
        <div class="offices five">${a.offices.map((o) => `
          <a class="ocard" ${VG.ui.link("office", { id: o.id, m: month })} data-tip="${esc(o.name)}">
            <span class="oname">${VG.logos.mark(o.id, 40)}<span>${esc(o.short)}</span></span>
            <div class="ostats">
              <div><b>${o.reported}/${o.total}</b><span>Reported</span></div>
              <div><b>${o.moved}</b><span>Moved</span></div>
              <div><b>${o.held}</b><span>Held up</span></div>
            </div>
            <div class="meter"><span>Progress ${Math.round(o.progress * 100)}%</span><div class="bar"><span style="width:${o.progress * 100}%;background:var(--o-${o.id})"></span></div></div>
            <div class="chips">${o.submitted ? VG.ui.chip("Submitted", "good") : o.reported ? VG.ui.chip("In progress", "warn") : VG.ui.chip("Not started", "muted")}
              ${o.stuck ? VG.ui.chip(o.stuck + " stuck", "serious") : ""}</div>
          </a>`).join("")}</div>
      </div>

      <div class="grid g2">
        <div class="card"><div class="card-head"><h2>Where the steps are</h2>${a.unreported ? `<span class="muted small">${a.unreported} not reported</span>` : ""}</div>
          ${stageStrip(a.stages.new, VG.config.ladders.new, "New schemes")}
          ${stageStrip(a.stages.ongoing, VG.config.ladders.ongoing, "Ongoing")}
        </div>
        <div class="card"><div class="card-head"><h2>Finance · ${a.quarter}</h2><span class="muted small">Spent as share of sanctioned</span></div>
          ${fin.length ? C().hbars(fin.map((o) => ({ label: o.short, note: `${VG.ui.lakh(o.spent)} of ${VG.ui.lakh(o.sanctioned)}`,
              value: VG.ui.pct(o.spent, o.sanctioned), valueText: VG.ui.pct(o.spent, o.sanctioned) + "%", color: `var(--o-${o.id})`,
              tip: `${o.name}\nSanctioned ${VG.ui.lakh(o.sanctioned)}\nSpent ${VG.ui.lakh(o.spent)} (${VG.ui.pct(o.spent, o.sanctioned)}%)` })), { max: 100, stacked: true })
            : '<p class="muted">No finance entered for this quarter.</p>'}
        </div>
      </div>

      <div class="card flush">
        <div class="card-head"><h2>Needs attention</h2>
          <span class="chips">${T.stuck ? VG.ui.chip(`${T.stuck} with no change for 3+ months`, "serious") : ""}<span class="muted small">Held up, overdue, or no change for 3+ months</span></span></div>
        ${attention.length ? `<div class="table-wrap"><table id="attn"><thead><tr><th>Step</th><th>Action step</th><th>Office</th><th>Position</th><th>Issue</th></tr></thead><tbody>
          ${attention.map((x, i) => `<tr${i >= TOP ? ' class="more" hidden' : ""}>
            <td><a class="id" ${VG.ui.link("step", { id: x.s.id })}>${esc(x.s.id)}</a></td>
            <td class="title"${x.s.title.length > SHORT ? ` data-tip="${esc(x.s.title)}"` : ""}>${esc(short(x.s.title))}</td>
            <td><span class="small" style="display:inline-flex;gap:6px;align-items:center">${VG.ui.swatch(x.s.office)}${esc(VG.ui.officeShort(x.s.office))}</span></td>
            <td>${VG.ui.stage(x.s, x.eff)}</td>
            <td><div class="chips">${x.held ? VG.ui.chip(x.eff.heldUp, "warn") : ""}${x.overdue ? VG.ui.chip("Overdue", "crit") : ""}${VG.ui.stuckChip(x.n)}</div></td>
          </tr>`).join("")}</tbody></table></div>
          ${attention.length > TOP ? `<div class="more-row"><button type="button" class="secondary" id="attn-all">Show all ${attention.length}</button></div>` : ""}`
          : '<p class="muted" style="padding:0 20px 16px">Nothing needs attention.</p>'}
      </div>
    </div>`;

    el.querySelector("#month").onchange = (e) => VG.app.go("overview", { m: e.target.value });
    const all = el.querySelector("#attn-all");
    if (all) all.onclick = () => {
      const open = all.dataset.open !== "1";
      el.querySelectorAll("#attn tr.more").forEach((r) => { r.hidden = !open; });
      all.dataset.open = open ? "1" : "";
      all.textContent = open ? `Show top ${TOP} only` : `Show all ${attention.length}`;
    };
  };


  const KSTAT = [
    ["achieved", "Achieved", "var(--good)"],
    ["ontrack", "On track", "var(--ontrack, var(--accent))"],
    ["behind", "Behind", "var(--serious)"],
    ["unreported", "Not reported", "var(--line)"],
  ];
  function kpiMix(k) {
    return C().segmented(KSTAT.map(([key, label, color]) => ({ value: k[key], color, label })));
  }
  function kpiLegend() {
    return `<div class="legend">${KSTAT.map(([, label, color]) => `<span><span class="swatch" style="background:${color}"></span>${label}</span>`).join("")}</div>`;
  }
  VG.views._kpiMix = kpiMix;
  VG.views._kpiLegend = kpiLegend;

  // KPIs: target vs actual for every step
  const KTOP = 20;  // table rows shown before "Show all"
  const KWORST = 5; // furthest-behind rows tinted pink

  VG.views.kpis = async (el, params) => {
    const d = await load();
    const month = params.m || VG.logic.latestMonthWithData(d.reports);
    const office = params.office || "";
    const show = params.show || "all";
    const active = d.steps.filter((s) => s.active !== false && (!office || s.office === office));
    const rows = active.flatMap((s) => VG.logic.kpiRows(s, d.reports, month));
    const withTarget = rows.filter((r) => r.status !== "none");
    const count = (st) => rows.filter((r) => r.status === st).length;
    const list = rows.filter((r) => show === "all" ? r.status !== "none" : r.status === show)
      .sort((a, b) => (a.pct ?? 9) - (b.pct ?? 9));
    const a = VG.logic.analytics(month, d.steps, d.reports, d.quarterly, d.subs);
    const short = (t, n) => t.length > n ? t.slice(0, n - 2).trimEnd() + "…" : t;
    let worstLeft = KWORST;
    const isWorst = (r) => r.status === "behind" && worstLeft-- > 0;

    // Figure tiles double as filters; the chosen one is ringed.
    const ftile = (key, label, value, sub, cls) =>
      `<a class="tile ftile${show === key ? " on" : ""}${cls ? " " + cls : ""}" ${VG.ui.link("kpis", { m: month, office, show: key })}
         aria-pressed="${show === key}"><span class="label">${esc(label)}</span><span class="value num">${value}</span>${sub ? `<span class="sub">${sub}</span>` : ""}</a>`;

    el.innerHTML = `<div class="page">
      <div class="head">
        <div><span class="eyebrow">${VG.logic.fyLabel(month)} · targets from the VG roadmap booklet</span><h1>KPIs · target and actual</h1></div>
        ${VG.ui.monthOptions(month)}
      </div>

      <div class="tiles five">
        ${ftile("all", "KPIs with a target this year", withTarget.length, "Show all")}
        ${ftile("achieved", "Achieved", count("achieved"), VG.ui.chip(VG.ui.pct(count("achieved"), withTarget.length) + "%", "good"))}
        ${ftile("ontrack", "On track", count("ontrack"), "In step with the year so far")}
        ${ftile("behind", "Behind", count("behind"), count("behind") ? VG.ui.chip("Needs attention", "serious") : "", count("behind") ? "hot" : "")}
        ${ftile("unreported", "Not reported", count("unreported"))}
      </div>

      <div class="card">
        <div class="card-head"><h2>By office</h2>${kpiLegend()}</div>
        <div class="hbars">${a.offices.map((o) => `
          <a class="hbar" ${VG.ui.link("kpis", { m: month, office: o.id, show })} style="color:inherit;text-decoration:none"
             data-tip="${esc(`${o.name}\n${o.kpi.achieved} achieved · ${o.kpi.ontrack} on track\n${o.kpi.behind} behind · ${o.kpi.unreported} not reported`)}">
            <span class="lab">${VG.ui.swatch(o.id)} ${esc(o.short)}</span>
            ${kpiMix(o.kpi)}
            <span class="val">${o.kpi.total - o.kpi.none}</span>
          </a>`).join("")}</div>
        <p class="muted small" style="margin:0">Achieved: actual has reached the year's target. On track: actual is at least 90% of where the year should be by now. Behind: below that.</p>
      </div>

      <div class="filters">
        <select id="office" aria-label="Office">${VG.ui.officeOptions(office, "All offices")}</select>
        <a class="small${show === "none" ? " on-link" : ""}" ${VG.ui.link("kpis", { m: month, office, show: "none" })}>No target this year · ${count("none")}</a>
        <button type="button" class="secondary" id="export" style="margin-left:auto">Export</button>
      </div>

      <div class="card flush">
        <div class="card-head"><h2>${{ all: "All KPIs", achieved: "Achieved", ontrack: "On track", behind: "Behind", unreported: "Not reported", none: "No target this year" }[show] || "KPIs"}${office ? " · " + esc(VG.ui.officeShort(office)) : ""}</h2>
          <span class="muted small">${list.length} KPIs, furthest behind first${list.some((r) => r.status === "behind") ? ' · <span class="worst-key"></span> the ' + KWORST + " furthest behind" : ""}</span></div>
        <div class="table-wrap"><table class="kpilist" id="klist">
        <colgroup><col style="width:84px"><col><col style="width:130px"><col style="width:130px"><col style="width:200px"></colgroup>
        <thead><tr><th>Step</th><th>KPI</th><th>Office</th><th class="num">Actual / Target ${VG.logic.fyLabel(month).replace("FY ", "")}</th><th>Progress</th></tr></thead>
        <tbody>${list.map((r, i) => `<tr class="${isWorst(r) ? "worst" : ""}${i >= KTOP ? " more" : ""}"${i >= KTOP ? " hidden" : ""}>
          <td><a class="id" ${VG.ui.link("step", { id: r.step.id })}>${esc(r.step.id)}</a></td>
          <td class="kt">${esc(r.kpi.text)}<span class="sub" data-tip="${esc(r.step.title)}">${esc(short(r.step.title, 80))}</span></td>
          <td><span class="small" style="display:inline-flex;gap:6px;align-items:center">${VG.ui.swatch(r.step.office)}${esc(VG.ui.officeShort(r.step.office))}</span></td>
          <td class="num"><b>${VG.ui.fmtNum(r.actual) || "–"}</b> <span class="muted">/ ${r.target != null ? VG.ui.fmtNum(r.target) : esc(r.targetText || "–")}</span></td>
          <td><div class="kprog">${VG.ui.kpiBar(r, month)}${VG.ui.kpiChip(r.status)}</div></td></tr>`).join("") || `<tr><td colspan="5" class="muted">No KPIs here.</td></tr>`}</tbody>
        </table></div>
        ${list.length > KTOP ? `<div class="more-row"><button type="button" class="secondary" id="klist-all">Show all ${list.length}</button></div>` : ""}
      </div>
    </div>`;

    el.querySelector("#month").onchange = (e) => VG.app.go("kpis", { m: e.target.value, office, show });
    el.querySelector("#office").onchange = (e) => VG.app.go("kpis", { m: month, office: e.target.value, show });
    const all = el.querySelector("#klist-all");
    if (all) all.onclick = () => {
      const open = all.dataset.open !== "1";
      el.querySelectorAll("#klist tr.more").forEach((r) => { r.hidden = !open; });
      all.dataset.open = open ? "1" : "";
      all.textContent = open ? `Show first ${KTOP} only` : `Show all ${list.length}`;
    };
    el.querySelector("#export").onclick = () => {
      const head = ["Month", "Step ID", "Office", "Step", "KPI", "Target " + VG.logic.fyLabel(month).replace("FY ", ""), "Actual", "% of target", "Status"];
      const label = { achieved: "Achieved", ontrack: "On track", behind: "Behind", unreported: "Not reported", none: "No target this year" };
      const out = rows.map((r) => [month, r.step.id, r.step.office, r.step.title, r.kpi.text, r.targetText, r.actual ?? "",
        r.pct == null ? "" : Math.round(r.pct * 100), label[r.status]]);
      const csv = [head, ...out].map((x) => x.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
      VG.ui.exportText(`vg-kpis-${month}.csv`, csv);
    };
  };

  // 5. One office
  VG.views.office = async (el, params) => {
    const d = await load();
    const office = params.id || VG.config.offices[0].id;
    const month = params.m || VG.logic.latestMonthWithData(d.reports);
    const a = VG.logic.analytics(month, d.steps, d.reports, d.quarterly, d.subs);
    const o = a.offices.find((x) => x.id === office);
    const list = d.steps.filter((s) => s.office === office && s.active !== false);

    const trend = a.trend.map((t) => {
      let rep = 0, mv = 0;
      list.forEach((s) => { if (VG.logic.report(d.reports, s.id, t.month)) rep++; if (VG.logic.moved(d.reports, s.id, t.month) === true) mv++; });
      return { label: VG.ui.monthShort(t.month), value: mv, hi: t.month === month, tip: `${VG.ui.month(t.month)}\n${mv} moved\n${rep} of ${list.length} reported` };
    });

    // Steps that need attention (held up, overdue, or no change for 3+ months) come first.
    const rows = list.map((s, i) => {
      const r = VG.logic.effective(d.reports, s.id, month);
      const n = VG.logic.monthsNotMoved(d.reports, s.id, month);
      const held = VG.logic.isHeldUp(r), overdue = VG.logic.isOverdue(s, r, month);
      return { s, r, n, held, overdue, saved: VG.logic.report(d.reports, s.id, month), needs: held || overdue || n >= 3, i };
    }).sort((x, y) => (y.needs - x.needs) || (x.needs ? y.n - x.n : 0) || (x.i - y.i));
    const needCount = rows.filter((x) => x.needs).length;
    const SHORT = 90;
    const short = (t) => t.length > SHORT ? t.slice(0, SHORT - 2).trimEnd() + "…" : t;
    const dash = '<span class="muted">–</span>';
    const kchip = (show, text, kind) => `<a class="chip-link" ${VG.ui.link("kpis", { m: month, office, show })}>${VG.ui.chip(text, kind)}</a>`;

    el.innerHTML = `<div class="page">
      <a class="back" ${VG.ui.link("overview", { m: month })}>Dashboard</a>
      <div class="head">
        <div class="ohead">${VG.logos.mark(office, 56)}<div><span class="eyebrow">Office</span><h1>${esc(VG.ui.office(office))}</h1></div></div>
        ${VG.ui.monthOptions(month)}
      </div>
      <div class="tiles five">
        ${VG.ui.tile("Reported", `${o.reported}<small>of ${o.total}</small>`, o.submitted ? VG.ui.chip("Submitted", "good") : VG.ui.chip("Not submitted", "muted"))}
        ${VG.ui.tile("Moved", o.moved)}
        ${VG.ui.tile("Held up", o.held, "", "", o.held ? "hot" : "")}
        ${VG.ui.tile("Overdue", o.overdue)}
        ${VG.ui.tile("Funds spent", o.sanctioned ? VG.ui.pct(o.spent, o.sanctioned) : 0, `${VG.ui.lakh(o.spent)} of ${VG.ui.lakh(o.sanctioned)}`, "%")}
      </div>
      <div class="card"><div class="card-head"><h2>Steps moved each month</h2><span class="muted small">Position or expected date changed</span></div>${C().columns(trend, { height: 150 })}</div>
      <div class="card"><div class="card-head"><h2>KPI achievement · ${VG.logic.fyLabel(month)}</h2><a class="small" ${VG.ui.link("kpis", { m: month, office })}>Targets and actuals →</a></div>
        ${VG.views._kpiLegend()}${VG.views._kpiMix(o.kpi)}
        <div class="chips">${kchip("achieved", o.kpi.achieved + " achieved", "good")}${kchip("ontrack", o.kpi.ontrack + " on track", "accent")}${kchip("behind", o.kpi.behind + " behind", "serious")}${kchip("unreported", o.kpi.unreported + " not reported", "muted")}</div></div>
      <div class="card flush"><div class="card-head"><h2>Steps</h2><span class="muted small">${list.length} steps${needCount ? ` · ${needCount} needing attention shown first` : ""}</span></div>
        <div class="table-wrap"><table class="osteps"><colgroup><col style="width:76px"><col><col style="width:185px"><col style="width:140px"><col style="width:112px"><col style="width:178px"></colgroup>
        <thead><tr><th>Step</th><th>Action step</th><th>Position</th><th>Held up with</th><th>Next stage by</th><th>This month</th></tr></thead><tbody>
        ${rows.map((x) => `<tr class="${x.saved ? "" : "pending"}"><td><a class="id" ${VG.ui.link("step", { id: x.s.id })}>${esc(x.s.id)}</a></td>
            <td class="ot"${x.s.title.length > SHORT ? ` data-tip="${esc(x.s.title)}"` : ""}>${esc(short(x.s.title))}</td>
            <td>${VG.ui.stage(x.s, x.r)}</td>
            <td>${x.held ? VG.ui.chip(x.r.heldUp, "warn") : dash}</td>
            <td class="small">${x.r && x.r.nextBy ? VG.ui.month(x.r.nextBy) : dash} ${x.overdue ? VG.ui.chip("Overdue", "crit") : ""}</td>
            <td><div class="chips">${VG.ui.movedChip(VG.logic.moved(d.reports, x.s.id, month))}${VG.ui.stuckChip(x.n)}</div></td></tr>`).join("")}</tbody></table></div></div>
    </div>`;

    el.querySelector("#month").onchange = (e) => VG.app.go("office", { id: office, m: e.target.value });
  };
})();
