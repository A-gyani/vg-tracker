// Sign-in. Local mode: pick a test user. Firebase mode (last stage): email + password.
(function () {
  const VG = window.VG;
  const KEY = "vg:session";
  let current = null;

  function remember(id) {
    try { id ? sessionStorage.setItem(KEY, id) : sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }
  function recall() {
    try { return sessionStorage.getItem(KEY); } catch (e) { return null; }
  }

  VG.auth = {
    user() { return current; },

    async restore() {
      const id = recall();
      if (!id) return null;
      const u = (await VG.store.listUsers()).find((x) => x.id === id && x.active !== false);
      current = u || null;
      return current;
    },

    async signInAs(userId) {
      const u = (await VG.store.listUsers()).find((x) => x.id === userId && x.active !== false);
      if (!u) throw new Error("User not found.");
      current = u;
      remember(u.id);
      return u;
    },

    signOut() {
      current = null;
      remember(null);
    },

    can(role) {
      return !!current && (Array.isArray(role) ? role.includes(current.role) : current.role === role);
    },
  };
})();
