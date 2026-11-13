// Test mode only: generates clearly marked sample records so the dashboards have something to show.
// Fills every reportable month before the current one; the current month is left for live entry.
(function () {
  const VG = window.VG;

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SCHEMES = {
    CYSCA: [["Sample: Cultural festivals and events", "2205-00-102-01"], ["Sample: Youth exchange and diaspora outreach", "2204-00-101-02"]],
    SAG: [["Sample: Sports infrastructure", "4202-03-102-01"], ["Sample: Athlete support and scholarships", "2204-00-104-03"]],
    ARCH: [["Sample: Excavation and monument conservation", "2205-00-103-01"]],
    MUS: [["Sample: Museum development and modernisation", "4202-04-106-01"], ["Sample: Digitisation of collections", "2205-00-107-02"]],
    GSA: [["Sample: Publications programme", "2205-00-105-01"]],
  };
  const HELD = ["Finance Department", "Finance Department", "Department (SYCAD)", "Agency / vendor",
    "General Administration Department", "Government of India", "Own office", "District administration"];

  VG.sample = {
    async generate(actor) {
      const r = rng(2047);
      const steps = (await VG.store.listSteps()).filter((s) => s.active !== false);
      const months = VG.logic.months().slice(1).reverse(); // oldest first, without the current month
      const reports = {}, quarterly = {}, submissions = {};
      const schemes = [];
      Object.entries(SCHEMES).forEach(([office, list]) => list.forEach(([name, head], i) =>
        schemes.push({ id: `sample-${office}-${i}`, name, budgetHead: head, office, active: true })));

      steps.forEach((s) => {
        const ladder = VG.logic.ladder(s);
        let idx = Math.floor(r() * (s.type === "new" ? 3 : 2));
        let held = "Not held up";
        let nextBy = VG.logic.addMonths(months[0], 2);
        // each KPI gets its own pace; some run ahead, some fall behind, a few are never reported
        const pace = {};
        (s.kpis || []).forEach((k) => { pace[k.id] = r() < 0.08 ? null : 0.5 + r() * 1.5; });
        months.forEach((m, mi) => {
          if (mi > 0) {
            const stuckOdds = held !== "Not held up" ? 0.75 : 0.5;
            if (r() > stuckOdds && idx < ladder.length - 1) {
              idx++;
              nextBy = VG.logic.addMonths(m, 1 + Math.floor(r() * 3));
            }
            if (held !== "Not held up" && r() < 0.35) held = "Not held up";
            else if (held === "Not held up" && r() < 0.18) held = HELD[Math.floor(r() * HELD.length)];
          }
          if (idx === ladder.length - 1) { held = "Not held up"; }
          const actuals = {};
          (s.kpis || []).forEach((k) => {
            const year = VG.logic.fyYear(m);
            const target = VG.logic.num((k.targets || {})[year]);
            if (!target || pace[k.id] == null || VG.logic.isMilestone(k)) return;
            const share = Math.min(pace[k.id] * VG.logic.fyElapsed(m), 1.15);
            // running totals start from last year's figure; yearly KPIs start from 0
            const prev = k.basis === "cumulative" ? Math.min(target, VG.logic.num((k.targets || {})[String(Number(year) - 1)]) || 0) : 0;
            const v = prev + (target - prev) * share;
            actuals[k.id] = k.unit === "crore" ? Math.round(v * 100) / 100 : Math.round(v);
          });
          reports[m + "|" + s.id] = { position: ladder[idx], heldUp: held, nextBy: idx === ladder.length - 1 ? "" : nextBy, actuals, by: "sample", at: new Date().toISOString() };
        });

        const own = schemes.filter((x) => x.office === s.office);
        if (own.length && r() < 0.65) {
          const sc = own[Math.floor(r() * own.length)];
          const sanctioned = Math.round((20 + r() * 780) / 5) * 5;
          const quarters = [...new Set(months.map((m) => VG.logic.quarter(m)))];
          let used = 0;
          quarters.forEach((q) => {
            used = Math.min(1, used + 0.08 + r() * 0.22);
            quarterly[q + "|" + s.id] = { schemeId: sc.id, sanctioned, spent: Math.round(sanctioned * used), by: "sample", at: new Date().toISOString() };
          });
        }
      });

      months.forEach((m, mi) => VG.config.offices.forEach((o) => {
        const last = mi === months.length - 1;
        if (last && (o.id === "ARCH" || o.id === "GSA")) return; // left unsubmitted to show the difference
        submissions[m + "|" + o.id] = { status: "submitted", by: "sample", at: new Date().toISOString() };
      }));

      await VG.store.loadSample({ schemes, reports, quarterly, submissions }, actor);
    },
  };
})();
