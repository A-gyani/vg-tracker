// Data layer. Every screen goes through VG.store; nothing else touches storage.
// All methods return Promises so a Firebase version can replace this file without changing the screens.
//
// Records
//   step        { id, ivNo, ivCode, ivDesc, title, office, type, active,
//                 kpis: [{ id, text, targets: {year: value}, basis, unit, collab?, actuals?: {year: value}, milestones? }] }
//   user        { id, name, email, role: "officer"|"admin"|"viewer", office, active }
//   scheme      { id, name, budgetHead, office, active }
//   report      key "2026-27 Q3|I29-SAG"  (quarter | intervention-office unit)
//               { actuals: { "I29-S2.k1": number }, done: { kpiKey: [milestone labels] }, heldUp, moveBy,
//                 schemeId, sanctioned, spent, by, at }
//   submission  key "2026-27 Q3|SAG"      { status: "submitted"|"reopened", by, at }
//   log entry   { at, by, action, target, field, from, to }
(function () {
  const VG = window.VG;
  const P = "vg:";
  const mem = {};

  function read(key, fallback) {
    try {
      const v = localStorage.getItem(P + key);
      return v != null ? JSON.parse(v) : fallback;
    } catch (e) {
      return key in mem ? mem[key] : fallback;
    }
  }
  function write(key, value) {
    mem[key] = value;
    try { localStorage.setItem(P + key, JSON.stringify(value)); } catch (e) { /* memory only */ }
  }
  const now = () => new Date().toISOString();
  const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function addLog(actor, action, target, changes) {
    const log = read("log", []);
    const at = now();
    if (!changes || !changes.length) changes = [{ field: "", from: "", to: "" }];
    changes.forEach((c) => log.push({ at, by: actor.id, action, target, field: c.field, from: c.from, to: c.to }));
    write("log", log);
  }
  function diff(before, after, fields) {
    const b = before || {};
    return fields
      .filter((f) => JSON.stringify(b[f] ?? "") !== JSON.stringify(after[f] ?? ""))
      .map((f) => ({ field: f, from: b[f] ?? "", to: after[f] ?? "" }));
  }
  function upsert(listKey, rec, actor, action, fields, prefix) {
    const list = read(listKey, []);
    const i = rec.id ? list.findIndex((x) => x.id === rec.id) : -1;
    const before = i >= 0 ? list[i] : null;
    const after = Object.assign({}, before || { active: true }, rec);
    if (!after.id) after.id = newId(prefix);
    if (i >= 0) list[i] = after; else list.push(after);
    write(listKey, list);
    const changes = diff(before, after, fields);
    if (changes.length) addLog(actor, before ? action + " edited" : action + " added", after.id, changes);
    return after;
  }
  function isLocked(q, office) {
    const s = read("submissions", {})[q + "|" + office];
    return !!s && s.status === "submitted";
  }

  const STEP_FIELDS = ["title", "office", "type", "active", "ivNo", "ivCode", "kpis"];
  const USER_FIELDS = ["name", "email", "role", "office", "active"];
  const SCHEME_FIELDS = ["name", "budgetHead", "office", "active"];

  VG.store = {
    async init() {
      const version = window.VG_SEED_VERSION || "";
      if (read("seeded", false)) {
        if (read("seedVersion", "") === version) return;
        // A newer step list or report format: replace the step list. Old reports no longer fit, so they go too
        // (test mode only: this is sample or trial data). Users are kept; sample schemes are removed.
        write("steps", (window.VG_SEED_STEPS || []).map((s) => Object.assign({}, s)));
        write("reports", {});
        write("submissions", {});
        if (read("sample", false)) write("schemes", read("schemes", []).filter((s) => !String(s.id).startsWith("sample-")));
        write("sample", false);
        write("seedVersion", version);
        addLog({ id: "system" }, "Step list updated", "all", [{ field: "version", from: "", to: version }]);
        return;
      }
      write("seedVersion", version);
      write("steps", (window.VG_SEED_STEPS || []).map((s) => Object.assign({}, s)));
      write("users", VG.config.seedUsers.map((u) => Object.assign({ active: true }, u)));
      write("schemes", []);
      write("reports", {});
      write("submissions", {});
      write("log", []);
      write("seeded", true);
    },

    async reset() {
      try {
        Object.keys(localStorage).filter((k) => k.startsWith(P)).forEach((k) => localStorage.removeItem(k));
      } catch (e) { /* ignore */ }
      Object.keys(mem).forEach((k) => delete mem[k]);
      await this.init();
    },

    // steps
    async listSteps() { return read("steps", []); },
    async getStep(id) { return read("steps", []).find((s) => s.id === id) || null; },
    async saveStep(step, actor) { return upsert("steps", step, actor, "Step", STEP_FIELDS, "S"); },

    // users
    async listUsers() { return read("users", []); },
    async saveUser(user, actor) { return upsert("users", user, actor, "User", USER_FIELDS, "u"); },

    // schemes
    async listSchemes() { return read("schemes", []); },
    async saveScheme(scheme, actor) { return upsert("schemes", scheme, actor, "Scheme", SCHEME_FIELDS, "sc"); },

    // quarterly reports, one per intervention-office unit
    async allReports() { return read("reports", {}); },
    async saveReport(q, unit, data, actor) {
      if (isLocked(q, unit.office)) throw new Error("This quarter is submitted.");
      const all = read("reports", {});
      const key = q + "|" + unit.id;
      const F = ["actuals", "done", "heldUp", "moveBy", "schemeId", "sanctioned", "spent"];
      const after = { actuals: data.actuals || {}, done: data.done || {}, heldUp: data.heldUp || VG.config.heldUpWith[0],
        moveBy: data.moveBy || "", schemeId: data.schemeId || "", sanctioned: data.sanctioned ?? "", spent: data.spent ?? "", by: actor.id, at: now() };
      const changes = diff(all[key], after, F);
      all[key] = after;
      write("reports", all);
      addLog(actor, "Report saved", key, changes);
      return after;
    },

    // quarter submission
    async allSubmissions() { return read("submissions", {}); },
    async setSubmission(q, office, status, actor) {
      const all = read("submissions", {});
      const key = q + "|" + office;
      const before = all[key] ? all[key].status : "";
      all[key] = { status, by: actor.id, at: now() };
      write("submissions", all);
      addLog(actor, status === "submitted" ? "Quarter submitted" : "Quarter reopened", key, [{ field: "status", from: before, to: status }]);
      return all[key];
    },

    // change log
    async listLog() { return read("log", []); },

    // test mode only: load generated sample records in one go
    async loadSample(data, actor) {
      write("schemes", read("schemes", []).concat(data.schemes));
      write("reports", Object.assign(read("reports", {}), data.reports));
      write("submissions", Object.assign(read("submissions", {}), data.submissions));
      write("sample", true);
      addLog(actor, "Sample data loaded", "all", [{ field: "reports", from: "", to: Object.keys(data.reports).length }]);
    },
    async isSample() { return read("sample", false); },
  };
})();
