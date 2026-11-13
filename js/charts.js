// Charts drawn with plain HTML/SVG, no library. Every mark carries data-tip for the hover tooltip.
(function () {
  const VG = window.VG;
  const esc = (s) => VG.ui.esc(s);

  // Smallest round number at or above v (28 -> 30, not 50), so bars fill the chart.
  function niceMax(v) {
    if (v <= 4) return 4;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }

  VG.charts = {
    niceMax,

    // Horizontal bars. rows: [{ label, value, color?, tip?, valueText?, note? }]
    // opts.stacked: label (and note) on its own line above the bar, so long names show in full.
    hbars(rows, opts) {
      const o = opts || {};
      const max = o.max || Math.max(1, ...rows.map((r) => r.value));
      return `<div class="hbars${o.stacked ? " stacked" : ""}">${rows.map((r) => `
        <div class="hbar" data-tip="${esc(r.tip || r.label + ": " + r.value)}">
          <span class="lab">${o.swatches ? VG.ui.swatch(r.id) + " " : ""}${esc(r.label)}${r.note ? `<em>${esc(r.note)}</em>` : ""}</span>
          <span class="track"><span class="fill" style="width:${(r.value / max) * 100}%;background:${r.color || "var(--accent)"}"></span></span>
          <span class="val">${esc(r.valueText ?? r.value)}</span>
        </div>`).join("")}</div>`;
    },

    // Two measures on one scale, per row. rows: [{ label, values:[a,b], tip }], series: [{ name, color }]
    grouped(rows, series, fmt) {
      const max = Math.max(1, ...rows.flatMap((r) => r.values));
      const f = fmt || ((v) => v);
      return `<div class="legend">${series.map((s) => `<span><span class="swatch" style="background:${s.color}"></span>${esc(s.name)}</span>`).join("")}</div>
        <div class="hbars">${rows.map((r) => `
        <div class="hbar grouped" data-tip="${esc(r.tip)}">
          <span class="lab">${esc(r.label)}</span>
          <span class="track">${r.values.map((v, i) => `<span class="fill" style="width:${(v / max) * 100}%;background:${series[i].color}"></span>`).join("")}</span>
          <span class="val">${r.values.map((v) => `<span>${esc(f(v))}</span>`).join("")}</span>
        </div>`).join("")}</div>`;
    },

    // Vertical columns. rows: [{ label, value, tip, hi?, parts?: [{value,color}] }]
    columns(rows, opts) {
      const o = opts || {};
      const top = niceMax(Math.max(1, ...rows.map((r) => r.value)));
      const ticks = top % 2 === 0 ? [0, top / 2, top] : [0, top];
      return `<div class="cols" style="--h:${o.height || 180}px">
        ${ticks.map((t) => `<div class="gl${t === 0 ? " base" : ""}" style="bottom:${(t / top) * 100}%"><span>${t}</span></div>`).join("")}
        <div class="bars">${rows.map((r) => {
          const inner = r.parts
            ? `<div class="stack">${r.parts.slice().reverse().map((p) => `<div class="b" style="height:${(p.value / top) * (o.height || 180)}px;background:${p.color}"></div>`).join("")}</div>`
            : `<div class="b" style="height:${(r.value / top) * 100}%;${o.color ? "background:" + o.color : ""}"></div>`;
          return `<div class="col${r.hi ? " hi" : ""}" data-tip="${esc(r.tip)}"><span class="v">${esc(r.value)}</span>${inner}<span class="x">${esc(r.label)}</span></div>`;
        }).join("")}</div></div>`;
    },

    // One stacked bar. parts: [{ value, color, label }]
    segmented(parts) {
      const total = parts.reduce((a, p) => a + p.value, 0) || 1;
      return `<div class="seg">${parts.filter((p) => p.value > 0).map((p) =>
        `<span style="flex:${p.value / total};background:${p.color}" data-tip="${esc(p.label + ": " + p.value)}"></span>`).join("")}</div>`;
    },

    // Stage strip: one bar split by stage, counts written in each part, legend below.
    // labels: ladder names; counts: steps at each stage.
    strip(labels, counts) {
      const total = counts.reduce((a, b) => a + b, 0) || 1;
      const color = (i) => this.stageColor(i, labels.length);
      const light = (i) => labels.length > 1 && i / (labels.length - 1) < 0.35;
      return `<div class="strip">${counts.map((n, i) => n > 0 ? `<span style="flex:${n / total};background:${color(i)};color:${light(i) ? "var(--ink)" : "#fff"}"
          data-tip="${esc(`${labels[i]}\n${n} of ${total} steps`)}">${n}</span>` : "").join("")}</div>
        <div class="strip-key">${labels.map((l, i) => `<span class="${counts[i] ? "" : "zero"}"><i style="background:${color(i)}"></i>${esc(l)} <b>${counts[i]}</b></span>`).join("")}</div>`;
    },

    // Progress ring 0..1
    ring(frac, size, label) {
      const s = size || 64, r = s / 2 - 6, c = 2 * Math.PI * r;
      const f = Math.max(0, Math.min(1, frac || 0));
      return `<svg class="ring" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" role="img" aria-label="${esc(label || Math.round(f * 100) + "%")}">
        <circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="none" stroke="var(--grid)" stroke-width="7"></circle>
        <circle class="v" cx="${s / 2}" cy="${s / 2}" r="${r}" stroke-width="7" stroke-dasharray="${f * c} ${c}" transform="rotate(-90 ${s / 2} ${s / 2})"></circle>
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central">${Math.round(f * 100)}%</text></svg>`;
    },

    // Stage over time for one step. points: [{ label, index|null, tip }], levels: ladder labels
    stepLine(points, levels) {
      // W close to the card's real width so text is drawn at about its set size; padR leaves room for the last month label.
      const W = 960, rowH = 30, padL = 220, padR = 40, padT = 12, padB = 30;
      const H = padT + rowH * (levels.length - 1) + padB;
      const n = Math.max(points.length, 2);
      const x = (i) => padL + ((W - padL - padR) * i) / (n - 1);
      const y = (lv) => padT + rowH * (levels.length - 1 - lv);
      let path = "", prev = null;
      points.forEach((p, i) => {
        if (p.index == null) { prev = null; return; }
        if (prev === null) path += `M${x(i)},${y(p.index)}`;
        else path += `H${x(i)}V${y(p.index)}`;
        prev = p.index;
      });
      return `<svg class="stepline" viewBox="0 0 ${W} ${H}" role="img" aria-label="Stage by month">
        ${levels.map((l, k) => `<line class="gl" x1="${padL}" x2="${W - padR}" y1="${y(k)}" y2="${y(k)}"></line>
          <text class="lab" x="${padL - 10}" y="${y(k) + 4}" text-anchor="end">${esc(l.length > 34 ? l.slice(0, 33) + "…" : l)}</text>`).join("")}
        <path class="ln" d="${path}"></path>
        ${points.map((p, i) => `<text class="lab" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(p.label)}</text>
          ${p.index == null ? "" : `<circle class="pt" cx="${x(i)}" cy="${y(p.index)}" r="5"><title>${esc(p.tip)}</title></circle>`}`).join("")}
      </svg>`;
    },

    stageColor(i, len) {
      // ordinal blue ramp, lightest step still visible on the surface
      const k = len <= 1 ? 9 : Math.round(1 + (i * 8) / (len - 1));
      return `var(--s${k})`;
    },
  };
})();
