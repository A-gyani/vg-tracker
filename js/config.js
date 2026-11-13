// Settings that change rarely. Edit here, not in the screens.
window.VG = window.VG || {};

VG.config = {
  appName: "Viksit Gujarat Implementation Roadmap Progress Monitor",
  shortName: "VG Roadmap Monitor", // phone top bar only

  // "local" = browser storage + pick a test user (test mode; data stays in each person's browser).
  // "firebase" = shared online data and real logins. Switch to it once the settings below are filled in.
  backend: "local",

  // Firebase project settings (Firebase console > Project settings > Your apps > Web app > Config).
  // These are not secret: access is controlled by Firebase sign-in and security rules, not by hiding them.
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  },

  // First month that can be reported (YYYY-MM).
  startMonth: "2026-04",

  // Financial-year columns used for targets.
  // Booklet year keys: "2025" = FY 2024-25 ... "2030" = FY 2029-30. Earlier years hold past targets and achieved figures.
  targetYears: ["2022", "2023", "2024", "2025", "2026", "2027", "2028", "2029", "2030"],

  // How each KPI is counted, and its unit (set per KPI in the step list).
  kpiBasis: { cumulative: "Running total", yearly: "Yearly", "one-time": "One-time task" },
  kpiUnits: { number: "Number", lakh: "Lakh", crore: "₹ crore", milestones: "Milestones" },

  offices: [
    { id: "CYSCA", short: "CYSCA", name: "Commissioner, Youth Services & Cultural Activities" },
    { id: "SAG", short: "Sports Authority", name: "Sports Authority of Gujarat" },
    { id: "ARCH", short: "Archaeology", name: "Directorate of Archaeology" },
    { id: "MUS", short: "Museums", name: "Directorate of Museums" },
    { id: "GSA", short: "Sahitya Akademi", name: "Gujarat Sahitya Akademi" },
  ],

  // Current position: a step follows one ladder, chosen by its type.
  ladders: {
    new: [
      "Not started",
      "Concept note prepared",
      "Proposal sent to Finance Department",
      "Finance Department concurrence received",
      "Administrative approval / GR issued",
      "Budget provision made",
      "Agency / vendor selected",
      "Implementation started",
      "Completed / operational",
    ],
    ongoing: [
      "Annual plan prepared",
      "Funds released",
      "Activity in progress",
      "Partly achieved for the year",
      "Achieved for the year",
    ],
  },

  heldUpWith: [
    "Not held up",
    "Own office",
    "Department (SYCAD)",
    "Finance Department",
    "General Administration Department",
    "Other State department",
    "Government of India",
    "District administration",
    "Agency / vendor",
    "Court / legal",
  ],

  // Used only when the store is empty (local mode).
  seedUsers: [
    { id: "admin", name: "Admin", email: "admin@test", role: "admin", office: "" },
    { id: "secretary", name: "Secretary", email: "secretary@test", role: "viewer", office: "" },
    { id: "off-cysca", name: "Officer, CYSCA", email: "cysca@test", role: "officer", office: "CYSCA" },
    { id: "off-sag", name: "Officer, SAG", email: "sag@test", role: "officer", office: "SAG" },
    { id: "off-arch", name: "Officer, Archaeology", email: "arch@test", role: "officer", office: "ARCH" },
    { id: "off-mus", name: "Officer, Museums", email: "mus@test", role: "officer", office: "MUS" },
    { id: "off-gsa", name: "Officer, Sahitya Akademi", email: "gsa@test", role: "officer", office: "GSA" },
  ],
};
