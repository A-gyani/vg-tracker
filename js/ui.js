// Small helpers shared by all screens.
(function () {
  const VG = window.VG;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ICON = { good: "✓", warn: "!", serious: "▲", crit: "■", accent: "●", muted: "○" };

  VG.ui = {
    esc,
    month(m) {
      if (!m) return "";
      const [y, mm] = m.split("-");
      return MON[+mm - 1] + " " + y;
    },
    monthShort(m) {
      if (!m) return "";
      const [y, mm] = m.split("-");
      return MON[+mm - 1] + " " + y.slice(2);
    },
    date(iso) {
      if (!iso) return "";
      const d = new Date(iso);
      return String(d.getDate()).padStart(2, "0") + " " + MON[d.getMonth()] + " " + d.getFullYear() + ", " +
        String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    },
    office(id) {
      const o = VG.config.offices.find((x) => x.id === id);
      return o ? o.name : id || "";
    },
    officeShort(id) {
      const o = VG.config.offices.find((x) => x.id === id);
      return o ? o.short : id || "";
    },
    officeColor(id) { return `var(--o-${id})`; },
    swatch(id) { return `<span class="swatch" style="background:var(--o-${esc(id)})"></span>`; },
    lakh(n) {
      const v = Number(n) || 0;
      return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: v < 100 ? 1 : 0 }) + " L";
    },
    pct(a, b) { return b ? Math.round((a / b) * 100) : 0; },

    // Internal link: <a ${VG.ui.link("report", {id})}>
    link(route, params) {
      return `href="#${route}" data-go="${route}" data-p="${esc(JSON.stringify(params || {}))}"`;
    },

    options(list, selected, blank) {
      const head = blank !== undefined ? `<option value="">${esc(blank)}</option>` : "";
      return head + list.map((o) => {
        const v = typeof o === "object" ? o.value : o;
        const l = typeof o === "object" ? o.label : o;
        return `<option value="${esc(v)}"${String(v) === String(selected ?? "") ? " selected" : ""}>${esc(l)}</option>`;
      }).join("");
    },
    officeOptions(selected, blank) {
      return this.options(VG.config.offices.map((o) => ({ value: o.id, label: o.name })), selected, blank);
    },
    quarterOptions(selected, id) {
      return `<select id="${id || "q"}" aria-label="Quarter">${this.options(VG.logic.quarters().map((q) => ({ value: q, label: VG.logic.qLabel(q) + " · " + VG.logic.qMonths(q) })), selected)}</select>`;
    },
    // Q1..Q4 of the year as chips: ticked when submitted, ringed when chosen, greyed when still ahead.
    quarterStrip(q, linkFor, submittedFor) {
      const now = VG.logic.thisQuarter();
      return `<div class="quarters">${VG.logic.fyQuarters(q).map((p) => {
        const n = "Q" + p.slice(-1) + " " + VG.logic.qMonths(p).replace(/ \d{4}$/, "");
        const done = submittedFor && submittedFor(p);
        const cls = p === q ? "on" : done ? "done" : "";
        return p > now || p < VG.logic.quarter(VG.config.startMonth) ? `<span class="future">${esc(n)}</span>`
          : `<a class="${cls}" ${linkFor(p)}>${done ? "✓ " : ""}${esc(n)}</a>`;
      }).join("")}</div>`;
    },
    // Intervention text cut for lists; full text goes in a tooltip.
    ivShort(text, n) {
      const t = String(text || "").split(/[.:]/)[0];
      const max = n || 90;
      return t.length > max ? t.slice(0, max - 2).trimEnd() + "…" : t;
    },
    chip(text, kind) {
      const k = kind || "muted";
      return `<span class="chip chip-${k}"><i aria-hidden="true">${ICON[k] || ""}</i>${esc(text)}</span>`;
    },
    movedChip(v) {
      return v === true ? this.chip("Moved", "good") : v === false ? this.chip("No change", "muted") : "";
    },
    stuckChip(n) {
      if (n >= 3) return this.chip(n + " months unchanged", "serious");
      if (n >= 1) return this.chip(n + (n === 1 ? " month unchanged" : " months unchanged"), "warn");
      return "";
    },
    // cls "hot" marks the tile that needs action (pink in Dawn).
    tile(label, value, sub, unit, cls) {
      return `<div class="tile${cls ? " " + cls : ""}"><span class="label">${esc(label)}</span>
        <span class="value num">${value}${unit ? `<small>${esc(unit)}</small>` : ""}</span>
        ${sub ? `<span class="sub">${sub}</span>` : ""}</div>`;
    },
    // Ladder position as dots; tooltip names the stage.
    dots(step, position) {
      const l = VG.logic.ladder(step);
      const i = l.indexOf(position);
      const tip = i >= 0 ? `Stage ${i + 1} of ${l.length}: ${position}` : "Not reported";
      return `<span class="dots" data-tip="${esc(tip)}">${l.map((_, k) =>
        `<i class="${k < i ? "on" : k === i ? "cur" : ""}"></i>`).join("")}</span>`;
    },
    stage(step, rep) {
      if (!rep) return `<span class="muted small">Not reported</span>`;
      return `<div class="stage">${this.dots(step, rep.position)}<span>${esc(rep.position)}</span></div>`;
    },
    kpiChip(status) {
      return {
        achieved: this.chip("Achieved", "good"),
        ontrack: this.chip("On track", "accent"),
        behind: this.chip("Behind", "serious"),
        unreported: this.chip("Not reported", "muted"),
        none: this.chip("No target this year", "muted"),
      }[status] || "";
    },
    // Progress toward target; the tick marks where the year should be by now.
    kpiBar(row, month) {
      if (row.pct == null) return "";
      const w = Math.min(100, row.pct * 100);
      const color = row.status === "achieved" ? "var(--good)" : row.status === "behind" ? "var(--serious)" : "var(--ontrack, var(--accent))";
      const expect = Math.min(100, row.target ? (VG.logic.kpiExpected(row.kpi, row.target, month) / row.target) * 100 : VG.logic.fyElapsed(month) * 100);
      return `<div class="kbar" data-tip="${esc(`${Math.round(row.pct * 100)}% of the year's target\nExpected by now: about ${Math.round(expect)}%`)}">
        <div class="kbar-track"><span style="width:${w}%;background:${color}"></span><i style="left:${expect}%"></i></div>
        <b class="num">${Math.round(row.pct * 100)}%</b></div>`;
    },
    fmtNum(v) {
      if (v == null || v === "") return "";
      const n = Number(v);
      return isNaN(n) ? esc(v) : n.toLocaleString("en-IN");
    },
    // Targets by year; with `rows` (from logic.kpiRows) also actual, progress and status for the year.
    // Small grey line under a KPI: how it is counted, its unit and any collaborating department.
    kpiTags(k) {
      const parts = [VG.config.kpiBasis[k.basis] || ""];
      if (k.unit && k.unit !== "number" && k.unit !== "milestones") parts.push("in " + VG.config.kpiUnits[k.unit]);
      if (k.collab) parts.push("with " + k.collab);
      return `<small class="ktag">${esc(parts.filter(Boolean).join(" · "))}</small>`;
    },
    // Milestones of a one-time KPI, with the quarter or year each is due.
    milestoneList(k) {
      return `<ul class="mlist">${(k.milestones || []).map((m) => `<li><span>${esc(m.label)}</span><b>${esc(m.due)}</b></li>`).join("")}</ul>`;
    },
    kpiTable(step, rows, month) {
      const now = VG.logic.fyYear(month || VG.logic.thisMonth());
      const extra = !!rows;
      // only the years any KPI of this step has a target or figure for
      const years = VG.config.targetYears.filter((y) => (step.kpis || []).some((k) =>
        ((k.targets || {})[y] ?? "") !== "" || (k.actuals || {})[y] != null));
      const cell = (k, y) => {
        const t = (k.targets || {})[y];
        const a = (k.actuals || {})[y];
        return `${esc(t)}${a != null ? `<small class="ach" data-tip="Achieved in ${VG.logic.fyKeyLabel(y)}">✓ ${this.fmtNum(a)}</small>` : ""}`;
      };
      return `<div class="table-wrap"><table class="kpis${extra ? " actuals" : ""}"><thead><tr><th>KPI</th>${years.map((y) =>
        `<th class="${y === now ? "now" : ""}"${y === now ? ' data-tip="Target for the current financial year"' : ""}>${VG.logic.fyKeyLabel(y)}</th>`).join("")}
        ${extra ? `<th>Actual</th><th style="min-width:150px">Progress</th><th></th>` : ""}</tr></thead><tbody>
        ${(step.kpis || []).map((k, i) => `<tr><td>${esc(k.text)}${this.kpiTags(k)}${VG.logic.isMilestone(k) ? this.milestoneList(k) : ""}</td>${years.map((y) =>
          `<td class="${y === now ? "now" : ""}">${cell(k, y)}</td>`).join("")}
          ${extra ? `<td><b>${this.fmtNum(rows[i].actual)}</b></td><td>${this.kpiBar(rows[i], month)}</td><td>${VG.logic.isMilestone(k) ? this.chip("Milestones", "muted") : this.kpiChip(rows[i].status)}</td>` : ""}</tr>`).join("")}
      </tbody></table></div>`;
    },
    formData(form) {
      const out = {};
      new FormData(form).forEach((v, k) => { out[k] = typeof v === "string" ? v.trim() : v; });
      return out;
    },
    flash(msg) {
      const el = document.getElementById("flash");
      el.textContent = msg;
      el.hidden = false;
      clearTimeout(el._t);
      el._t = setTimeout(() => { el.hidden = true; }, 2500);
    },

    // In-page confirm (browser confirm() is not available everywhere). Resolves true/false.
    confirm(message, okLabel, danger) {
      return new Promise((resolve) => {
        const m = document.getElementById("modal");
        m.innerHTML = `<div class="box" role="dialog" aria-modal="true"><p>${esc(message)}</p>
          <div class="actions end"><button type="button" class="secondary" id="m-no">Cancel</button>
          <button type="button" id="m-yes"${danger ? ' class="danger"' : ""}>${esc(okLabel || "OK")}</button></div></div>`;
        m.hidden = false;
        const done = (v) => { m.hidden = true; m.innerHTML = ""; resolve(v); };
        m.querySelector("#m-yes").onclick = () => done(true);
        m.querySelector("#m-no").onclick = () => done(false);
        m.onclick = (e) => { if (e.target === m) done(false); };
        m.querySelector("#m-yes").focus();
      });
    },

    // Export: download where the browser allows it, copy as a fallback.
    exportText(filename, text) {
      const m = document.getElementById("modal");
      m.innerHTML = `<div class="box" role="dialog" aria-modal="true"><h2>${esc(filename)}</h2>
        <textarea id="m-text" readonly>${esc(text)}</textarea>
        <div class="actions end"><button type="button" class="secondary" id="m-close">Close</button>
        <button type="button" class="secondary" id="m-copy">Copy</button><button type="button" id="m-dl">Download</button></div></div>`;
      m.hidden = false;
      const close = () => { m.hidden = true; m.innerHTML = ""; };
      m.querySelector("#m-close").onclick = close;
      m.onclick = (e) => { if (e.target === m) close(); };
      m.querySelector("#m-copy").onclick = async () => {
        const ta = m.querySelector("#m-text");
        try { await navigator.clipboard.writeText(text); VG.ui.flash("Copied"); } catch (e) { ta.select(); }
      };
      m.querySelector("#m-dl").onclick = () => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv" }));
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
    },
  };
})();
