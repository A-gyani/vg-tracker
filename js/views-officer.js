// Officer screens: the quarter view of the office's interventions, and the quarterly report for one intervention.
(function () {
  const VG = window.VG;
  const { esc } = VG.ui;
  const L = () => VG.logic;

  async function myUnits(office) {
    return L().units(await VG.store.listSteps()).filter((u) => u.office === office);
  }
  function lockState(subs, q, office) {
    const s = subs[q + "|" + office];
    return { locked: !!s && s.status === "submitted", sub: s || null };
  }
  const isSubmitted = (subs, office) => (p) => { const s = subs[p + "|" + office]; return !!s && s.status === "submitted"; };

  // Status of one unit this quarter: behind KPIs, overdue milestones, else the best summary.
  function unitStatus(rows) {
    const c = L().count(rows);
    const overdue = rows.reduce((n, r) => n + (r.milestones ? r.milestones.filter((m) => m.state === "overdue").length : 0), 0);
    const chips = [];
    if (c.behind) chips.push(VG.ui.chip(c.behind + " behind", "serious"));
    if (overdue) chips.push(VG.ui.chip(overdue + (overdue === 1 ? " milestone overdue" : " milestones overdue"), "crit"));
    if (!chips.length) {
      if (c.unreported) chips.push(VG.ui.chip("Not reported", "muted"));
      else if (c.ontrack) chips.push(VG.ui.chip("On track", "accent"));
      else if (c.achieved) chips.push(VG.ui.chip("Achieved", "good"));
      else chips.push(VG.ui.chip("Nothing due yet", "muted"));
    }
    return { c, overdue, html: `<div class="chips">${chips.join("")}</div>` };
  }

  // 2. My interventions for a quarter
  VG.views.officerQuarter = async (el, params) => {
    const user = VG.auth.user();
    const q = params.q && !L().isYear(params.q) ? params.q : L().thisQuarter();
    const show = params.show || "all";
    const [units, reports, subs] = await Promise.all([myUnits(user.office), VG.store.allReports(), VG.store.allSubmissions()]);
    const { locked, sub } = lockState(subs, q, user.office);
    const prevQ = L().addQuarters(q, -1);

    const info = units.map((u) => {
      const rep = L().report(reports, u.id, q);
      const rows = L().kpiRows(u.kpis, reports, q);
      const eff = L().effective(reports, u.id, q);
      const st = unitStatus(rows);
      const msDue = rows.reduce((n, r) => n + (r.milestones ? r.milestones.filter((m) => m.state === "due").length : 0), 0);
      return { u, rep, rows, st, eff, held: L().isHeldUp(eff), msDue, prev: L().report(reports, u.id, prevQ) };
    });
    const saved = info.filter((x) => x.rep).length;
    const carriable = info.filter((x) => !x.rep && x.prev).length;
    const kpiTotal = units.reduce((n, u) => n + u.kpis.length, 0);
    const behind = info.reduce((n, x) => n + x.st.c.behind, 0);
    const msDue = info.reduce((n, x) => n + x.msDue, 0);
    const msOver = info.reduce((n, x) => n + x.st.overdue, 0);
    const held = info.filter((x) => x.held);
    const all = units.length > 0 && saved === units.length;

    const pick = { all: () => true, pending: (x) => !x.rep, behind: (x) => x.st.c.behind || x.st.overdue, held: (x) => x.held };
    const list = info.filter(pick[show] || pick.all);
    const ftile = (key, label, value, subText, cls) => `<a class="tile ftile${show === key ? " on" : ""}${cls ? " " + cls : ""}" ${VG.ui.link("my", { q, show: key })}
      aria-pressed="${show === key}"><span class="label">${esc(label)}</span><span class="value num">${value}</span>${subText ? `<span class="sub">${subText}</span>` : ""}</a>`;
    const title = { all: "All interventions", pending: "Not saved", behind: "Behind or overdue", held: "Held up" }[show] || "Interventions";

    const todo = locked
      ? `<div class="todo done"><div><b>${L().qLabel(q)} is submitted.</b><span>Submitted ${VG.ui.date(sub.at)}. Admin can reopen it if something needs changing.</span></div></div>`
      : `<div class="todo"><div><b>${saved} of ${units.length} interventions saved for ${L().qLabel(q)}.</b>
          <span>Report by ${L().qDue(q)}. ${all ? "All saved. Submit when you are ready." : "Open each intervention to update it, or save the unchanged ones in one go. Then submit."}</span></div>
          <div class="actions">
            ${carriable ? `<button type="button" id="carry" class="secondary">Save ${carriable} unchanged from Q${prevQ.slice(-1)}</button>` : ""}
            <button type="button" id="submit"${all ? "" : " disabled"}>Submit ${L().qLabel(q)}</button>
          </div></div>`;

    el.innerHTML = `<div class="page">
      <div class="head">
        <div class="ohead">${VG.logos.mark(user.office, 56)}<div><span class="eyebrow">${esc(VG.ui.office(user.office))} · FY ${L().qFy(q)}</span>
          <h1>My interventions · Q${q.slice(-1)} (${L().qMonths(q)})</h1></div></div>
      </div>
      ${VG.ui.quarterStrip(q, (p) => VG.ui.link("my", { q: p, show }), isSubmitted(subs, user.office))}
      ${todo}
      <div class="tiles five">
        ${ftile("all", "Interventions", units.length, `${kpiTotal} KPIs`)}
        ${ftile("pending", "Saved for Q" + q.slice(-1), `${saved}<small>of ${units.length}</small>`, units.length - saved ? `${units.length - saved} still to do` : "All saved")}
        ${ftile("behind", "KPIs behind", behind, behind ? "Needs attention" : "None", behind ? "hot" : "")}
        <div class="tile"><span class="label">Milestones due this quarter</span><span class="value num">${msDue}</span><span class="sub">${msOver ? VG.ui.chip(msOver + " overdue", "crit") : "None overdue"}</span></div>
        ${ftile("held", "Held up", held.length, held.length ? esc(held[0].eff.heldUp) + (held.length > 1 ? " and others" : "") : "")}
      </div>
      <div class="card flush">
        <div class="card-head"><h2>${title}</h2><span class="muted small">${list.length} of ${units.length} · click an intervention to fill it in</span></div>
        <div class="table-wrap"><table class="units">
          <colgroup><col style="width:64px"><col><col style="width:90px"><col style="width:150px"><col style="width:200px"></colgroup>
          <thead><tr><th>No.</th><th>Intervention</th><th>KPIs</th><th>Q${q.slice(-1)}</th><th>Status</th></tr></thead>
          <tbody>${list.map((x) => `<tr class="${x.rep ? "" : "pending"}">
            <td><span class="step-pill" style="margin:0">${x.u.ivNo}</span></td>
            <td class="t" data-tip="${esc(x.u.ivDesc)}"><a ${VG.ui.link("report", { id: x.u.id, q })}>${esc(VG.ui.ivShort(x.u.ivDesc))}</a><small>${esc(x.u.ivCode)}</small></td>
            <td>${x.u.kpis.length} KPI${x.u.kpis.length === 1 ? "" : "s"}</td>
            <td>${x.rep ? VG.ui.chip("Saved", "good") : x.prev ? VG.ui.chip("Not saved", "muted") : VG.ui.chip("Not started", "muted")}</td>
            <td>${x.st.html}${x.held ? VG.ui.chip(x.eff.heldUp, "warn") : ""}</td>
          </tr>`).join("") || `<tr><td colspan="5" class="muted">Nothing here.</td></tr>`}</tbody>
        </table></div>
      </div>
    </div>`;

    const carry = el.querySelector("#carry");
    if (carry) carry.onclick = async () => {
      for (const x of info) if (!x.rep && x.prev) await VG.store.saveReport(q, x.u, x.prev, user);
      VG.ui.flash("Saved unchanged interventions");
      VG.app.refresh();
    };
    const submit = el.querySelector("#submit");
    if (submit) submit.onclick = async () => {
      if (!(await VG.ui.confirm(`Submit ${L().qLabel(q)}? It can only be edited again if admin reopens it.`, "Submit"))) return;
      await VG.store.setSubmission(q, user.office, "submitted", user);
      VG.ui.flash("Submitted");
      VG.app.refresh();
    };
  };

  // 3. Quarterly report for one intervention (this office's KPIs only)
  VG.views.officerReport = async (el, params) => {
    const user = VG.auth.user();
    const q = params.q || L().thisQuarter();
    const [units, reports, subs, schemes] = await Promise.all([
      myUnits(user.office), VG.store.allReports(), VG.store.allSubmissions(), VG.store.listSchemes()]);
    const idx = units.findIndex((u) => u.id === params.id);
    const unit = units[idx];
    if (!unit) throw new Error("Intervention not found. Go back to My interventions and choose one.");
    const next = units[idx + 1];
    const { locked } = lockState(subs, q, user.office);
    const rep = L().report(reports, unit.id, q);
    const eff = L().effective(reports, unit.id, q) || {};
    const rows = L().kpiRows(unit.kpis, reports, q);
    const num = rows.filter((r) => !r.milestones);
    const ms = rows.filter((r) => r.milestones);
    const mySchemes = schemes.filter((s) => s.active !== false && (!s.office || s.office === user.office));
    const end = L().qEndMonth(q);
    const qn = "Q" + q.slice(-1);
    const fyLabel = L().qFy(q).slice(2);

    // KPI rows, with a grey heading for each action step
    let lastStep = null;
    const kpiHtml = num.map((r) => {
      const head = r.step.id !== lastStep && unit.steps.length > 1 ? `<tr class="subhead"><td colspan="5">${esc(r.step.title)}</td></tr>` : "";
      lastStep = r.step.id;
      const qv = L().quarterValues(reports, r.item, q);
      const hist = qv.map((v, j) => (j < Number(q.slice(-1)) - 1 && v != null ? `<span>Q${j + 1}: ${VG.ui.fmtNum(v)}</span>` : "")).join("");
      const own = rep && rep.actuals && rep.actuals[r.item.key] !== undefined ? rep.actuals[r.item.key] : "";
      const ph = r.actual != null ? VG.ui.fmtNum(r.actual) : r.kpi.basis === "cumulative" ? "Total so far" : "This year";
      return head + `<tr><td>${esc(r.kpi.text)}${VG.ui.kpiTags(r.kpi)}${hist ? `<div class="qhist">${hist}</div>` : ""}</td>
        <td class="num">${esc(r.targetText) || "–"}</td>
        <td class="num"><input name="a|${esc(r.item.key)}" data-k="${esc(r.item.key)}" type="number" step="any" min="0" value="${esc(own)}"
          placeholder="${esc(ph)}" aria-label="${r.kpi.basis === "cumulative" ? "Total so far" : "This year so far"}"></td>
        <td data-bar="${esc(r.item.key)}">${VG.ui.kpiBar(r, end)}</td><td data-chip="${esc(r.item.key)}">${VG.ui.kpiChip(r.status)}</td></tr>`;
    }).join("");

    const msHtml = ms.map((r) => {
      const ticked = (rep && rep.done && rep.done[r.item.key]) || [];
      return `<div class="mgroup">${ms.length > 1 || unit.steps.length > 1 ? `<span class="muted small">${esc(r.kpi.text)}</span>` : ""}
        ${r.milestones.map((m) => {
          const doneBefore = m.doneIn && m.doneIn < q;
          const checked = doneBefore || ticked.includes(m.label);
          return `<label class="mtick ${m.state}"><input type="checkbox" name="m|${esc(r.item.key)}" value="${esc(m.label)}"${checked ? " checked" : ""}${doneBefore ? " disabled" : ""}>
            ${esc(m.label)} <b>${doneBefore ? "Done in " + esc(L().qLabel(m.doneIn)) : "Due " + esc(m.due) + (m.state === "overdue" ? " · overdue" : m.state === "due" ? " · now" : "")}</b></label>`;
        }).join("")}</div>`;
    }).join("");

    let sec = 0;
    el.innerHTML = `<div class="page">
      <a class="back" ${VG.ui.link("my", { q })}>My interventions · ${qn}</a>
      <div class="head"><div class="ohead">${VG.logos.mark(unit.office, 56)}<div>
        <span class="eyebrow">Intervention ${unit.ivNo} · ${esc(unit.ivCode)} · ${L().qLabel(q)} (${L().qMonths(q)})</span>
        <h1 class="step-title" data-tip="${esc(unit.ivDesc)}">${esc(VG.ui.ivShort(unit.ivDesc, 140))}</h1>
      </div></div>${locked ? VG.ui.chip("Submitted · read only", "good") : ""}</div>

      <form id="f" class="report-form"><fieldset${locked ? " disabled" : ""}>
        ${num.length ? `<div class="card">
          <div class="card-head"><h2><span class="sec-no">${++sec}</span>KPIs · achieved by end of ${qn}</h2><span class="muted small">Running total: the total so far. Yearly: this year so far.</span></div>
          <div class="table-wrap"><table class="kpi-input"><thead><tr><th>KPI</th><th class="num">Target ${fyLabel}</th><th class="num">By end of ${qn}</th><th style="min-width:150px">Progress</th><th></th></tr></thead>
          <tbody>${kpiHtml}</tbody></table></div>
          <a class="small" ${VG.ui.link("iv", { no: unit.ivNo, q })}>Graphs and all years →</a>
        </div>` : ""}
        ${ms.length ? `<div class="card"><div class="card-head"><h2><span class="sec-no">${++sec}</span>Milestones</h2><span class="muted small">Tick each one when it is done</span></div>${msHtml}</div>` : ""}
        <div class="card"><div class="card-head"><h2><span class="sec-no">${++sec}</span>Held up with</h2><span class="muted small">Only if a KPI or milestone is delayed</span></div>
          <div class="row">
            <label>Held up with <select name="heldUp">${VG.ui.options(VG.config.heldUpWith, eff.heldUp || VG.config.heldUpWith[0])}</select></label>
            <label>Expected to move by <input type="month" name="moveBy" value="${esc(eff.moveBy)}" min="${VG.config.startMonth}">
              <span class="date-warn" id="dateWarn" hidden>This month has passed. Please update it.</span></label>
          </div></div>
        <div class="card"><div class="card-head"><h2><span class="sec-no">${++sec}</span>Finance · ${L().qLabel(q)}</h2><span class="muted small">₹ lakh · carries forward</span></div>
          <div class="row">
            <label>Scheme <select id="schemeId" name="schemeId">${VG.ui.options(mySchemes.map((s) => ({ value: s.id, label: s.name })), eff.schemeId, "")}</select></label>
            <label>Budget head <input id="head" readonly tabindex="-1"></label>
          </div>
          <div class="row">
            <label>Sanctioned <input type="number" name="sanctioned" min="0" step="0.01" value="${esc(eff.sanctioned)}"></label>
            <label>Spent <input type="number" name="spent" min="0" step="0.01" value="${esc(eff.spent)}"></label>
          </div>
          <div class="meter" id="util"></div></div>
      </fieldset>
      ${locked ? "" : `<div class="savebar">
        <span class="small"><b>Intervention ${idx + 1} of ${units.length}</b> · ${L().qLabel(q)}</span>
        <div class="actions">
          <button type="submit" name="go" value="stay"${next ? ' class="secondary"' : ""}>Save</button>
          ${next ? `<button type="submit" name="go" value="next">Save and next</button>` : ""}
        </div></div>`}
      </form>
    </div>`;

    const form = el.querySelector("#f");
    const F = form.elements;
    const util = el.querySelector("#util");
    const refreshFin = () => {
      const sc = schemes.find((s) => s.id === F.schemeId.value);
      el.querySelector("#head").value = sc ? sc.budgetHead : "";
      const a = Number(F.sanctioned.value) || 0, b = Number(F.spent.value) || 0;
      util.innerHTML = a ? `<span>${VG.ui.pct(b, a)}% of sanctioned amount spent</span><div class="bar"><span style="width:${Math.min(100, (b / a) * 100)}%"></span></div>` : "";
    };
    F.schemeId.onchange = refreshFin; F.sanctioned.oninput = refreshFin; F.spent.oninput = refreshFin;
    refreshFin();
    const warn = el.querySelector("#dateWarn");
    const checkDate = () => { warn.hidden = !(F.moveBy.value && F.moveBy.value < L().qStartMonth(q) && L().isHeldUp({ heldUp: F.heldUp.value })); };
    F.moveBy.addEventListener("input", checkDate); F.heldUp.addEventListener("change", checkDate); checkDate();

    // live progress while typing
    num.forEach((r) => {
      const inp = form.querySelector(`input[data-k="${CSS.escape(r.item.key)}"]`);
      inp.oninput = () => {
        const actual = inp.value === "" ? r.actual : Number(inp.value);
        const row = Object.assign({}, r, { actual, pct: r.target && actual != null ? actual / r.target : null });
        row.status = L().kpiStatus(r.kpi, r.target, actual, end);
        el.querySelector(`[data-bar="${CSS.escape(r.item.key)}"]`).innerHTML = VG.ui.kpiBar(row, end);
        el.querySelector(`[data-chip="${CSS.escape(r.item.key)}"]`).innerHTML = VG.ui.kpiChip(row.status);
      };
    });

    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = { actuals: {}, done: {}, heldUp: F.heldUp.value, moveBy: F.moveBy.value, schemeId: F.schemeId.value,
        sanctioned: F.sanctioned.value === "" ? "" : Number(F.sanctioned.value), spent: F.spent.value === "" ? "" : Number(F.spent.value) };
      if (L().isHeldUp(data) && !data.moveBy) {
        F.moveBy.setCustomValidity("Enter the month it is expected to move");
        F.moveBy.reportValidity();
        F.moveBy.oninput = () => F.moveBy.setCustomValidity("");
        return;
      }
      form.querySelectorAll('input[name^="a|"]').forEach((i) => { if (i.value !== "") data.actuals[i.dataset.k] = Number(i.value); });
      form.querySelectorAll('input[name^="m|"]:checked:not(:disabled)').forEach((i) => {
        const k = i.name.slice(2);
        (data.done[k] = data.done[k] || []).push(i.value);
      });
      try {
        await VG.store.saveReport(q, unit, data, user);
      } catch (err) { VG.ui.flash(err.message); return; }
      VG.ui.flash("Saved");
      const go = e.submitter && e.submitter.value;
      if (go === "next" && next) VG.app.go("report", { id: next.id, q });
      else VG.app.go("my", { q });
    };
  };
})();
