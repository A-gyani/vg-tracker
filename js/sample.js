// Test mode only: generates clearly marked sample records so the dashboards have something to show.
// Fills every reportable quarter before the current one; the current quarter is left for live entry.
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
      const L = VG.logic;
      const units = L.units(await VG.store.listSteps());
      const quarters = L.quarters().slice(1).reverse(); // oldest first, without the current quarter
      const reports = {}, submissions = {};
      const schemes = [];
      Object.entries(SCHEMES).forEach(([office, list]) => list.forEach(([name, head], i) =>
        schemes.push({ id: `sample-${office}-${i}`, name, budgetHead: head, office, active: true })));

      units.forEach((u) => {
        // each KPI gets its own pace; some run ahead, some fall behind, a few are never reported
        const pace = {};
        u.kpis.forEach((it) => { pace[it.key] = r() < 0.08 ? null : 0.55 + r() * 1.3; });
        let held = "Not held up";
        const own = schemes.filter((x) => x.office === u.office);
        const sc = own.length && r() < 0.7 ? own[Math.floor(r() * own.length)] : null;
        const sanctioned = sc ? Math.round((20 + r() * 780) / 5) * 5 : "";
        let used = 0;
        const done = {};
        quarters.forEach((q) => {
          const year = L.qYearKey(q);
          const actuals = {};
          u.kpis.forEach((it) => {
            const k = it.k;
            if (L.isMilestone(k)) {
              (k.milestones || []).forEach((m) => {
                const dueQ = /Q\d$/.test(m.due) ? m.due : m.due + " Q4";
                if (dueQ <= q && r() < 0.55) (done[it.key] = done[it.key] || []).includes(m.label) || done[it.key].push(m.label);
              });
              return;
            }
            const target = L.num((k.targets || {})[year]);
            if (!target || pace[it.key] == null) return;
            const share = Math.min(pace[it.key] * L.qElapsed(q), 1.15);
            // running totals start from last year's target; yearly counts of things that already exist
            // (centres, schools: last year's figure is most of this year's target) start from last year's figure
            const lastYear = String(Number(year) - 1);
            const lastActual = Number((k.actuals || {})[lastYear]);
            const prev = k.basis === "cumulative" ? Math.min(target, L.num((k.targets || {})[lastYear]) || 0)
              : lastActual >= target * 0.6 ? Math.min(target, lastActual) : 0;
            const v = prev + (target - prev) * share;
            actuals[it.key] = k.unit === "crore" ? Math.round(v * 100) / 100 : Math.round(v);
          });
          if (held !== "Not held up" && r() < 0.4) held = "Not held up";
          else if (held === "Not held up" && r() < 0.2) held = HELD[Math.floor(r() * HELD.length)];
          used = Math.min(1, used + 0.15 + r() * 0.3);
          reports[q + "|" + u.id] = { actuals, done: JSON.parse(JSON.stringify(done)), heldUp: held,
            moveBy: held !== "Not held up" ? L.addMonths(L.qEndMonth(q), 1 + Math.floor(r() * 3)) : "",
            schemeId: sc ? sc.id : "", sanctioned, spent: sc ? Math.round(sanctioned * used) : "", by: "sample", at: new Date().toISOString() };
        });
      });

      quarters.forEach((q, i) => VG.config.offices.forEach((o) => {
        const last = i === quarters.length - 1;
        if (last && (o.id === "ARCH" || o.id === "GSA")) return; // left unsubmitted to show the difference
        submissions[q + "|" + o.id] = { status: "submitted", by: "sample", at: new Date().toISOString() };
      }));

      await VG.store.loadSample({ schemes, reports, submissions }, actor);
    },
  };
})();
