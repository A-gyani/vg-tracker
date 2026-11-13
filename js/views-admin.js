// Admin screens: submissions, steps, users, schemes, change log.
(function () {
  const VG = window.VG;
  const { esc } = VG.ui;
  const yesNo = (v) => VG.ui.options([{ value: "1", label: "Yes" }, { value: "0", label: "No" }], v);

  // 7. Submissions by office and month; reopen; export
  VG.views.adminStatus = async (el) => {
    const months = VG.logic.months();
    const [steps, reports, subs] = await Promise.all([VG.store.listSteps(), VG.store.allReports(), VG.store.allSubmissions()]);
    const active = steps.filter((s) => s.active !== false);
    const cur = months[0];
    let submittedNow = 0;

    const cell = (m, o) => {
      const list = active.filter((s) => s.office === o.id);
      const saved = list.filter((s) => VG.logic.report(reports, s.id, m)).length;
      const sub = subs[m + "|" + o.id];
      if (sub && sub.status === "submitted") {
        if (m === cur) submittedNow++;
        return `<td><button type="button" class="chip-btn" data-reopen="${m}|${o.id}"
          data-tip="${esc(`Submitted. Click to reopen ${VG.ui.month(m)} for ${o.short}.`)}">${VG.ui.chip("Submitted", "good")}</button></td>`;
      }
      if (sub && sub.status === "reopened") return `<td>${VG.ui.chip(`Reopened · ${saved}/${list.length}`, "accent")}</td>`;
      if (saved) return `<td>${VG.ui.chip(`Saved, not sent · ${saved}/${list.length}`, "warn")}</td>`;
      return `<td>${VG.ui.chip("Not started", "muted")}</td>`;
    };
    const body = months.map((m) => `<tr><td class="nw"><b>${VG.ui.month(m)}</b></td>${VG.config.offices.map((o) => cell(m, o)).join("")}
      <td><button type="button" class="secondary small-btn" data-export="${m}">Export</button></td></tr>`).join("");
    const offN = VG.config.offices.length;

    el.innerHTML = `<div class="page">
      <div class="head"><div><span class="eyebrow">Admin</span><h1>Submissions</h1></div></div>
      <div class="tiles">
        ${VG.ui.tile(`Submitted for ${VG.ui.month(cur)}`, `${submittedNow}<small>of ${offN} offices</small>`,
          submittedNow < offN ? `${offN - submittedNow} still to submit` : "All submitted", "", submittedNow < offN ? "hot" : "")}
        ${VG.ui.tile("Steps tracked", active.length)}
        ${VG.ui.tile("Reporting months", months.length, `Since ${VG.ui.month(VG.config.startMonth)}`)}
      </div>
      <div class="card flush"><div class="table-wrap"><table class="sgrid">
        <thead><tr><th>Month</th>${VG.config.offices.map((o) => `<th data-tip="${esc(o.name)}">${VG.ui.swatch(o.id)} ${esc(o.short)}</th>`).join("")}<th></th></tr></thead>
        <tbody>${body}</tbody></table></div></div>
      <p class="muted small">To reopen a month for an office, click its green "Submitted" label.</p>
    </div>`;

    el.querySelectorAll("[data-reopen]").forEach((b) => {
      b.onclick = async () => {
        const [m, o] = b.dataset.reopen.split("|");
        if (!(await VG.ui.confirm(`Reopen ${VG.ui.month(m)} for ${VG.ui.officeShort(o)}? The office can then edit and submit again.`, "Reopen"))) return;
        await VG.store.setSubmission(m, o, "reopened", VG.auth.user());
        VG.ui.flash("Reopened");
        VG.app.refresh();
      };
    });
    el.querySelectorAll("[data-export]").forEach((b) => { b.onclick = () => exportMonth(b.dataset.export); });
  };

  async function exportMonth(month) {
    const [steps, reports, quarterly, schemes] = await Promise.all([
      VG.store.listSteps(), VG.store.allReports(), VG.store.allQuarterly(), VG.store.listSchemes()]);
    const q = VG.logic.quarter(month);
    const head = ["Month", "Step ID", "Office", "Step", "Position", "Held up with", "Next stage by", "Moved",
      "Quarter", "Scheme", "Budget head", "Sanctioned (Rs lakh)", "Spent (Rs lakh)"];
    const rows = steps.filter((s) => s.active !== false).map((s) => {
      const r = VG.logic.report(reports, s.id, month) || {};
      const f = quarterly[q + "|" + s.id] || {};
      const sc = schemes.find((x) => x.id === f.schemeId) || {};
      const mv = VG.logic.moved(reports, s.id, month);
      return [month, s.id, s.office, s.title, r.position, r.heldUp, r.nextBy, mv === true ? "Yes" : mv === false ? "No" : "",
        q, sc.name, sc.budgetHead, f.sanctioned, f.spent];
    });
    const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    VG.ui.exportText(`vg-tracker-${month}.csv`, csv);
  }

  // 8. Steps
  VG.views.adminSteps = async (el, params) => {
    const steps = await VG.store.listSteps();
    const office = params.office || "";
    const q = (params.q || "").toLowerCase();
    const list = steps.filter((s) => (!office || s.office === office) && (!q || (s.id + " " + s.title).toLowerCase().includes(q)));
    const count = (id) => steps.filter((s) => s.office === id && s.active !== false).length;
    const activeN = steps.filter((s) => s.active !== false).length;
    const SHORT = 90;
    const short = (t) => t.length > SHORT ? t.slice(0, SHORT - 2).trimEnd() + "…" : t;
    const offOpts = VG.ui.options(VG.config.offices.map((o) => ({ value: o.id, label: `${o.short} (${count(o.id)})` })), office, `All offices (${activeN})`);

    el.innerHTML = `<div class="page">
      <div class="head"><div><span class="eyebrow">Admin</span><h1>Steps</h1></div>
        <a class="button" ${VG.ui.link("step-edit", {})}>Add step</a></div>
      <div class="filters">
        <select id="office" aria-label="Office">${offOpts}</select>
        <input id="q" type="search" placeholder="Search steps" value="${esc(params.q || "")}" style="max-width:260px">
        <span class="muted small">${list.length} shown</span>
      </div>
      <div class="card flush"><div class="table-wrap"><table class="asteps">
        <colgroup><col style="width:84px"><col><col style="width:110px"><col style="width:130px"><col style="width:64px"><col style="width:80px"></colgroup>
        <thead><tr><th>Step</th><th>Action step</th><th>Office</th><th>Type</th><th class="num">KPIs</th><th></th></tr></thead><tbody>
      ${list.map((s) => `<tr class="${s.active === false ? "pending" : ""}">
        <td><a class="id" ${VG.ui.link("step-edit", { id: s.id })}>${esc(s.id)}</a></td>
        <td class="title"${s.title.length > SHORT ? ` data-tip="${esc(s.title)}"` : ""}>${esc(short(s.title))}${s.active === false ? " " + VG.ui.chip("Inactive", "muted") : ""}</td>
        <td><span class="small" style="display:inline-flex;gap:6px;align-items:center">${VG.ui.swatch(s.office)}${esc(VG.ui.officeShort(s.office))}</span></td>
        <td>${s.type === "new" ? VG.ui.chip("New scheme", "accent") : VG.ui.chip("Ongoing", "muted")}</td>
        <td class="num">${(s.kpis || []).length}</td>
        <td><a class="button secondary small-btn" ${VG.ui.link("step-edit", { id: s.id })}>Edit</a></td></tr>`).join("") || `<tr><td colspan="6" class="muted">No steps match.</td></tr>`}
      </tbody></table></div></div>
    </div>`;
    el.querySelector("#office").onchange = (e) => VG.app.go("steps", { office: e.target.value, q: params.q || "" });
    el.querySelector("#q").onchange = (e) => VG.app.go("steps", { office, q: e.target.value });
  };

  // 9. Add / edit a step
  VG.views.adminStepEdit = async (el, params) => {
    const existing = params.id ? await VG.store.getStep(params.id) : null;
    const s = existing || { id: "", ivNo: "", ivCode: "", title: "", office: "", type: "ongoing", active: true, kpis: [] };
    const years = VG.config.targetYears;
    const kpiRow = (k) => `<div class="kpi-block">
        <input type="hidden" name="kpiId" value="${esc(k.id || "")}">
        <label>KPI <textarea name="kpiText" rows="2">${esc(k.text)}</textarea></label>
        <div class="kpi-targets"><span class="muted small">Targets</span>
          ${years.map((y) => `<label>${y} <input name="t${y}" value="${esc((k.targets || {})[y])}"></label>`).join("")}</div>
      </div>`;

    el.innerHTML = `<div class="page">
      <a class="back" ${VG.ui.link("steps")}>Steps</a>
      <div class="head">${existing ? `<div class="ohead">${VG.logos.mark(s.office, 56)}<div>
        <span class="eyebrow">Admin · Edit step</span>
        <span class="step-pill">${esc(s.id)}</span>
        <h1 class="step-title">${esc(s.title)}</h1></div></div>` : `<div><span class="eyebrow">Admin</span><h1>Add step</h1></div>`}</div>
      <form id="f" class="card form">
        <div class="row">
          <label>Step ID <input id="sid" name="id" value="${esc(s.id)}" ${existing ? "readonly" : "required"}></label>
          <label>Intervention no. <input id="ivNo" name="ivNo" type="number" value="${esc(s.ivNo)}"></label>
          <label>Intervention code <input id="ivCode" name="ivCode" value="${esc(s.ivCode)}"></label>
        </div>
        <label>Action step <textarea id="title" name="title" rows="3" required>${esc(s.title)}</textarea></label>
        <div class="row">
          <label>Office <select id="office" name="office" required>${VG.ui.officeOptions(s.office, "")}</select></label>
          <label>Type <select id="type" name="type">${VG.ui.options([{ value: "ongoing", label: "Ongoing" }, { value: "new", label: "New scheme" }], s.type)}</select></label>
          <label>Active <select id="active" name="active">${yesNo(s.active === false ? "0" : "1")}</select></label>
        </div>
        <div class="card-head"><h2>KPIs and targets</h2><button type="button" class="link" id="addkpi">Add KPI</button></div>
        <div id="kpis">${(s.kpis.length ? s.kpis : [{ text: "", targets: {} }]).map(kpiRow).join("")}</div>
        <div class="actions"><button>Save step</button><a class="button secondary" ${VG.ui.link("steps")}>Cancel</a></div>
      </form>
    </div>`;

    const form = el.querySelector("#f");
    el.querySelector("#addkpi").onclick = () => el.querySelector("#kpis").insertAdjacentHTML("beforeend", kpiRow({ text: "", targets: {} }));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = VG.ui.formData(form);
      if (!existing && (await VG.store.getStep(d.id))) { VG.ui.flash("That step ID is already used. Choose another."); return; }
      let maxId = Math.max(0, ...(s.kpis || []).map((k) => Number(String(k.id || "").slice(1)) || 0));
      const kpis = [...el.querySelectorAll("#kpis .kpi-block")].map((tr) => {
        const text = tr.querySelector('[name="kpiText"]').value.trim();
        const targets = {};
        years.forEach((y) => { targets[y] = tr.querySelector(`[name="t${y}"]`).value.trim(); });
        return { id: tr.querySelector('[name="kpiId"]').value || "k" + (++maxId), text, targets };
      }).filter((k) => k.text);
      await VG.store.saveStep({
        id: d.id, ivNo: d.ivNo === "" ? "" : Number(d.ivNo), ivCode: d.ivCode, title: d.title,
        office: d.office, type: d.type, active: d.active === "1", kpis, ivDesc: s.ivDesc || "",
      }, VG.auth.user());
      VG.ui.flash("Step saved");
      VG.app.go("steps", {});
    };
  };

  // 10. Users
  VG.views.adminUsers = async (el) => {
    const users = await VG.store.listUsers();
    const roleChip = { officer: VG.ui.chip("Officer", "muted"), admin: VG.ui.chip("Admin", "accent"), viewer: VG.ui.chip("Viewer", "accent") };
    el.innerHTML = `<div class="page">
      <div class="head"><div><span class="eyebrow">Admin</span><h1>Users</h1></div></div>
      <div class="grid g-wide">
        <div class="card flush"><div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Office</th><th></th></tr></thead><tbody>
        ${users.map((u) => `<tr class="${u.active === false ? "pending" : ""}"><td><b>${esc(u.name)}</b></td><td class="small">${esc(u.email)}</td>
          <td>${roleChip[u.role]}${u.active === false ? " " + VG.ui.chip("Inactive", "muted") : ""}</td>
          <td><span class="small" style="display:inline-flex;gap:6px;align-items:center">${u.office ? VG.ui.swatch(u.office) + esc(VG.ui.officeShort(u.office)) : ""}</span></td>
          <td><button type="button" class="link" data-edit="${esc(u.id)}">Edit</button></td></tr>`).join("")}
        </tbody></table></div></div>
        <form id="f" class="card form">
          <h2 id="formtitle">Add user</h2>
          <input type="hidden" name="id">
          <label>Name <input id="uname" name="name" required></label>
          <label>Email <input id="uemail" name="email" type="email" required></label>
          <label>Role <select id="urole" name="role">${VG.ui.options([{ value: "officer", label: "Officer" }, { value: "admin", label: "Admin" }, { value: "viewer", label: "Viewer" }])}</select></label>
          <label>Office <select id="uoffice" name="office">${VG.ui.officeOptions("", "")}</select></label>
          <label>Active <select id="uactive" name="active">${yesNo("1")}</select></label>
          <div class="actions"><button>Save user</button><button type="button" class="secondary" id="clear">New</button></div>
        </form>
      </div>
    </div>`;

    const form = el.querySelector("#f");
    const F = form.elements;
    el.querySelectorAll("[data-edit]").forEach((b) => {
      b.onclick = () => {
        const u = users.find((x) => x.id === b.dataset.edit);
        F.id.value = u.id; F.name.value = u.name; F.email.value = u.email;
        F.role.value = u.role; F.office.value = u.office || ""; F.active.value = u.active === false ? "0" : "1";
        el.querySelector("#formtitle").textContent = "Edit user";
        F.name.focus();
      };
    });
    el.querySelector("#clear").onclick = () => { form.reset(); F.id.value = ""; el.querySelector("#formtitle").textContent = "Add user"; };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = VG.ui.formData(form);
      if (d.role === "officer" && !d.office) { VG.ui.flash("Choose the officer's office."); return; }
      const clash = users.find((u) => u.email.toLowerCase() === d.email.toLowerCase() && u.id !== d.id);
      if (clash) { VG.ui.flash("That email is already used by " + clash.name + "."); return; }
      await VG.store.saveUser({
        id: d.id || undefined, name: d.name, email: d.email, role: d.role,
        office: d.role === "officer" ? d.office : "", active: d.active === "1",
      }, VG.auth.user());
      VG.ui.flash("User saved");
      VG.app.refresh();
    };
  };

  // 11. Schemes
  VG.views.adminSchemes = async (el) => {
    const schemes = await VG.store.listSchemes();
    el.innerHTML = `<div class="page">
      <div class="head"><div><span class="eyebrow">Admin</span><h1>Schemes</h1></div></div>
      <div class="grid g-wide">
        <div class="card flush">
          ${schemes.length ? `<div class="table-wrap"><table><thead><tr><th>Scheme</th><th>Budget head</th><th>Office</th><th></th></tr></thead><tbody>
          ${schemes.map((s) => `<tr class="${s.active === false ? "pending" : ""}"><td><b>${esc(s.name)}</b>${s.active === false ? " " + VG.ui.chip("Inactive", "muted") : ""}</td>
            <td class="id">${esc(s.budgetHead)}</td>
            <td><span class="small" style="display:inline-flex;gap:6px;align-items:center">${s.office ? VG.ui.swatch(s.office) + esc(VG.ui.officeShort(s.office)) : "All offices"}</span></td>
            <td><button type="button" class="link" data-edit="${esc(s.id)}">Edit</button></td></tr>`).join("")}
          </tbody></table></div>` : `<p class="muted" style="padding:20px;margin:0">No schemes yet. Officers pick from this list in the quarterly finance section.</p>`}
        </div>
        <form id="f" class="card form">
          <h2 id="formtitle">Add scheme</h2>
          <input type="hidden" name="id">
          <label>Scheme name <input id="sname" name="name" required></label>
          <label>Budget head <input id="shead" name="budgetHead" required placeholder="e.g. 2205-00-102-01"></label>
          <label>Office <select id="soffice" name="office">${VG.ui.officeOptions("", "All offices")}</select></label>
          <label>Active <select id="sactive" name="active">${yesNo("1")}</select></label>
          <div class="actions"><button>Save scheme</button><button type="button" class="secondary" id="clear">New</button></div>
        </form>
      </div>
    </div>`;

    const form = el.querySelector("#f");
    const F = form.elements;
    el.querySelectorAll("[data-edit]").forEach((b) => {
      b.onclick = () => {
        const s = schemes.find((x) => x.id === b.dataset.edit);
        F.id.value = s.id; F.name.value = s.name; F.budgetHead.value = s.budgetHead;
        F.office.value = s.office || ""; F.active.value = s.active === false ? "0" : "1";
        el.querySelector("#formtitle").textContent = "Edit scheme";
        F.name.focus();
      };
    });
    el.querySelector("#clear").onclick = () => { form.reset(); F.id.value = ""; el.querySelector("#formtitle").textContent = "Add scheme"; };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = VG.ui.formData(form);
      await VG.store.saveScheme({ id: d.id || undefined, name: d.name, budgetHead: d.budgetHead, office: d.office, active: d.active === "1" }, VG.auth.user());
      VG.ui.flash("Scheme saved");
      VG.app.refresh();
    };
  };

  // 12. Change log
  VG.views.changeLog = async (el, params) => {
    const [log, users] = await Promise.all([VG.store.listLog(), VG.store.listUsers()]);
    const name = (id) => (users.find((u) => u.id === id) || { name: id === "sample" ? "Sample data" : id }).name;
    const who = params.user || "";
    const list = log.filter((e) => !who || e.by === who).slice().reverse().slice(0, 500);
    const show = (v) => typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
    const kind = (a) => /submitted/.test(a) ? "good" : /reopened/.test(a) ? "warn" : /added/.test(a) ? "accent" : "muted";

    // activity by day, last 14 days
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, label: String(d.getDate()), n: log.filter((e) => e.at.slice(0, 10) === key).length });
    }

    el.innerHTML = `<div class="page">
      <div class="head"><div><span class="eyebrow">Admin</span><h1>Change log</h1></div>
        <select id="user" aria-label="Person">${VG.ui.options(users.map((u) => ({ value: u.id, label: u.name })), who, "Everyone")}</select></div>
      <div class="card"><div class="card-head"><h2>Changes per day</h2><span class="muted small">Last 14 days · ${log.length} in total</span></div>
        ${VG.charts.columns(days.map((d) => ({ label: d.label, value: d.n, tip: `${d.key}\n${d.n} changes`, hi: d === days[days.length - 1] })), { height: 110 })}</div>
      <div class="card flush">
      ${list.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Who</th><th>What</th><th>Record</th><th>Field</th><th>From</th><th>To</th></tr></thead><tbody>
      ${list.map((e) => `<tr><td class="small" style="white-space:nowrap">${VG.ui.date(e.at)}</td><td class="small">${esc(name(e.by))}</td>
        <td>${VG.ui.chip(e.action, kind(e.action))}</td><td class="id">${esc(e.target)}</td>
        <td class="small">${esc(e.field)}</td><td class="clip">${esc(show(e.from))}</td><td class="clip">${esc(show(e.to))}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="muted" style="padding:20px;margin:0">No changes yet.</p>`}
      </div>
    </div>`;
    el.querySelector("#user").onchange = (e) => VG.app.go("log", e.target.value ? { user: e.target.value } : {});
  };
})();
