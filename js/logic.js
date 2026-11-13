// Pure rules: quarters, interventions, KPI status and milestones. No storage, no screens.
//
// Reporting is quarterly on the Gujarat Government financial year (April to March):
//   Q1 Apr–Jun · Q2 Jul–Sep · Q3 Oct–Dec · Q4 Jan–Mar. A quarter is written "2026-27 Q3".
// Officers report one "unit" at a time: one intervention, for one office (an intervention whose KPIs
// belong to two offices has one unit per office). Unit id: "I29-SAG". KPI key inside a unit: "I29-S2.k1".
(function () {
  const VG = window.VG;
  const pad = (n) => String(n).padStart(2, "0");
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  VG.logic = {
    // ---- months (still used for dates and the financial year) ----
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
    // Financial-year quarter of a month, e.g. "2026-27 Q3".
    quarter(m) {
      const [y, mm] = m.split("-").map(Number);
      const fy = mm >= 4 ? y : y - 1;
      const q = mm >= 4 ? Math.floor((mm - 4) / 3) + 1 : 4;
      return fy + "-" + pad((fy + 1) % 100) + " Q" + q;
    },

    // ---- quarters ----
    thisQuarter() { return this.quarter(this.thisMonth()); },
    qParts(q) { return { fy: Number(q.slice(0, 4)), n: Number(q.slice(-1)) }; },
    addQuarters(q, k) {
      const { fy, n } = this.qParts(q);
      const i = fy * 4 + (n - 1) + k;
      const f = Math.floor(i / 4);
      return f + "-" + pad((f + 1) % 100) + " Q" + ((i % 4) + 1);
    },
    // Reportable quarters, newest first: from the start month's quarter to the current one.
    quarters() {
      const out = [];
      const end = this.thisQuarter();
      for (let q = this.quarter(VG.config.startMonth); q <= end; q = this.addQuarters(q, 1)) out.push(q);
      return out.reverse();
    },
    qFy(q) { return q.slice(0, 7); },                                    // "2026-27"
    qYearKey(q) { return String(this.qParts(q).fy + 1); },              // booklet column "2027"
    qEndMonth(q) {
      const { fy, n } = this.qParts(q);
      return n === 4 ? (fy + 1) + "-03" : fy + "-" + pad(3 + n * 3);
    },
    qStartMonth(q) { return this.addMonths(this.qEndMonth(q), -2); },
    qElapsed(q) { return this.qParts(q).n / 4; },
    qLabel(q) { return "Q" + this.qParts(q).n + " " + this.qFy(q); },   // "Q3 2026-27"
    qShort(q) { return "Q" + this.qParts(q).n + " " + this.qFy(q).slice(2); }, // "Q3 26-27"
    qMonths(q) {
      const s = this.qStartMonth(q), e = this.qEndMonth(q);
      return MON[+s.slice(5) - 1] + "–" + MON[+e.slice(5) - 1] + " " + e.slice(0, 4);
    },
    // Reminder date: the 15th of the month after the quarter ends.
    qDue(q) {
      const m = this.addMonths(this.qEndMonth(q), 1);
      return "15 " + MON[+m.slice(5) - 1] + " " + m.slice(0, 4);
    },
    // Quarters of the same financial year, Q1..Q4.
    fyQuarters(q) { const f = this.qFy(q); return [1, 2, 3, 4].map((n) => f + " Q" + n); },

    // ---- financial year (from a month) ----
    // Booklet year column for the month's financial year (FY 2026-27 -> "2027").
    fyYear(month) { return String(Number(this.quarter(month).slice(0, 4)) + 1); },
    fyLabel(month) { return "FY " + this.quarter(month).slice(0, 7); },
    fyElapsed(month) {
      const m = Number(month.split("-")[1]);
      return (m >= 4 ? m - 3 : m + 9) / 12;
    },
    // Booklet year key -> short label ("2025" -> "24-25").
    fyKeyLabel(y) { return String(Number(y) - 1).slice(2) + "-" + String(y).slice(2); },

    // ---- interventions and units ----
    // One unit per intervention and office, in intervention order.
    units(steps) {
      const map = new Map();
      steps.filter((s) => s.active !== false).forEach((s) => {
        const id = `I${String(s.ivNo).padStart(2, "0")}-${s.office}`;
        if (!map.has(id)) map.set(id, { id, ivNo: s.ivNo, ivCode: s.ivCode, ivDesc: s.ivDesc || "", office: s.office, steps: [], kpis: [] });
        const u = map.get(id);
        u.steps.push(s);
        (s.kpis || []).forEach((k) => u.kpis.push({ key: s.id + "." + k.id, k, step: s, unit: u }));
      });
      return [...map.values()].sort((a, b) => (a.ivNo - b.ivNo) || a.office.localeCompare(b.office));
    },
    // All units of one intervention number.
    ivUnits(steps, no) { return this.units(steps).filter((u) => u.ivNo === Number(no)); },

    // ---- reports (key "2026-27 Q3|I29-SAG") ----
    report(reports, unitId, q) { return reports[q + "|" + unitId] || null; },
    // Latest report for the unit at or before q (optionally only within q's financial year).
    latest(reports, unitId, q, sameFy) {
      let best = null;
      for (const key in reports) {
        const i = key.lastIndexOf("|");
        if (key.slice(i + 1) !== unitId) continue;
        const p = key.slice(0, i);
        if (p > q || (sameFy && this.qFy(p) !== this.qFy(q))) continue;
        if (!best || p > best) best = p;
      }
      return best ? Object.assign({ period: best }, reports[best + "|" + unitId]) : null;
    },
    isHeldUp(rep) {
      return !!rep && !!rep.heldUp && rep.heldUp !== VG.config.heldUpWith[0];
    },
    // "Held up with" and finance carry forward until changed.
    effective(reports, unitId, q) { return this.latest(reports, unitId, q, false); },

    // ---- KPI figures ----
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
    // Figure entered in each quarter of q's financial year (null where none).
    quarterValues(reports, item, q) {
      return this.fyQuarters(q).map((p) => {
        const r = this.report(reports, item.unit.id, p);
        const v = r && r.actuals ? r.actuals[item.key] : undefined;
        return v === undefined || v === "" ? null : Number(v);
      });
    },
    // Figure as of q: the latest one entered this financial year, else the recorded figure for that year.
    kpiActual(reports, item, q) {
      for (let p = q; this.qFy(p) === this.qFy(q); p = this.addQuarters(p, -1)) {
        const r = this.report(reports, item.unit.id, p);
        if (r && r.actuals && r.actuals[item.key] !== undefined && r.actuals[item.key] !== "") return Number(r.actuals[item.key]);
      }
      const rec = (item.k.actuals || {})[this.qYearKey(q)];
      return rec == null ? null : Number(rec);
    },
    // Milestones of a one-time KPI with done / due / overdue as of q.
    milestones(reports, item, q) {
      const done = {};
      for (const key in reports) {
        const i = key.lastIndexOf("|");
        if (key.slice(i + 1) !== item.unit.id || key.slice(0, i) > q) continue;
        ((reports[key].done || {})[item.key] || []).forEach((label) => {
          const p = key.slice(0, i);
          if (!done[label] || p < done[label]) done[label] = p;
        });
      }
      return (item.k.milestones || []).map((m) => {
        const dueQ = /Q\d$/.test(m.due) ? m.due : m.due + " Q4";
        const doneIn = done[m.label] || null;
        const state = doneIn ? "done" : dueQ < q ? "overdue" : (dueQ === q || (!/Q\d$/.test(m.due) && m.due === this.qFy(q))) ? "due" : "later";
        return Object.assign({}, m, { doneIn, state });
      });
    },
    // One row per KPI of a unit (or list of KPI items) for quarter q.
    kpiRows(items, reports, q) {
      const year = this.qYearKey(q);
      const end = this.qEndMonth(q);
      return items.map((item) => {
        const k = item.k;
        if (this.isMilestone(k)) {
          const ms = this.milestones(reports, item, q);
          const status = ms.some((m) => m.state === "overdue") ? "behind"
            : ms.length && ms.every((m) => m.state === "done") ? "achieved"
              : ms.some((m) => m.state === "done" || m.state === "due") ? "ontrack" : "none";
          return { item, kpi: k, step: item.step, unit: item.unit, targetText: (k.targets || {})[year], target: null, actual: null, pct: null, status, milestones: ms };
        }
        const targetText = (k.targets || {})[year];
        const target = this.num(targetText);
        const actual = this.kpiActual(reports, item, q);
        const status = this.kpiStatus(k, target, actual, end);
        const pct = target && actual != null && !isNaN(actual) ? actual / target : null;
        return { item, kpi: k, step: item.step, unit: item.unit, targetText, target, actual, pct, status };
      });
    },
    count(rows) {
      const c = { achieved: 0, ontrack: 0, behind: 0, unreported: 0, none: 0, total: rows.length };
      rows.forEach((r) => { c[r.status]++; });
      return c;
    },

    // Everything the dashboards show for one quarter.
    analytics(q, steps, reports, subs) {
      const units = this.units(steps);
      const per = (list) => {
        const r = { units: list.length, reported: 0, held: 0, msOverdue: 0, sanctioned: 0, spent: 0, kpis: 0 };
        const rows = [];
        list.forEach((u) => {
          const kr = this.kpiRows(u.kpis, reports, q);
          rows.push(...kr);
          r.kpis += u.kpis.length;
          kr.forEach((x) => { if (x.milestones) r.msOverdue += x.milestones.filter((m) => m.state === "overdue").length; });
          if (this.report(reports, u.id, q)) r.reported++;
          const eff = this.effective(reports, u.id, q);
          if (this.isHeldUp(eff)) r.held++;
          if (eff) { r.sanctioned += Number(eff.sanctioned) || 0; r.spent += Number(eff.spent) || 0; }
        });
        r.kpi = this.count(rows);
        r.rows = rows;
        return r;
      };
      const offices = VG.config.offices.map((o) => {
        const sub = subs[q + "|" + o.id];
        return Object.assign({ id: o.id, name: o.name, short: o.short, submitted: !!sub && sub.status === "submitted" },
          per(units.filter((u) => u.office === o.id)));
      });
      const total = per(units);
      const trend = [];
      for (let i = 5; i >= 0; i--) {
        const p = this.addQuarters(q, -i);
        if (p < this.quarter(VG.config.startMonth)) continue;
        trend.push({ q: p, reported: units.filter((u) => this.report(reports, u.id, p)).length });
      }
      const heldBy = {};
      units.forEach((u) => {
        const eff = this.effective(reports, u.id, q);
        if (this.isHeldUp(eff)) heldBy[eff.heldUp] = (heldBy[eff.heldUp] || 0) + 1;
      });
      return { q, units, offices, total, trend, heldBy };
    },
    // Newest quarter that has at least one saved report, else the current quarter.
    latestQuarterWithData(reports) {
      const keys = Object.keys(reports);
      const qs = this.quarters();
      return qs.find((q) => keys.some((k) => k.startsWith(q + "|"))) || qs[0];
    },
  };
})();
