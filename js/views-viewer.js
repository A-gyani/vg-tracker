// Dashboard (Secretary and admin), all KPIs, and one office's page. Everything is by quarter.
(function () {
  const VG = window.VG;
  const { esc } = VG.ui;
  const C = () => VG.charts;
  const L = () => VG.logic;
  const TOP = 10;   // rows shown in Needs attention before "Show all"

  async function load() {
    const [steps, reports, subs] = await Promise.all([VG.store.listSteps(), VG.store.allReports(), VG.store.allSubmissions()]);
    return { steps, reports, subs };
  }
  const officeTag = (id) => `<span class="small" style="display:inline-flex;gap:6px;align-items:center">${VG.ui.swatch(id)}${esc(VG.ui.officeShort(id))}</span>`;

  const KSTAT = [
    ["achieved", "Achieved", "var(--good)"],
    ["ontrack", "On track", "var(--ontrack, var(--accent))"],
    ["behind", "Behind", "var(--serious)"],
    ["unreported", "Not reported", "var(--line)"],
  ];
  function kpiMix(k) { return C().segmented(KSTAT.map(([key, label, color]) => ({ value: k[key], color, label }))); }
  function kpiLegend() {
    return `<div class="legend">${KSTAT.map(([, label, color]) => `<span><span class="swatch" style="background:${color}"></span>${label}</span>`).join("")}</div>`;
  }
  VG.views._kpiMix = kpiMix;
  VG.views._kpiLegend = kpiLegend;

  // Units needing attention: KPIs behind, milestones overdue, or held up.
  function attention(a, reports, q, office) {
    return a.units.filter((u) => !office || u.office === office).map((u) => {
      const rows = L().kpiRows(u.kpis, reports, q);
      const c = L().count(rows);
      const over = rows.reduce((n, r) => n + (r.milestones ? r.milestones.filter((m) => m.state === "overdue").length : 0), 0);
      const eff = L().effective(reports, u.id, q);
      return { u, c, over, eff, held: L().isHeldUp(eff), saved: !!L().report(reports, u.id, q) };
    });
  }
  const issueChips = (x) => `<div class="chips">${x.c.behind ? VG.ui.chip(x.c.behind + " KPI" + (x.c.behind === 1 ? "" : "s") + " behind", "serious") : ""}${x.over ? VG.ui.chip(x.over + " milestone" + (x.over === 1 ? "" : "s") + " overdue", "crit") : ""}${x.held ? VG.ui.chip(x.eff.heldUp, "warn") : ""}</div>`;


  // One line under the heading explaining what a whole-year view shows.
  function periodNote(kind, q) {
    if (kind === "ytd") return `<p class="muted small period-note">Year so far: KPI figures as of the latest quarter (${L().qLabel(q)}). Choose a quarter to see just that quarter.</p>`;
    if (kind === "past") return `<p class="muted small period-note">A finished year: achieved figures are the recorded yearly figures. Quarterly reports began in ${L().qFy(L().quarter(VG.config.startMonth))}.</p>`;
    return "";
  }
  // A coming year: targets only.
  function futureYear(el, p, a, route, office) {
    const units = a.units.filter((u) => !office || u.office === office);
    const rows = units.flatMap((u) => L().kpiRows(u.kpis, {}, p + " Q1"));
    const year = L().qYearKey(p + " Q1");
    const prevKey = String(Number(year) - 1);
    const withT = rows.filter((r) => r.status === "future");
    const fresh = withT.filter((r) => !(L().num((r.kpi.targets || {})[prevKey]) > 0));
    const ms = units.flatMap((u) => u.kpis).flatMap((it) => (it.k.milestones || []).filter((m) => m.due.startsWith(p)));
    const perOffice = VG.config.offices.filter((o) => !office || o.id === office).map((o) => ({ o, n: withT.filter((r) => r.unit.office === o.id).length }));
    el.innerHTML = `<div class="page">
      ${office ? `<a class="back" ${VG.ui.link("overview", { q: p })}>Dashboard</a>` : ""}
      <div class="head"><div>${office ? `<div class="ohead">${VG.logos.mark(office, 56)}<div><span class="eyebrow">Office · ${esc(L().periodLabel(p))}</span><h1>${esc(VG.ui.office(office))}</h1></div></div>`
        : `<span class="eyebrow">Viksit Gujarat interventions · FY ${esc(p)}</span><h1>Dashboard · ${esc(L().periodLabel(p))}</h1>`}</div>${VG.ui.periodOptions(p)}</div>
      <p class="muted small period-note">A coming year: targets only. The KPIs page lists every target for ${esc(p)}.</p>
      <div class="tiles">
        ${VG.ui.tile("KPIs with a target", withT.length, `of ${rows.length} KPIs`)}
        ${VG.ui.tile("Starting this year", fresh.length, "no target the year before")}
        ${VG.ui.tile("Milestones due", ms.length, ms.length ? esc(ms[0].label) + (ms.length > 1 ? " and others" : "") : "")}
      </div>
      <div class="card"><div class="card-head"><h2>KPIs with a target, by office</h2><a class="small" ${VG.ui.link("kpis", { q: p, office: office || "" })}>See the targets →</a></div>
        ${C().hbars(perOffice.map((x) => ({ id: x.o.id, label: x.o.short, value: x.n, color: `var(--o-${x.o.id})`, tip: `${x.o.name}\n${x.n} KPIs with a target` })), { swatches: true })}</div>
    </div>`;
    el.querySelector("#q").onchange = (e) => VG.app.go(route, office ? { id: office, q: e.target.value } : { q: e.target.value });
  }

  // 4. Dashboard
  VG.views.overview = async (el, params) => {
    const d = await load();
    const p = params.q || L().latestQuarterWithData(d.reports);
    const kind = L().periodKind(p);
    const q = L().periodQ(p);
    const a = L().analytics(q, d.steps, d.reports, d.subs);
    const T = a.total;
    if (kind === "future") return futureYear(el, p, a, "overview");
    const submitted = a.offices.filter((o) => o.submitted).length;
    const list = attention(a, d.reports, q).filter((x) => x.c.behind || x.over || x.held)
      .sort((x, y) => (y.c.behind + y.over * 2 + y.held) - (x.c.behind + x.over * 2 + x.held));
    const heldRows = Object.entries(a.heldBy).sort((x, y) => y[1] - x[1]);
    const fin = a.offices.filter((o) => o.sanctioned);
    const withTarget = T.kpi.total - T.kpi.none;

    el.innerHTML = `<div class="page">
      <div class="head">
        <div><span class="eyebrow">Viksit Gujarat interventions · FY ${L().qFy(q)}</span><h1>Dashboard · ${L().periodLabel(p)}</h1></div>
        ${VG.ui.periodOptions(p)}
      </div>
      ${periodNote(kind, q)}

      <div class="tiles five">
        ${kind === "past" ? VG.ui.tile("KPIs with a target", T.kpi.total - T.kpi.none, "recorded yearly figures") : `<div class="tile ring-tile">${C().ring(T.units ? T.reported / T.units : 0, 54)}
          <div style="display:flex;flex-direction:column;gap:2px"><span class="label">Intervention reports saved</span><b class="num">${T.reported} of ${T.units}</b>
          <span class="sub">${submitted} of ${a.offices.length} offices submitted${kind === "ytd" ? " · " + L().qLabel(q) : ""}</span></div></div>`}
        ${VG.ui.tile("KPIs achieved or on track", `${T.kpi.achieved + T.kpi.ontrack}<small>of ${withTarget}</small>`, "with something due this year", "", "", VG.ui.link("kpis", { q: p, show: "all" }))}
        ${VG.ui.tile("KPIs behind", T.kpi.behind, T.kpi.behind ? "Needs attention" : "", "", T.kpi.behind ? "hot" : "", VG.ui.link("kpis", { q: p, show: "behind" }))}
        ${VG.ui.tile("Milestones overdue", T.msOverdue, T.msOverdue ? VG.ui.chip("Follow up", "crit") : "None", "", "", VG.ui.link("kpis", { q: p, show: "behind" }))}
        ${VG.ui.tile("Funds spent", T.sanctioned ? VG.ui.pct(T.spent, T.sanctioned) : 0, `${VG.ui.lakh(T.spent)} of ${VG.ui.lakh(T.sanctioned)}`, "%")}
      </div>

      <div class="grid g-wide">
        <div class="card"><div class="card-head"><h2>KPI achievement by office · ${L().periodLabel(p)}</h2><a class="small" ${VG.ui.link("kpis", { q: p })}>All KPIs →</a></div>
          ${kpiLegend()}
          <div class="hbars">${a.offices.map((o) => `
            <a class="hbar" ${VG.ui.link("kpis", { q: p, office: o.id })} style="color:inherit;text-decoration:none"
               data-tip="${esc(`${o.name}\n${o.kpi.achieved} achieved · ${o.kpi.ontrack} on track\n${o.kpi.behind} behind · ${o.kpi.unreported} not reported`)}">
              <span class="lab">${VG.ui.swatch(o.id)} ${esc(o.short)}</span>${kpiMix(o.kpi)}<span class="val">${o.kpi.total - o.kpi.none}</span></a>`).join("")}</div></div>
        <div class="card"><div class="card-head"><h2>Held up with</h2><span class="muted small">${T.held} interventions</span></div>
          ${heldRows.length ? C().hbars(heldRows.map(([k, v]) => ({ label: k, value: v, color: "var(--serious)", tip: `${k}\n${v} interventions` })), { stacked: true }) : '<p class="muted">Nothing held up.</p>'}</div>
      </div>

      <div class="form" style="gap:12px">
        <div class="card-head"><h2>Offices</h2><span class="muted small">Bar: share of KPIs achieved or on track</span></div>
        <div class="offices five">${a.offices.map((o) => {
          const share = o.kpi.total - o.kpi.none ? (o.kpi.achieved + o.kpi.ontrack) / (o.kpi.total - o.kpi.none) : 0;
          return `<a class="ocard" ${VG.ui.link("office", { id: o.id, q: p })} data-tip="${esc(o.name)}">
            <span class="oname">${VG.logos.mark(o.id, 40)}<span>${esc(o.short)}</span></span>
            <div class="ostats"><div><b>${o.reported}/${o.units}</b><span>Reported</span></div><div><b>${o.kpi.behind}</b><span>Behind</span></div><div><b>${o.held}</b><span>Held up</span></div></div>
            <div class="meter"><span>On course ${Math.round(share * 100)}%</span><div class="bar"><span style="width:${share * 100}%;background:var(--o-${o.id})"></span></div></div>
            <div class="chips">${o.submitted ? VG.ui.chip("Submitted", "good") : o.reported ? VG.ui.chip("In progress", "warn") : VG.ui.chip("Not started", "muted")}</div></a>`;
        }).join("")}</div>
      </div>

      ${kind === "past" ? "" : `<div class="grid g2">
        <div class="card"><div class="card-head"><h2>Reports saved each quarter</h2><span class="muted small">of ${T.units} (one per intervention and office)</span></div>
          ${C().columns(a.trend.map((t) => ({ label: L().qShort(t.q), value: t.reported, hi: t.q === q, tip: `${L().qLabel(t.q)}\n${t.reported} of ${T.units} reported` })), { height: 180 })}</div>
        <div class="card"><div class="card-head"><h2>Finance · ${L().qLabel(q)}</h2><span class="muted small">Spent as share of sanctioned</span></div>
          ${fin.length ? C().hbars(fin.map((o) => ({ label: o.short, note: `${VG.ui.lakh(o.spent)} of ${VG.ui.lakh(o.sanctioned)}`,
              value: VG.ui.pct(o.spent, o.sanctioned), valueText: VG.ui.pct(o.spent, o.sanctioned) + "%", color: `var(--o-${o.id})`,
              tip: `${o.name}\nSanctioned ${VG.ui.lakh(o.sanctioned)}\nSpent ${VG.ui.lakh(o.spent)} (${VG.ui.pct(o.spent, o.sanctioned)}%)` })), { max: 100, stacked: true })
            : '<p class="muted">No finance entered yet.</p>'}</div>
      </div>`}

      <div class="card flush">
        <div class="card-head"><h2>Needs attention</h2><span class="muted small">KPIs behind, milestones overdue, or held up</span></div>
        ${list.length ? `<div class="table-wrap"><table id="attn" class="units"><colgroup><col style="width:64px"><col><col style="width:150px"><col style="width:260px"></colgroup>
          <thead><tr><th>No.</th><th>Intervention</th><th>Office</th><th>Issue</th></tr></thead><tbody>
          ${list.map((x, i) => `<tr${i >= TOP ? ' class="more" hidden' : ""}><td><span class="step-pill" style="margin:0">${x.u.ivNo}</span></td>
            <td class="t" data-tip="${esc(x.u.ivDesc)}"><a ${VG.ui.link("iv", { no: x.u.ivNo, q: p })}>${esc(VG.ui.ivShort(x.u.ivDesc))}</a><small>${esc(x.u.ivCode)}</small></td>
            <td>${officeTag(x.u.office)}</td><td>${issueChips(x)}</td></tr>`).join("")}</tbody></table></div>
          ${list.length > TOP ? `<div class="more-row"><button type="button" class="secondary" id="attn-all">Show all ${list.length}</button></div>` : ""}`
          : '<p class="muted" style="padding:0 20px 16px">Nothing needs attention.</p>'}
      </div>
    </div>`;

    el.querySelector("#q").onchange = (e) => VG.app.go("overview", { q: e.target.value });
    const all = el.querySelector("#attn-all");
    if (all) all.onclick = () => {
      const open = all.dataset.open !== "1";
      el.querySelectorAll("#attn tr.more").forEach((r) => { r.hidden = !open; });
      all.dataset.open = open ? "1" : "";
      all.textContent = open ? `Show top ${TOP} only` : `Show all ${list.length}`;
    };
  };

  // KPIs: target vs actual for every KPI, for a quarter, the year so far (Q1–Q4 side by side), a finished year,
  // or a coming year (targets only). "Year at a glance" puts every year from 2022-23 to 2029-30 side by side.
  const KTOP = 20;  // table rows shown before "Show all"
  const KWORST = 5; // furthest-behind rows tinted pink

  VG.views.kpis = async (el, params) => {
    const d = await load();
    const p = params.q || L().latestQuarterWithData(d.reports);
    const kind = L().periodKind(p);
    const q = L().periodQ(p);
    const office = params.office || "";
    const view = params.view || "list";
    const show = params.show || "all";
    const a = L().analytics(q, d.steps, d.reports, d.subs);
    const units = a.units.filter((u) => !office || u.office === office);
    const rows = units.flatMap((u) => L().kpiRows(u.kpis, d.reports, q));
    const future = kind === "future";
    const withTarget = rows.filter((r) => r.status !== "none");
    const count = (st) => rows.filter((r) => r.status === st).length;
    const order = (r) => (r.status === "behind" ? -1 : 0) + (r.pct ?? 9);
    const list = rows.filter((r) => show === "all" ? r.status !== "none" : r.status === show)
      .sort((x, y) => future ? (x.unit.ivNo - y.unit.ivNo) : order(x) - order(y));
    let worstLeft = KWORST;
    const isWorst = (r) => r.status === "behind" && worstLeft-- > 0;
    const end = L().qEndMonth(q);
    const yfy = L().qFy(q).slice(2);
    const year = L().qYearKey(q);
    const go = (extra) => VG.ui.link("kpis", Object.assign({ q: p, office, show, view }, extra));
    const ftile = (key, label, value, sub, cls) =>
      `<a class="tile ftile${show === key ? " on" : ""}${cls ? " " + cls : ""}" ${go({ show: key, view: "list" })}
         aria-pressed="${show === key}"><span class="label">${esc(label)}</span><span class="value num">${value}</span>${sub ? `<span class="sub">${sub}</span>` : ""}</a>`;
    const dash = '<span class="muted">–</span>';

    // For KPIs with nothing due in the chosen year: the first later year with a target (or the next milestone).
    const firstTarget = (r) => {
      if (r.milestones) {
        const m = r.milestones.find((x) => x.state !== "done");
        return m ? `<span class="small first-t">First milestone due<b>${esc(m.due)}</b></span>` : `<span class="small muted">All milestones done</span>`;
      }
      const y = VG.config.targetYears.find((k) => k > year && L().num((r.kpi.targets || {})[k]) > 0);
      return y ? `<span class="small first-t">First target<b>${L().fyKeyLabel(y)}: ${esc(r.kpi.targets[y])}</b></span>` : `<span class="small muted">No target set</span>`;
    };
    // Milestone tasks: how many done, and the next one with its due date.
    const msFig = (r) => {
      const next = r.milestones.find((m) => m.state !== "done");
      return `<span class="small first-t">${r.milestones.filter((m) => m.state === "done").length} of ${r.milestones.length} milestones done${next ? `<b>Next: ${esc(next.label)} · ${esc(next.due)}</b>` : ""}</span>`;
    };
    const fig = (r) => r.status === "none" ? firstTarget(r) : r.milestones ? msFig(r)
      : `<b>${VG.ui.fmtNum(r.actual) || "–"}</b> <span class="muted">/ ${r.target != null ? VG.ui.fmtNum(r.target) : esc(r.targetText || "–")}</span>`;
    // Admin can open the action step's targets from any row.
    const admin = VG.auth.user().role === "admin";
    const editLink = (r) => admin ? `<a class="small" ${VG.ui.link("step-edit", { id: r.step.id })} data-tip="Edit this KPI's targets">Edit targets</a>` : "";
    const kpiCell = (r) => `<td class="kt"><a ${VG.ui.link("iv", { no: r.unit.ivNo, q: p })} style="color:inherit">${esc(r.kpi.text)}</a><span class="sub" data-tip="${esc(r.unit.ivDesc)}">${esc(VG.ui.ivShort(r.unit.ivDesc, 80))}</span></td>`;
    const noCell = (r) => `<td><a class="step-pill" style="margin:0" ${VG.ui.link("iv", { no: r.unit.ivNo, q: p })}>${r.unit.ivNo}</a></td>`;

    // ---- tables ----
    let table, colCount, caption;
    if (view === "years") {
      // every year side by side: achieved over target
      const years = VG.config.targetYears.filter((y) => y >= "2023");
      const nowKey = L().qYearKey(L().thisQuarter());
      const all = units.flatMap((u) => L().kpiRows(u.kpis, d.reports, L().thisQuarter()));
      const cell = (r, y) => {
        const k = r.kpi;
        if (r.milestones) {
          const due = (k.milestones || []).filter((m) => m.due.startsWith(L().fyKeyLabel(y).replace(/^(\d\d)-/, "20$1-")));
          if (!due.length) return dash;
          const done = due.filter((m) => (r.milestones.find((x) => x.label === m.label) || {}).state === "done").length;
          return `<span class="small" data-tip="${esc(due.map((m) => m.label + " (" + m.due + ")").join("\n"))}">${done}/${due.length}<br>milestones</span>`;
        }
        const t = (k.targets || {})[y];
        const tn = L().num(t);
        const ach = y < nowKey ? (k.actuals || {})[y] : y === nowKey ? r.actual : null;
        const cls = ach == null || !tn ? "" : ach >= tn ? "ok" : y < nowKey ? "short" : "";
        if ((t == null || t === "") && ach == null) return dash;
        return `${ach != null ? `<b class="${cls}">${VG.ui.fmtNum(ach)}</b>` : ""}<span class="muted">${ach != null ? "/ " : ""}${esc(t ?? "–")}</span>`;
      };
      colCount = 2 + years.length;
      caption = "Achieved / target for each year. Past years: recorded figures. " + L().qFy(L().thisQuarter()) + ": so far.";
      table = `<table class="kpilist glance" id="klist"><colgroup><col style="width:52px"><col style="width:230px">${years.map(() => '<col style="width:78px">').join("")}</colgroup>
        <thead><tr><th>No.</th><th>KPI</th>${years.map((y) => `<th class="num${y === nowKey ? " now" : ""}">${L().fyKeyLabel(y)}</th>`).join("")}</tr></thead>
        <tbody>${all.map((r, i) => `<tr${i >= KTOP ? ' class="more" hidden' : ""}>${noCell(r)}<td class="kt"><a ${VG.ui.link("iv", { no: r.unit.ivNo, q: p })} style="color:inherit">${esc(r.kpi.text)}</a>
          <span class="sub">${esc(VG.ui.officeShort(r.unit.office))} · ${esc(VG.config.kpiBasis[r.kpi.basis] || "")}</span></td>
          ${years.map((y) => `<td class="num${y === nowKey ? " now" : ""}">${cell(r, y)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      list.length = 0; all.forEach((r) => list.push(r));
    } else if (kind === "ytd") {
      const curQn = Number(q.slice(-1));
      const qcell = (r, j) => {
        if (j >= curQn) return '<span class="muted">·</span>';
        if (r.milestones) {
          const n = r.milestones.filter((m) => m.doneIn === L().fyQuarters(q)[j]).length;
          return n ? `<span class="small">✓ ${n}</span>` : dash;
        }
        const v = L().quarterValues(d.reports, r.item, q)[j];
        return v == null ? dash : VG.ui.fmtNum(v);
      };
      colCount = 9;
      caption = `${list.length} KPIs · figure at the end of each quarter, furthest behind first`;
      table = `<table class="kpilist ytd" id="klist"><colgroup><col style="width:56px"><col><col style="width:110px">${[1, 2, 3, 4].map(() => '<col style="width:70px">').join("")}<col style="width:90px"><col style="width:180px"></colgroup>
        <thead><tr><th>No.</th><th>KPI</th><th>Office</th>${[1, 2, 3, 4].map((n) => `<th class="num${n === curQn ? " now" : ""}">Q${n}</th>`).join("")}<th class="num">Target ${yfy}</th><th>Progress</th></tr></thead>
        <tbody>${list.map((r, i) => `<tr class="${isWorst(r) ? "worst" : ""}${i >= KTOP ? " more" : ""}"${i >= KTOP ? " hidden" : ""}>${noCell(r)}${kpiCell(r)}<td>${officeTag(r.unit.office)}</td>
          ${[0, 1, 2, 3].map((j) => `<td class="num${j === curQn - 1 ? " now" : ""}">${qcell(r, j)}</td>`).join("")}
          <td class="num">${r.status === "none" ? firstTarget(r) : r.milestones ? `<span class="small">${r.milestones.length} milestones</span>` : esc(r.targetText || "–")}</td>
          <td><div class="kprog">${r.milestones || r.status === "none" ? "" : VG.ui.kpiBar(r, end)}${VG.ui.kpiChip(r.status)}${editLink(r)}</div></td></tr>`).join("") || `<tr><td colspan="9" class="muted">No KPIs here.</td></tr>`}</tbody></table>`;
    } else if (future) {
      const prevKey = String(Number(year) - 1);
      colCount = 6;
      caption = `${list.length} KPIs with a target in ${L().qFy(q)}`;
      table = `<table class="kpilist" id="klist"><colgroup><col style="width:56px"><col><col style="width:130px"><col style="width:120px"><col style="width:120px"><col style="width:150px"></colgroup>
        <thead><tr><th>No.</th><th>KPI</th><th>Office</th><th class="num">Target ${yfy}</th><th class="num">Year before</th><th></th></tr></thead>
        <tbody>${list.map((r, i) => `<tr class="${i >= KTOP ? "more" : ""}"${i >= KTOP ? " hidden" : ""}>${noCell(r)}${kpiCell(r)}<td>${officeTag(r.unit.office)}</td>
          <td class="num"><b>${r.status === "none" ? "" : esc(r.targetText)}</b>${r.status === "none" ? firstTarget(r) : ""}</td>
          <td class="num muted">${esc((r.kpi.targets || {})[prevKey] ?? "–")}</td>
          <td><div class="kprog">${r.status === "future" && !(L().num((r.kpi.targets || {})[prevKey]) > 0) ? VG.ui.chip("Starts this year", "accent") : ""}${editLink(r)}</div></td></tr>`).join("") || `<tr><td colspan="6" class="muted">No KPIs here.</td></tr>`}</tbody></table>`;
    } else {
      colCount = 5;
      caption = `${list.length} KPIs, furthest behind first${list.some((r) => r.status === "behind") ? ' · <span class="worst-key"></span> the ' + KWORST + " furthest behind" : ""}`;
      table = `<table class="kpilist" id="klist"><colgroup><col style="width:56px"><col><col style="width:130px"><col style="width:130px"><col style="width:200px"></colgroup>
        <thead><tr><th>No.</th><th>KPI</th><th>Office</th><th class="num">${show === "none" ? "Coming up" : "Actual / Target " + yfy}</th><th>Progress</th></tr></thead>
        <tbody>${list.map((r, i) => `<tr class="${isWorst(r) ? "worst" : ""}${i >= KTOP ? " more" : ""}"${i >= KTOP ? " hidden" : ""}>${noCell(r)}${kpiCell(r)}
          <td>${officeTag(r.unit.office)}</td><td class="num">${fig(r)}</td>
          <td><div class="kprog">${r.milestones ? "" : VG.ui.kpiBar(r, end)}${VG.ui.kpiChip(r.status)}${editLink(r)}</div></td></tr>`).join("") || `<tr><td colspan="5" class="muted">No KPIs here.</td></tr>`}</tbody></table>`;
    }

    const tiles = future
      ? `<div class="tiles">
          ${VG.ui.tile("KPIs with a target", count("future"), `in ${L().qFy(q)}`)}
          ${VG.ui.tile("Starting this year", rows.filter((r) => r.status === "future" && !(L().num((r.kpi.targets || {})[String(Number(year) - 1)]) > 0)).length, "no target the year before")}
          ${VG.ui.tile("No target that year", count("none"))}</div>`
      : `<div class="tiles five">
          ${ftile("all", "KPIs with something due", withTarget.length, "Show all")}
          ${ftile("achieved", "Achieved", count("achieved"), VG.ui.chip(VG.ui.pct(count("achieved"), withTarget.length) + "%", "good"))}
          ${ftile("ontrack", "On track", count("ontrack"), kind === "past" ? "" : "In step with the year so far")}
          ${ftile("behind", "Behind", count("behind"), count("behind") ? VG.ui.chip("Needs attention", "serious") : "", count("behind") ? "hot" : "")}
          ${ftile("unreported", "Not reported", count("unreported"))}</div>`;

    el.innerHTML = `<div class="page">
      <div class="head">
        <div><span class="eyebrow">FY ${L().qFy(q)} · targets from the VG roadmap booklet</span><h1>KPIs · ${view === "years" ? "Year at a glance" : esc(L().periodLabel(p))}</h1></div>
        ${view === "years" ? "" : VG.ui.periodOptions(p)}
      </div>
      <div class="seg-btns" role="tablist">
        <a ${go({ view: "list" })} class="${view === "years" ? "" : "on"}">${esc(L().periodLabel(p))}</a>
        <a ${go({ view: "years" })} class="${view === "years" ? "on" : ""}">Year at a glance · 2022-23 to 2029-30</a>
      </div>
      ${view === "years" ? "" : periodNote(kind, q)}
      ${view === "years" ? "" : tiles}
      ${view === "years" || future ? "" : `<div class="card">
        <div class="card-head"><h2>By office</h2>${kpiLegend()}</div>
        <div class="hbars">${a.offices.map((o) => `
          <a class="hbar" ${go({ office: o.id })} style="color:inherit;text-decoration:none"
             data-tip="${esc(`${o.name}\n${o.kpi.achieved} achieved · ${o.kpi.ontrack} on track\n${o.kpi.behind} behind · ${o.kpi.unreported} not reported`)}">
            <span class="lab">${VG.ui.swatch(o.id)} ${esc(o.short)}</span>${kpiMix(o.kpi)}<span class="val">${o.kpi.total - o.kpi.none - o.kpi.future}</span></a>`).join("")}</div>
        <p class="muted small" style="margin:0">Achieved: the year's target is reached. On track: at least 90% of where it should be by the end of the quarter. Behind: below that, or a milestone is overdue.</p>
      </div>`}
      <div class="filters">
        <select id="office" aria-label="Office">${VG.ui.officeOptions(office, "All offices")}</select>
        ${view === "years" || future ? "" : `<a class="small${show === "none" ? " on-link" : ""}" ${go({ show: "none" })}>Nothing due this year · ${count("none")}</a>`}
        <button type="button" class="secondary" id="export" style="margin-left:auto">Export</button>
      </div>
      <div class="card flush">
        <div class="card-head"><h2>${view === "years" ? "All KPIs, every year" : future ? "Targets" : ({ all: "All KPIs", achieved: "Achieved", ontrack: "On track", behind: "Behind", unreported: "Not reported", none: "Nothing due this year" }[show] || "KPIs")}${office ? " · " + esc(VG.ui.officeShort(office)) : ""}</h2>
          <span class="muted small">${caption}</span></div>
        <div class="table-wrap">${table}</div>
        ${list.length > KTOP ? `<div class="more-row"><button type="button" class="secondary" id="klist-all">Show all ${list.length}</button></div>` : ""}
      </div>
    </div>`;

    const sel = el.querySelector("#q");
    if (sel) sel.onchange = (e) => VG.app.go("kpis", { q: e.target.value, office, show: L().periodKind(e.target.value) === "future" ? "all" : show, view });
    el.querySelector("#office").onchange = (e) => VG.app.go("kpis", { q: p, office: e.target.value, show, view });
    const all = el.querySelector("#klist-all");
    if (all) all.onclick = () => {
      const open = all.dataset.open !== "1";
      el.querySelectorAll("#klist tr.more").forEach((r) => { r.hidden = !open; });
      all.dataset.open = open ? "1" : "";
      all.textContent = open ? `Show first ${KTOP} only` : `Show all ${list.length}`;
    };
    el.querySelector("#export").onclick = () => {
      const csvOf = (head, out, name) => VG.ui.exportText(name, [head, ...out].map((x) => x.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n"));
      if (view === "years") {
        const years = VG.config.targetYears.filter((y) => y >= "2023");
        const nowKey = L().qYearKey(L().thisQuarter());
        const head = ["Intervention", "Code", "Office", "Action step", "KPI", "Basis", "Unit"].concat(years.flatMap((y) => ["Target " + L().fyKeyLabel(y), "Achieved " + L().fyKeyLabel(y)]));
        csvOf(head, list.map((r) => [r.unit.ivNo, r.unit.ivCode, r.unit.office, r.step.title, r.kpi.text, r.kpi.basis, r.kpi.unit]
          .concat(years.flatMap((y) => [(r.kpi.targets || {})[y] ?? "", y < nowKey ? (r.kpi.actuals || {})[y] ?? "" : y === nowKey ? r.actual ?? "" : ""]))), "vg-kpis-all-years.csv");
        return;
      }
      const label = { achieved: "Achieved", ontrack: "On track", behind: "Behind", unreported: "Not reported", none: "Nothing due this year", future: "Target set" };
      const head = ["Period", "Intervention", "Code", "Office", "Action step", "KPI", "Basis", "Unit", "Target " + L().qFy(q)]
        .concat(kind === "ytd" ? ["Q1", "Q2", "Q3", "Q4"] : []).concat(["Achieved", "% of target", "Status"]);
      csvOf(head, rows.map((r) => [L().periodLabel(p), r.unit.ivNo, r.unit.ivCode, r.unit.office, r.step.title, r.kpi.text, r.kpi.basis, r.kpi.unit, r.targetText ?? ""]
        .concat(kind === "ytd" ? (r.milestones ? ["", "", "", ""] : L().quarterValues(d.reports, r.item, q)) : [])
        .concat([r.milestones ? r.milestones.filter((m) => m.state === "done").map((m) => m.label).join("; ") : r.actual ?? "",
          r.pct == null ? "" : Math.round(r.pct * 100), label[r.status]])), `vg-kpis-${p.replace(" ", "-")}.csv`);
    };
  };

  // 5. One office
  VG.views.office = async (el, params) => {
    const d = await load();
    const office = params.id || VG.config.offices[0].id;
    const p = params.q || L().latestQuarterWithData(d.reports);
    const kind = L().periodKind(p);
    const q = L().periodQ(p);
    const a = L().analytics(q, d.steps, d.reports, d.subs);
    if (kind === "future") return futureYear(el, p, a, "office", office);
    const o = a.offices.find((x) => x.id === office);
    const list = attention(a, d.reports, q, office);
    const needs = (x) => x.c.behind || x.over || x.held;
    list.sort((x, y) => (needs(y) ? 1 : 0) - (needs(x) ? 1 : 0) || x.u.ivNo - y.u.ivNo);
    const needCount = list.filter(needs).length;
    const units = a.units.filter((u) => u.office === office);
    const trend = a.trend.map((t) => {
      const rep = units.filter((u) => L().report(d.reports, u.id, t.q)).length;
      return { label: L().qShort(t.q), value: rep, hi: t.q === q, tip: `${L().qLabel(t.q)}\n${rep} of ${units.length} reported` };
    });
    const kchip = (show, text, kind) => `<a class="chip-link" ${VG.ui.link("kpis", { q: p, office, show })}>${VG.ui.chip(text, kind)}</a>`;
    const statusOf = (x) => needs(x) ? issueChips(x) : x.c.unreported ? VG.ui.chip("Not reported", "muted") : x.c.ontrack ? VG.ui.chip("On track", "accent") : x.c.achieved ? VG.ui.chip("Achieved", "good") : VG.ui.chip("Nothing due yet", "muted");

    el.innerHTML = `<div class="page">
      <a class="back" ${VG.ui.link("overview", { q: p })}>Dashboard</a>
      <div class="head">
        <div class="ohead">${VG.logos.mark(office, 56)}<div><span class="eyebrow">Office · ${L().periodLabel(p)}</span><h1>${esc(VG.ui.office(office))}</h1></div></div>
        ${VG.ui.periodOptions(p)}
      </div>
      ${periodNote(kind, q)}
      <div class="tiles five">
        ${VG.ui.tile("Reported", `${o.reported}<small>of ${o.units}</small>`, o.submitted ? VG.ui.chip("Submitted", "good") : VG.ui.chip("Not submitted", "muted"))}
        ${VG.ui.tile("KPIs achieved or on track", `${o.kpi.achieved + o.kpi.ontrack}<small>of ${o.kpi.total - o.kpi.none}</small>`, "", "", "", VG.ui.link("kpis", { q: p, office, show: "all" }))}
        ${VG.ui.tile("KPIs behind", o.kpi.behind, "", "", o.kpi.behind ? "hot" : "", VG.ui.link("kpis", { q: p, office, show: "behind" }))}
        ${VG.ui.tile("Held up", o.held, o.msOverdue ? VG.ui.chip(o.msOverdue + " milestones overdue", "crit") : "")}
        ${VG.ui.tile("Funds spent", o.sanctioned ? VG.ui.pct(o.spent, o.sanctioned) : 0, `${VG.ui.lakh(o.spent)} of ${VG.ui.lakh(o.sanctioned)}`, "%")}
      </div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h2>KPI achievement · ${L().periodLabel(p)}</h2><a class="small" ${VG.ui.link("kpis", { q: p, office })}>All KPIs →</a></div>
          ${kpiLegend()}${kpiMix(o.kpi)}
          <div class="chips">${kchip("achieved", o.kpi.achieved + " achieved", "good")}${kchip("ontrack", o.kpi.ontrack + " on track", "accent")}${kchip("behind", o.kpi.behind + " behind", "serious")}${kchip("unreported", o.kpi.unreported + " not reported", "muted")}</div></div>
        <div class="card"><div class="card-head"><h2>Reported each quarter</h2><span class="muted small">of ${units.length}</span></div>${C().columns(trend, { height: 140 })}</div>
      </div>
      <div class="card flush"><div class="card-head"><h2>Interventions</h2><span class="muted small">${units.length} interventions${needCount ? ` · ${needCount} needing attention shown first` : ""}</span></div>
        <div class="table-wrap"><table class="units"><colgroup><col style="width:64px"><col><col style="width:80px"><col style="width:120px"><col style="width:260px"></colgroup>
        <thead><tr><th>No.</th><th>Intervention</th><th>KPIs</th><th>${"Q" + q.slice(-1)}</th><th>Status</th></tr></thead><tbody>
        ${list.map((x) => `<tr class="${x.saved ? "" : "pending"}"><td><span class="step-pill" style="margin:0">${x.u.ivNo}</span></td>
          <td class="t" data-tip="${esc(x.u.ivDesc)}"><a ${VG.ui.link("iv", { no: x.u.ivNo, q: p })}>${esc(VG.ui.ivShort(x.u.ivDesc))}</a><small>${esc(x.u.ivCode)}</small></td>
          <td>${x.u.kpis.length}</td><td>${x.saved ? VG.ui.chip("Saved", "good") : VG.ui.chip("Not saved", "muted")}</td>
          <td>${statusOf(x)}</td></tr>`).join("")}</tbody></table></div></div>
    </div>`;
    el.querySelector("#q").onchange = (e) => VG.app.go("office", { id: office, q: e.target.value });
  };
})();
