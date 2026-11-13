// Logos for the landing page and sign-in tiles.
// Files in app/img/logos/ (see app/img/README.txt):
//   SAG.png     Sports Authority of Gujarat (supplied by the user)
//   GSA.png     Gujarat Sahitya Akademi (supplied by the user)
//   emblem.png  State Emblem, as used by the Government of Gujarat (from sycd.gujarat.gov.in);
//               used for the department and for every office without its own logo file.
// To add an office's own logo later, add its file and list it in FILES.
(function () {
  const VG = window.VG;
  const FILES = { SAG: "SAG.png", GSA: "GSA.png" };

  // Line icons drawn for this app (24 x 24, stroke = currentColor); used in the default collage.
  const ICONS = {
    CYSCA: '<path d="M6.5 20.5 16 6.5M17.5 20.5 8 6.5"/><circle cx="16.9" cy="5.1" r="1.7"/><circle cx="7.1" cy="5.1" r="1.7"/><path d="M10.6 17.6h2.8"/>',
    SAG: '<path d="M8 2.5l3 7.2M16 2.5l-3 7.2"/><circle cx="12" cy="15" r="5.5"/><path d="M10.6 14l1.6-1.2v5"/>',
    ARCH: '<path d="M9.5 3.5h5M10.5 3.5v2.2C7.6 6.8 6.5 9 6.5 11.3c0 3 2.4 4.9 5.5 4.9s5.5-1.9 5.5-4.9c0-2.3-1.1-4.5-4-5.6V3.5"/><path d="M7 10.5h10"/><path d="M3 19.5h18M5 22h5M13.5 22h5.5"/>',
    MUS: '<path d="M12 2.2v2.2M6.2 9.6a5.8 5.8 0 0 1 11.6 0"/><path d="M4 9.8h16M7 9.8v8.4M12 9.8v8.4M17 9.8v8.4"/><path d="M5 18.2h14M3.5 21h17"/>',
    GSA: '<path d="M12 6.6C10 5 6.2 4.4 3 5.4v13.2c3.2-1 7-.4 9 1.2 2-1.6 5.8-2.2 9-1.2V5.4c-3.2-1-7-.4-9 1.2z"/><path d="M12 6.6v13.2M6 9.2c1.3-.2 2.5 0 3.5.4M6 12.4c1.3-.2 2.5 0 3.5.4M14.5 9.6c1-.4 2.2-.6 3.5-.4"/>',
  };

  VG.logos = {
    file(id) { return "img/logos/" + (FILES[id] || "emblem.png"); },
    // Round logo mark on white, ringed in the tile colour.
    mark(id, size) {
      return `<span class="olog" style="--c:var(--o-${VG.ui.esc(id)}, var(--v-main));${size ? `--s:${size}px` : ""}">
        <img src="${this.file(id)}" alt=""></span>`;
    },
    icon(id) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id] || ""}</svg>`; },
  };
})();
