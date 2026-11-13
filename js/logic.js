// Pure rules: months, quarters, carry-forward and "moved". No storage, no screens.
(function () {
  const VG = window.VG;
  const pad = (n) => String(n).padStart(2, "0");

  VG.logic = {
    thisMonth() {
      const d = new Date();
      return d.getFullYear() + "-" + pad(d.getMonth() + 1);
    },
    addMonths(m, n) {
      let [y, mm] = m.split("-").map(Number);
      mm += n;
      while (mm > 12) { mm -= 12; y++; }
      while (mm < 1) { mm += 12; y--; }
      return y + "-" + pad(mm);
    },
    // Reportable months, newest first.
    months() {
      const out = [];
      const end = this.thisMonth();
      for (let m = VG.config.startMonth; m <= end; m = this.addMonths(m, 1)) out.push(m);
      return out.reverse();
    },
    // Financial-year quarter, e.g. "2026-27 Q3".
    quarter(m) {
      const [y, mm] = m.split("-").map(Number);
      const fy = mm >= 4 ? y : y - 1;
      const q = mm >= 4 ? Math.floor((mm - 4) / 3) + 1 : 4;
      return fy + "-" + pad((fy + 1) % 100) + " Q" + q;
    },
    ladder(step) {
      return VG.config.ladders[step.type] || VG.config.ladders.ongoing;
    },
    isFinal(step, position) {
      const l = this.ladder(step);
      return position === l[l.length - 1];
    },

    // Latest record for a step at or before `upTo`. Works for monthly and quarterly maps.
    latest(map, stepId, upTo) {
      let bestKey = null;
      for (const key in map) {
        const i = key.lastIndexOf("|");
        if (key.slice(i + 1) !== stepId) continue;
        const period = key.slice(0, i);
        if (period <= upTo && (bestKey === null || period > bestKey)) bestKey = period;
      }
      return bestKey === null ? null : Object.assign({ period: bestKey }, map[bestKey + "|" + stepId]);
    },
    // Saved report for this month, or null.
    report(reports, stepId, month) {
      return reports[month + "|" + stepId] || null;
    },
    // What the form shows: this month's report, else the last one carried forward.
    effective(reports, stepId, month) {
      return this.latest(reports, stepId, month);
    },
    // true / false once this month is saved and an earlier report exists; null otherwise.
    moved(reports, stepId, month) {
      const cur = this.report(reports, stepId, month);
      if (!cur) return null;
      const prev = this.latest(reports, stepId, this.addMonths(month, -1));
      if (!prev) return null;
      return cur.position !== prev.position || (cur.nextBy || "") !== (prev.nextBy || "");
    },
    // Consecutive saved months, ending at `month`, with no movement.
    monthsNotMoved(reports, stepId, month) {
      let n = 0;
      for (let m = month; this.moved(reports, stepId, m) === false; m = this.addMonths(m, -1)) n++;
      return n;
    },
    isHeldUp(rep) {
      return !!rep && !!rep.heldUp && rep.heldUp !== VG.config.heldUpWith[0];
    },
    stageIndex(step, position) {
      return this.ladder(step).indexOf(position);
    },
    // 0..1 along the step's ladder.
    stageFraction(step, rep) {
      const l = this.ladder(step);
      const i = rep ? l.indexOf(rep.position) : -1;
      return i < 0 ? 0 : i / (l.length - 1);
    },
    // Next-stage date already passed and step not complete.
    isOverdue(step, rep, month) {
      return !!rep && !!rep.nextBy && rep.nextBy < month && !this.isFinal(step, rep.position);
    },
    // Newest month that has at least one saved report, else the newest reportable month.
    latestMonthWithData(reports) {
      const keys = Object.keys(reports);
      const ms = this.months();
      return ms.find((m) => keys.some((k) => k.startsWith(m + "|"))) || ms[0];
    },

    // ---- KPI targets and actuals ----
    // Number from a target or actual ("5,515", "71 Lacs+", "3 (1 Major ...)"); null if none.
    num(v) {
      if (v == null || v === "") return null;
      const str = String(v).replace(/,/g, "");
      const m = str.match(/-?\d+(\.\d+)?/);
      if (!m) return null;
      let n = parseFloat(m[0]);
      if (/lac|lakh/i.test(str)) n *= 100000;
      return n;
    },
    // Booklet year column for the month's financial year (FY 2026-27 -> "2027").
    fyYear(month) { return String(Number(this.quarter(month).slice(0, 4)) + 1); },
    fyLabel(month) { return "FY " + this.quarter(month).slice(0, 7); },
    fyStart(month) { return this.quarter(month).slice(0, 4) + "-04"; },
    // Share of the financial year completed at the end of `month` (Apr = 1/12 ... Mar = 1).
    fyElapsed(month) {
      const m = Number(month.split("-")[1]);
      return (m >= 4 ? m - 3 : m + 9) / 12;
    },
    // Actuals saved this financial year, latest first (carry forward within the year only).
    actualsFor(reports, stepId, month) {
      const r = this.latest(reports, stepId, month);
      return r && r.period >= this.fyStart(month) ? r.actuals || {} : {};
    },
    // Booklet year key -> short financial-year label ("2025" -> "24-25").
    fyKeyLabel(y) { return String(Number(y) - 1).slice(2) + "-" + String(y).slice(2); },
    isMilestone(k) { return k.unit === "milestones"; },
    // Where a KPI should be by the end of `month`: yearly KPIs move from 0 to the year's target;
    // running totals move from last year's target to this year's.
    kpiExpected(k, target, month) {
      const elapsed = this.fyElapsed(month);
      if (k.basis !== "cumulative") return target * elapsed;
      const prev = this.num((k.targets || {})[String(Number(this.fyYear(month)) - 1)]) || 0;
      return prev >= target ? target : prev + (target - prev) * elapsed;
    },
    kpiStatus(k, target, actual, month) {
      if (this.isMilestone(k) || !target) return "none";
      if (actual == null || isNaN(actual)) return "unreported";
      if (actual >= target) return "achieved";
      return actual >= this.kpiExpected(k, target, month) * 0.9 ? "ontrack" : "behind";
    },
    // One row per KPI: target for the year, actual so far, % and status.
    // Actual: this year's saved report; else the achieved figure recorded for that year in the step list.
    kpiRows(step, reports, month) {
      const year = this.fyYear(month);
      const acts = this.actualsFor(reports, step.id, month);
      return (step.kpis || []).map((k) => {
        const targetText = (k.targets || {})[year];
        const target = this.isMilestone(k) ? null : this.num(targetText);
        let actualRaw = acts[k.id];
        if ((actualRaw === "" || actualRaw == null) && k.actuals) actualRaw = k.actuals[year];
        const actual = actualRaw === "" || actualRaw == null ? null : Number(actualRaw);
        const status = this.kpiStatus(k, target, actual, month);
        const pct = target && actual != null && !isNaN(actual) ? actual / target : null;
        return { kpi: k, step, targetText, target, actual, pct, status };
      });
    },

    // Everything the dashboards show for one month.
    analytics(month, steps, reports, quarterly, subs) {
      const active = steps.filter((s) => s.active !== false);
      const q = this.quarter(month);
      const per = (list) => {
        const r = { total: list.length, reported: 0, moved: 0, held: 0, stuck: 0, overdue: 0, progress: 0, sanctioned: 0, spent: 0,
          kpi: { achieved: 0, ontrack: 0, behind: 0, unreported: 0, none: 0, total: 0 } };
        list.forEach((s) => {
          this.kpiRows(s, reports, month).forEach((k) => { r.kpi[k.status]++; r.kpi.total++; });
          const eff = this.effective(reports, s.id, month);
          if (this.report(reports, s.id, month)) r.reported++;
          if (this.moved(reports, s.id, month) === true) r.moved++;
          if (this.isHeldUp(eff)) r.held++;
          if (this.monthsNotMoved(reports, s.id, month) >= 3) r.stuck++;
          if (this.isOverdue(s, eff, month)) r.overdue++;
          r.progress += this.stageFraction(s, eff);
          const f = this.latest(quarterly, s.id, q);
          if (f && f.period === q) { r.sanctioned += Number(f.sanctioned) || 0; r.spent += Number(f.spent) || 0; }
        });
        r.progress = list.length ? r.progress / list.length : 0;
        return r;
      };

      const offices = VG.config.offices.map((o) => {
        const sub = subs[month + "|" + o.id];
        return Object.assign({ id: o.id, name: o.name, short: o.short, submitted: !!sub && sub.status === "submitted" },
          per(active.filter((s) => s.office === o.id)));
      });
      const total = per(active);

      // last 8 months up to `month`, oldest first
      const trend = [];
      for (let i = 7, m = this.addMonths(month, -7); i >= 0; i--, m = this.addMonths(m, 1)) {
        if (m < VG.config.startMonth) continue;
        let reported = 0, moved = 0;
        active.forEach((s) => {
          if (this.report(reports, s.id, m)) reported++;
          if (this.moved(reports, s.id, m) === true) moved++;
        });
        trend.push({ month: m, reported, moved });
      }

      const heldBy = {};
      const stages = { new: VG.config.ladders.new.map(() => 0), ongoing: VG.config.ladders.ongoing.map(() => 0) };
      let unreported = 0;
      active.forEach((s) => {
        const eff = this.effective(reports, s.id, month);
        if (this.isHeldUp(eff)) heldBy[eff.heldUp] = (heldBy[eff.heldUp] || 0) + 1;
        const i = eff ? this.stageIndex(s, eff.position) : -1;
        if (i >= 0) stages[s.type === "new" ? "new" : "ongoing"][i]++; else unreported++;
      });

      return { month, quarter: q, offices, total, trend, heldBy, stages, unreported };
    },
  };
})();
