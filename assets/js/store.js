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

function isHeicFile(file) {
  return /\.hei[cf]$/i.test(file.name) || file.type === "image/heic" || file.type === "image/heif";
}

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ]);
}

function fileToDataURL(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

/* 檢查瀏覽器能不能直接原生解碼這張圖（Safari 可以直接顯示 HEIC，不需要再轉檔） */
function canDecodeNatively(src) {
  return new Promise(resolve => {
    const img = new Image();
    const timer = setTimeout(() => resolve(false), 3000);
    img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth > 0); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = src;
  });
}

/* HEIC/HEIF 無法在大多數瀏覽器（Safari 除外）直接顯示，先轉成 JPEG 再預覽
   加上逾時保護：手機拍的大檔案轉檔可能要幾秒鐘，但絕不能整批卡住不動 */
async function filePreviewSrc(file) {
  const rawSrc = await fileToDataURL(file);
  if (!isHeicFile(file)) return rawSrc;

  /* Safari 等能原生解碼 HEIC 的瀏覽器，直接用原始檔案就好，不用跑轉檔 */
  if (await canDecodeNatively(rawSrc)) return rawSrc;

  if (typeof heic2any !== "undefined") {
    try {
      const converted = await withTimeout(
        heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 }),
        20000,
        null
      );
      if (converted) {
        const blob = Array.isArray(converted) ? converted[0] : converted;
        return await fileToDataURL(blob);
      }
    } catch (err) {
      console.error("HEIC 轉檔失敗:", file.name, err);
      /* 轉檔失敗就退回原始檔案，至少 Safari 還能預覽 */
    }
  }
  return rawSrc;
}

/* exifr 支援 JPEG/HEIC/PNG 等多種格式讀取 GPS，取代只支援 JPEG 的舊版 exif-js */
async function readFileGPS(file) {
  if (typeof exifr === "undefined") return { lat: null, lng: null };
  try {
    const gps = await withTimeout(exifr.gps(file), 8000, null);
    if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
      return { lat: gps.latitude, lng: gps.longitude };
    }
  } catch (err) {
    /* 讀取失敗（例如沒有 GPS 資訊）就當作沒有座標 */
  }
  return { lat: null, lng: null };
}
