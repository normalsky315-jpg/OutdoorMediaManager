/* 吉隆天曜 OOH Media Manager - 共用資料層 (localStorage + JSON 種子資料) */
const STORE_KEY = "ooh_jilong_v1";
const SEED_URL = "data/points.json";

const Store = {
  async load() {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* fall through to reseed */ }
    }
    const seed = await fetch(SEED_URL).then(r => r.json());
    const state = { points: seed, updatedAt: new Date().toISOString() };
    Store.save(state);
    return state;
  },

  save(state) {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  },

  async mergeNewPending(state, newPoints) {
    state.points = state.points.concat(newPoints);
    Store.save(state);
    return state;
  },

  exportJSON(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ooh_jilong_backup_${Date.now()}.json`;
    a.click();
  },

  async importJSONFile(file) {
    const text = await file.text();
    const state = JSON.parse(text);
    Store.save(state);
    return state;
  },

  nextId(state) {
    const nums = state.points
      .map(p => parseInt((p.id || "P00").replace(/\D/g, ""), 10))
      .filter(n => !isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return "P" + String(max + 1).padStart(2, "0");
  }
};

function tierScore(p) {
  const order = { S: 4, A: 3, B: 2, C: 1, "": 0 };
  return order[p.tier] || 0;
}

function keptPhotos(p) {
  return (p.photos || []).filter(ph => ph.keep !== false);
}
