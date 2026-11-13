// Officer screens: the month view of own steps, and the report form for one step.
(function () {
  const VG = window.VG;
  const { esc } = VG.ui;
  const SHORT = 90; // characters of step text shown in tables

  async function officeSteps(office) {
    return (await VG.store.listSteps()).filter((s) => s.office === office && s.active !== false);
  }
  function lockState(subs, month, office) {
    const s = subs[month + "|" + office];
    return { locked: !!s && s.status === "submitted", sub: s || null };
  }
  const short = (t) => t.length > SHORT ? t.slice(0, SHORT - 2).trimEnd() + "…" : t;
  const dash = '<span class="muted">–</span>';

  // 2. My steps for a month
  VG.views.officerMonth = async (el, params) => {
    const user = VG.auth.user();
    const month = params.m || VG.logic.months()[0];
    const show = params.show || "all";
    const [steps, reports, subs] = await Promise.all([officeSteps(user.office), VG.store.allReports(), VG.store.allSubmissions()]);
    const { locked, sub } = lockState(subs, month, user.office);

    const info = steps.map((s) => {
      const rep = VG.logic.report(reports, s.id, month);
      const eff = rep || VG.logic.effective(reports, s.id, month);
      return { s, rep, eff, moved: VG.logic.moved(reports, s.id, month), stuck: VG.logic.monthsNotMoved(reports, s.id, month),
        held: VG.logic.isHeldUp(eff), overdue: VG.logic.isOverdue(s, eff, month),
        behind: VG.logic.kpiRows(s, reports, month).filter((k) => k.status === "behind").length };
    });
    const saved = info.filter((x) => x.rep).length;
    const carriable = info.filter((x) => !x.rep && x.eff).length;
    const moved = info.filter((x) => x.moved === true).length;
    const held = info.filter((x) => x.held).length;
    const overdue = info.filter((x) => x.overdue).length;
    const all = steps.length > 0 && saved === steps.length;
    const notSaved = steps.length - saved;

    const pick = { all: () => true, pending: (x) => !x.rep, moved: (x) => x.moved === true, held: (x) => x.held, overdue: (x) => x.overdue };
    const list = info.filter(pick[show] || pick.all);

    // Figure tiles double as filters; the chosen one is ringed.
    const ftile = (key, inner, cls) => `<a class="tile ftile${show === key ? " on" : ""}${cls ? " " + cls : ""}" ${VG.ui.link("my", { m: month, show: key })}
      aria-pressed="${show === key}">${inner}</a>`;
    const body = (label, value, sub) => `<span class="label">${esc(label)}</span><span class="value num">${value}</span>${sub ? `<span class="sub">${sub}</span>` : ""}`;
    const title = { all: "All steps", pending: "Not saved", moved: "Moved", held: "Held up", overdue: "Past the expected date" }[show] || "Steps";

    // What to do this month
    const todo = locked
      ? `<div class="todo done"><div><b>${VG.ui.month(month)} is submitted.</b><span>Submitted ${VG.ui.date(sub.at)}. Admin can reopen it if something needs changing.</span></div></div>`
      : `<div class="todo"><div><b>${saved} of ${steps.length} steps saved for ${VG.ui.month(month)}.</b>
          <span>${all ? "All steps are saved. Submit when you are ready." : "Open each step to update it, or save the unchanged ones in one go. Then submit."}</span></div>
          <div class="actions">
            ${carriable ? `<button type="button" id="carry" class="secondary">Save ${carriable} unchanged from last month</button>` : ""}
            <button type="button" id="submit"${all ? "" : " disabled"}>Submit ${VG.ui.month(month)}</button>
          </div></div>`;

    el.innerHTML = `<div class="page">
      <div class="head">
        <div class="ohead">${VG.logos.mark(user.office, 56)}<div><span class="eyebrow">${esc(VG.ui.office(user.office))}</span><h1>My steps · ${VG.ui.month(month)}</h1></div></div>
        ${VG.ui.monthOptions(month)}
      </div>

      ${todo}

      <div class="tiles five">
        ${ftile("all", `<span class="ring-row">${VG.charts.ring(steps.length ? saved / steps.length : 0, 54)}<span class="ring-text">
          <span class="label">Saved this month</span><b class="num">${saved} of ${steps.length}</b>${locked ? VG.ui.chip("Submitted", "good") : ""}</span></span>`, "ring-tile")}
        ${ftile("pending", body("Not saved", notSaved, notSaved ? "Still to do" : "All done"))}
        ${ftile("moved", body("Moved since last month", moved, "Position or date changed"))}
        ${ftile("held", body("Held up", held, held ? "Needs follow-up" : ""), held ? "hot" : "")}
        ${ftile("overdue", body("Past the expected date", overdue, overdue ? VG.ui.chip("Overdue", "crit") : ""))}
      </div>

      <div class="card flush">
        <div class="card-head"><h2>${title}</h2><span class="muted small">${list.length} of ${steps.length} steps · click a step to fill it in</span></div>
        <div class="table-wrap"><table class="osteps">
          <colgroup><col style="width:92px"><col><col style="width:185px"><col style="width:140px"><col style="width:112px"><col style="width:178px"></colgroup>
          <thead><tr><th>Step</th><th>Action step</th><th>Position</th><th>Held up with</th><th>Next stage by</th><th>This month</th></tr></thead>
          <tbody>${list.map((x) => `<tr class="${x.rep ? "" : "pending"}">
            <td class="nw">${x.rep ? '<span class="tick" title="Saved">✓</span>' : '<span class="tick off" title="Not saved"></span>'}<a class="id" ${VG.ui.link("report", { id: x.s.id, m: month })}>${esc(x.s.id)}</a></td>
            <td class="ot"${x.s.title.length > SHORT ? ` data-tip="${esc(x.s.title)}"` : ""}><a ${VG.ui.link("report", { id: x.s.id, m: month })} style="color:inherit">${esc(short(x.s.title))}</a></td>
            <td>${VG.ui.stage(x.s, x.eff)}</td>
            <td>${x.held ? VG.ui.chip(x.eff.heldUp, "warn") : dash}</td>
            <td class="small">${x.eff && x.eff.nextBy ? VG.ui.month(x.eff.nextBy) : dash} ${x.overdue ? VG.ui.chip("Overdue", "crit") : ""}</td>
            <td><div class="chips">${x.rep ? VG.ui.movedChip(x.moved) : x.eff ? VG.ui.chip("From last month", "muted") : VG.ui.chip("Not filled", "muted")}${VG.ui.stuckChip(x.stuck)}${x.behind ? VG.ui.chip(x.behind + (x.behind === 1 ? " KPI behind" : " KPIs behind"), "serious") : ""}</div></td>
          </tr>`).join("") || `<tr><td colspan="6" class="muted">No steps here.</td></tr>`}</tbody>
        </table></div>
      </div>
    </div>`;

    el.querySelector("#month").onchange = (e) => VG.app.go("my", { m: e.target.value, show });
    const carry = el.querySelector("#carry");
    if (carry) carry.onclick = async () => {
      for (const x of info) {
        if (!x.rep && x.eff) await VG.store.saveReport(month, x.s, Object.assign({}, x.eff, { actuals: VG.logic.actualsFor(reports, x.s.id, month) }), user);
      }
      VG.ui.flash("Saved unchanged steps");
      VG.app.refresh();
    };
    const submit = el.querySelector("#submit");
    if (submit) submit.onclick = async () => {
      if (!(await VG.ui.confirm(`Submit ${VG.ui.month(month)}? It can only be edited again if admin reopens it.`, "Submit"))) return;
      await VG.store.setSubmission(month, user.office, "submitted", user);
      VG.ui.flash("Submitted");
      VG.app.refresh();
    };
  };

  // 3. Report form for one step
  VG.views.officerReport = async (el, params) => {
    const user = VG.auth.user();
    const month = params.m || VG.logic.months()[0];
    const step = await VG.store.getStep(params.id);
    if (!step || step.office !== user.office) throw new Error("Step not found. Go back to My steps and choose a step.");

    const [steps, reports, quarterly, subs, schemes] = await Promise.all([
      officeSteps(user.office), VG.store.allReports(), VG.store.allQuarterly(), VG.store.allSubmissions(), VG.store.listSchemes()]);
    const { locked } = lockState(subs, month, user.office);
    const quarter = VG.logic.quarter(month);
    const rep = VG.logic.effective(reports, step.id, month) || {};
    const prev = VG.logic.latest(reports, step.id, VG.logic.addMonths(month, -1));
    const fin = VG.logic.latest(quarterly, step.id, quarter) || {};
    const mySchemes = schemes.filter((s) => s.active !== false && (!s.office || s.office === user.office));
    const idx = steps.findIndex((s) => s.id === step.id);
    const next = steps[idx + 1];
    const ladder = VG.logic.ladder(step);
    const cur = ladder.indexOf(rep.position);
    const prevIdx = prev ? ladder.indexOf(prev.position) : -1;
    const kpiRows = VG.logic.kpiRows(step, reports, month);

    // Everything sits in one form so the save bar at the bottom saves all three parts.
    el.innerHTML = `<div class="page">
      <a class="back" ${VG.ui.link("my", { m: month })}>My steps · ${VG.ui.month(month)}</a>
      <div class="head"><div class="ohead">${VG.logos.mark(step.office, 56)}<div>
        <span class="eyebrow">Step ${idx + 1} of ${steps.length} · Intervention ${esc(step.ivNo)} · ${esc(step.ivCode)}</span>
        <span class="step-pill">${esc(step.id)}</span>
        <h1 class="step-title">${esc(step.title)}</h1>
      </div></div>${locked ? VG.ui.chip("Submitted · read only", "good") : ""}</div>

      <form id="f" class="report-form"><fieldset${locked ? " disabled" : ""}>
        <div class="grid g-wide">
          <div class="card">
            <div class="card-head"><h2><span class="sec-no">1</span>Position in ${VG.ui.month(month)}</h2><span class="muted small">${step.type === "new" ? "New scheme" : "Ongoing"}</span></div>
            <div class="ladder" role="radiogroup" aria-label="Current position">
              ${ladder.map((l, i) => `<label class="${cur >= 0 && i < cur ? "done" : ""}">
                <input type="radio" name="position" value="${esc(l)}"${i === cur ? " checked" : ""} required>
                <span class="n">${i + 1}</span>${esc(l)}${i === prevIdx ? `<span class="was">Last month</span>` : ""}</label>`).join("")}
            </div>
            <div class="row">
              <label>Held up with
                <select id="heldUp" name="heldUp" required>${VG.ui.options(VG.config.heldUpWith, rep.heldUp || VG.config.heldUpWith[0])}</select></label>
              <label>Next stage expected by
                <input id="nextBy" type="month" name="nextBy" value="${esc(rep.nextBy)}" min="${VG.config.startMonth}">
                <span class="date-warn" id="dateWarn" hidden>This date has passed. Please update it.</span></label>
            </div>
          </div>

          <div class="card" style="align-self:start"><div class="card-head"><h2>Recent months</h2><a class="small" ${VG.ui.link("step", { id: step.id })}>Full history</a></div>
            ${VG.logic.months().slice(0, 6).map((m) => {
              const r = VG.logic.report(reports, step.id, m);
              return `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
                <span class="small${m === month ? "" : " muted"}" style="min-width:64px">${VG.ui.monthShort(m)}</span>
                ${r ? VG.ui.dots(step, r.position) : '<span class="muted small">—</span>'}
                <span style="min-width:80px;text-align:right">${VG.ui.movedChip(VG.logic.moved(reports, step.id, m))}</span></div>`;
            }).join("")}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2><span class="sec-no">2</span>KPIs · ${VG.logic.fyLabel(month)}</h2><span class="muted small">Running total: the total so far, including earlier years. Yearly: this year's figure so far.</span></div>
          <div class="table-wrap"><table class="kpi-input"><thead><tr><th>KPI</th><th class="num">Target ${VG.logic.fyLabel(month).replace("FY ", "")}</th><th class="num">Achieved</th><th style="min-width:170px">Progress</th></tr></thead><tbody>
          ${kpiRows.map((r) => VG.logic.isMilestone(r.kpi)
            ? `<tr><td>${esc(r.kpi.text)}${VG.ui.kpiTags(r.kpi)}</td><td colspan="3">${VG.ui.milestoneList(r.kpi)}<span class="muted small">Milestones are ticked in the quarterly form (coming soon).</span></td></tr>`
            : `<tr><td>${esc(r.kpi.text)}${VG.ui.kpiTags(r.kpi)}</td><td class="num">${esc(r.targetText) || "–"}</td>
            <td class="num"><input id="a_${esc(r.kpi.id)}" name="a_${esc(r.kpi.id)}" type="number" step="any" min="0" value="${r.actual ?? ""}"
              aria-label="${r.kpi.basis === "cumulative" ? "Total so far" : "This year so far"}" placeholder="${r.kpi.basis === "cumulative" ? "Total so far" : "This year"}"></td>
            <td data-bar="${esc(r.kpi.id)}">${VG.ui.kpiBar(r, month)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">No KPIs for this step.</td></tr>`}
          </tbody></table></div>
          <details><summary class="small muted" style="cursor:pointer">Targets for all years</summary>${VG.ui.kpiTable(step, null, month)}</details>
        </div>

        <div class="card">
          <div class="card-head"><h2><span class="sec-no">3</span>Finance · ${quarter}</h2><span class="muted small">₹ lakh · fill once a quarter; carries forward</span></div>
          <div class="row">
            <label>Scheme
              <select id="schemeId" name="schemeId">${VG.ui.options(mySchemes.map((s) => ({ value: s.id, label: s.name })), fin.schemeId, "")}</select></label>
            <label>Budget head <input id="head" readonly tabindex="-1"></label>
          </div>
          <div class="row">
            <label>Sanctioned <input id="sanctioned" type="number" name="sanctioned" min="0" step="0.01" value="${esc(fin.sanctioned)}"></label>
            <label>Spent <input id="spent" type="number" name="spent" min="0" step="0.01" value="${esc(fin.spent)}"></label>
          </div>
          <div class="meter" id="util"></div>
        </div>
      </fieldset>

      ${locked ? "" : `<div class="savebar">
        <span class="small"><b>Step ${idx + 1} of ${steps.length}</b> · ${esc(step.id)}</span>
        <div class="actions">
          <button type="submit" name="go" value="stay"${next ? ' class="secondary"' : ""}>Save</button>
          ${next ? `<button type="submit" name="go" value="next">Save and next step</button>` : ""}
        </div>
      </div>`}
      </form>
    </div>`;

    const form = el.querySelector("#f");
    const F = form.elements;
    const head = el.querySelector("#head");
    const util = el.querySelector("#util");
    const refreshFin = () => {
      const sc = schemes.find((s) => s.id === F.schemeId.value);
      head.value = sc ? sc.budgetHead : "";
      const a = Number(F.sanctioned.value) || 0, b = Number(F.spent.value) || 0;
      util.innerHTML = a ? `<span>${VG.ui.pct(b, a)}% of sanctioned amount spent</span><div class="bar"><span style="width:${Math.min(100, (b / a) * 100)}%"></span></div>` : "";
    };
    F.schemeId.onchange = refreshFin;
    F.sanctioned.oninput = refreshFin;
    F.spent.oninput = refreshFin;
    refreshFin();

    // Warn when the expected month is already behind the reporting month.
    const warn = el.querySelector("#dateWarn");
    const checkDate = () => {
      const pos = (form.querySelector('input[name="position"]:checked') || {}).value;
      warn.hidden = !(F.nextBy.value && F.nextBy.value < month && !VG.logic.isFinal(step, pos));
    };
    F.nextBy.addEventListener("input", checkDate);
    form.querySelectorAll('input[name="position"]').forEach((r) => r.addEventListener("change", checkDate));
    checkDate();

    kpiRows.forEach((r) => {
      const inp = el.querySelector("#a_" + CSS.escape(r.kpi.id));
      if (!inp) return;
      inp.oninput = () => {
        const actual = inp.value === "" ? null : Number(inp.value);
        const row = Object.assign({}, r, { actual, pct: r.target && actual != null ? actual / r.target : null });
        row.status = VG.logic.kpiStatus(r.kpi, r.target, actual, month);
        el.querySelector(`[data-bar="${CSS.escape(r.kpi.id)}"]`).innerHTML = VG.ui.kpiBar(row, month);
      };
    });

    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = VG.ui.formData(form);
      if (!d.position) { VG.ui.flash("Choose the current position."); return; }
      if (!d.nextBy && !VG.logic.isFinal(step, d.position)) {
        F.nextBy.setCustomValidity("Enter the month the next stage is expected");
        F.nextBy.reportValidity();
        F.nextBy.oninput = () => F.nextBy.setCustomValidity("");
        return;
      }
      d.actuals = {};
      (step.kpis || []).forEach((k) => { const v = d["a_" + k.id]; if (v !== undefined && v !== "") d.actuals[k.id] = Number(v); });
      try {
        await VG.store.saveReport(month, step, d, user);
        if (d.schemeId || d.sanctioned || d.spent) {
          await VG.store.saveQuarterly(quarter, step, month, {
            schemeId: d.schemeId,
            sanctioned: d.sanctioned === "" ? "" : Number(d.sanctioned),
            spent: d.spent === "" ? "" : Number(d.spent),
          }, user);
        }
      } catch (err) {
        VG.ui.flash(err.message);
        return;
      }
      VG.ui.flash("Saved");
      const go = e.submitter && e.submitter.value;
      if (go === "next" && next) VG.app.go("report", { id: next.id, m: month });
      else VG.app.go("my", { m: month });
    };
  };
})();
