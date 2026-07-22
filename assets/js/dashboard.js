/* 吉隆天曜 OOH Media Manager - 主管報告主控台 */
let state = null;
let map = null;
let markers = {};
let selectedId = null;
let mode = "map";
let pinDropArmed = false;
let awaitingPinFor = null;

function photoSrc(photo) {
  return photo.src || `assets/photos/${photo.file}`;
}
function gmapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
function locatedPoints() {
  return state.points.filter(p => p.lat && p.lng);
}
function tierColor(tier) {
  return { S: "#c9a24b", A: "#2f9e5c", B: "#3a6ea5", C: "#8a8378" }[tier] || "#163828";
}

async function init() {
  state = await Store.load();
  initMap();
  renderAll();
  bindEvents();
}

function initMap() {
  map = L.map("map").setView([22.610, 120.385], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
  map.on("click", e => {
    if (pinDropArmed) {
      pinDropArmed = false;
      hideBanner();
      createPointAt(e.latlng.lat, e.latlng.lng);
    } else if (awaitingPinFor) {
      const point = state.points.find(p => p.id === awaitingPinFor);
      if (point) {
        point.lat = +e.latlng.lat.toFixed(6);
        point.lng = +e.latlng.lng.toFixed(6);
        Store.save(state);
      }
      awaitingPinFor = null;
      hideBanner();
      renderAll();
    }
  });
}

function markerIcon(tier) {
  const color = tierColor(tier);
  return L.divIcon({
    className: "",
    html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22]
  });
}

function renderAll() {
  renderStats();
  renderMarkers();
  renderDetail();
  renderList();
}

function renderStats() {
  const pts = state.points;
  const tiers = { S: 0, A: 0, B: 0, C: 0 };
  let needsInfo = 0;
  let unlocated = 0;
  pts.forEach(p => {
    if (p.tier) tiers[p.tier] = (tiers[p.tier] || 0) + 1;
    if (!p.contact && !p.phone) needsInfo++;
    if (!p.lat || !p.lng) unlocated++;
  });
  document.getElementById("statBar").innerHTML = `
    <div class="stat-chip gold"><b>${pts.length}</b> 個點位</div>
    <div class="stat-chip"><b>${tiers.S || 0}</b> S 級</div>
    <div class="stat-chip"><b>${tiers.A || 0}</b> A 級</div>
    <div class="stat-chip"><b>${tiers.B || 0}</b> B 級</div>
    <div class="stat-chip"><b>${tiers.C || 0}</b> C 級</div>
    <div class="stat-chip warn"><b>${needsInfo}</b> 待補聯絡資料</div>
    <div class="stat-chip warn"><b>${unlocated}</b> 尚未定位</div>
  `;
}

function renderMarkers() {
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};
  const pts = locatedPoints();
  pts.forEach(p => {
    const m = L.marker([p.lat, p.lng], { icon: markerIcon(p.tier) }).addTo(map);
    m.bindTooltip(p.area ? `${p.area} · ${p.name}` : p.name, { direction: "top" });
    m.on("click", () => { selectedId = p.id; renderDetail(); });
    markers[p.id] = m;
  });
  if (pts.length && !selectedId) {
    const bounds = L.latLngBounds(pts.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [30, 30] });
  }
}

function renderDetail() {
  const el = document.getElementById("detailPane");
  const point = state.points.find(p => p.id === selectedId);
  if (!point) {
    el.innerHTML = `<div class="empty-detail">點選左側地圖上的點位，即可檢視與編輯資料。</div>`;
    return;
  }
  el.innerHTML = "";

  const titleRow = document.createElement("div");
  titleRow.className = "d-title";
  titleRow.innerHTML = `<input class="pname" value="${escapeAttr(point.name)}">
    <select class="tierSel">
      <option value="">未評等</option>
      <option value="S">S 級</option>
      <option value="A">A 級</option>
      <option value="B">B 級</option>
      <option value="C">C 級</option>
    </select>`;
  titleRow.querySelector(".tierSel").value = point.tier || "";
  titleRow.querySelector(".pname").addEventListener("input", e => { point.name = e.target.value; save(); markers[point.id] && markers[point.id].setTooltipContent(point.name); });
  titleRow.querySelector(".tierSel").addEventListener("change", e => {
    point.tier = e.target.value; save(); renderMarkers();
    const m = markers[point.id]; if (m) m.setIcon(markerIcon(point.tier));
  });
  el.appendChild(titleRow);

  const areaRow = document.createElement("div");
  areaRow.className = "d-gps";
  areaRow.innerHTML = `<input type="text" placeholder="🗺 區域名稱（同一區域多個點位可填一樣）" value="${escapeAttr(point.area || "")}" style="width:100%;border:1px solid var(--line);border-radius:6px;padding:5px 8px;font-size:12.5px;background:#fdfcf8;color:var(--green);margin-bottom:6px;">`;
  areaRow.querySelector("input").addEventListener("input", e => { point.area = e.target.value; save(); renderMarkers(); });
  el.appendChild(areaRow);

  const hasLoc = point.lat && point.lng;
  if (hasLoc) {
    const gps = document.createElement("div");
    gps.className = "d-gps";
    gps.innerHTML = `📍 ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} · <a href="${gmapsLink(point.lat, point.lng)}" target="_blank" rel="noopener">Google 地圖</a> ${point.visitDate ? " · 📅 " + point.visitDate : ""}`;
    el.appendChild(gps);
  } else {
    const warn = document.createElement("div");
    warn.className = "d-gps";
    warn.style.color = "var(--warn)";
    warn.textContent = `⚠️ 尚未定位（例如廠商 POP 卡片）${point.visitDate ? " · 📅 " + point.visitDate : ""}`;
    el.appendChild(warn);

    const locateBox = document.createElement("div");
    locateBox.className = "fields";
    locateBox.innerHTML = `
      <div class="field"><label>緯度</label><input type="text" class="manLat" placeholder="例如 22.6100"></div>
      <div class="field"><label>經度</label><input type="text" class="manLng" placeholder="例如 120.3900"></div>
    `;
    el.appendChild(locateBox);
    const locateActions = document.createElement("div");
    locateActions.className = "d-actions";
    const setCoordBtn = document.createElement("button");
    setCoordBtn.className = "btn small";
    setCoordBtn.textContent = "套用座標";
    setCoordBtn.addEventListener("click", () => {
      const lat = parseFloat(locateBox.querySelector(".manLat").value);
      const lng = parseFloat(locateBox.querySelector(".manLng").value);
      if (isNaN(lat) || isNaN(lng)) { alert("請輸入有效的緯度／經度數字"); return; }
      point.lat = lat; point.lng = lng;
      save();
      renderAll();
    });
    const pinOnMapBtn = document.createElement("button");
    pinOnMapBtn.className = "btn small";
    pinOnMapBtn.textContent = "📍 在地圖上點選位置";
    pinOnMapBtn.addEventListener("click", () => {
      awaitingPinFor = point.id;
      setMode("map");
      showBanner(`請在地圖上點擊，設定「${point.name}」的位置`);
    });
    locateActions.appendChild(setCoordBtn);
    locateActions.appendChild(pinOnMapBtn);
    el.appendChild(locateActions);
  }

  const gallery = document.createElement("div");
  gallery.className = "d-gallery";
  keptPhotos(point).forEach(photo => {
    const ph = document.createElement("div");
    ph.className = "ph";
    const img = document.createElement("img");
    img.src = photoSrc(photo);
    img.onerror = () => { ph.innerHTML = `<div class="fallback" style="font-size:9px;display:flex;align-items:center;justify-content:center;height:100%;color:#a89f8d;">📷</div>`; };
    img.addEventListener("click", () => openLightbox(photoSrc(photo), photo.boxes));
    const drawOverlay = () => positionOverlayBoxes(ph, img, photo.boxes, "cover");
    img.addEventListener("load", drawOverlay);
    if (img.complete && img.naturalWidth) drawOverlay();
    ph.appendChild(img);
    const annBtn = document.createElement("button");
    annBtn.className = "ann-mark";
    annBtn.textContent = "▭";
    annBtn.title = "標記看板範圍";
    annBtn.addEventListener("click", ev => {
      ev.stopPropagation();
      openAnnotator(photoSrc(photo), photo.boxes, boxes => {
        photo.boxes = boxes;
        save();
        renderDetail();
      });
    });
    ph.appendChild(annBtn);
    if (photo.boxes && photo.boxes.length) {
      const badge = document.createElement("span");
      badge.className = "box-badge";
      badge.textContent = "▭" + photo.boxes.length;
      ph.appendChild(badge);
    }
    gallery.appendChild(ph);
  });
  const addPh = document.createElement("div");
  addPh.className = "d-addphoto";
  addPh.textContent = "＋ 加入照片";
  addPh.addEventListener("click", () => addPhotoToPoint(point));
  gallery.appendChild(addPh);
  el.appendChild(gallery);

  const fields = [
    ["address", "地址／位置描述"], ["facing", "朝向／座向"],
    ["contact", "聯絡人"], ["phone", "電話"],
    ["rent", "月租金"], ["deposit", "押金"],
    ["size", "看板尺寸"], ["material", "材質"],
    ["lighting", "是否照明"], ["direction", "車流方向"],
    ["visibility", "可視距離"], ["competitor", "競品狀況"]
  ];
  const grid = document.createElement("div");
  grid.className = "fields";
  fields.forEach(([key, label]) => {
    const f = document.createElement("div");
    f.className = "field";
    f.innerHTML = `<label>${label}</label><input type="text" value="${escapeAttr(point[key] || "")}">`;
    f.querySelector("input").addEventListener("input", e => { point[key] = e.target.value; save(); if (key === "contact" || key === "phone") renderStats(); });
    grid.appendChild(f);
  });
  el.appendChild(grid);

  const noteWrap = document.createElement("div");
  noteWrap.className = "fields full";
  noteWrap.innerHTML = `<div class="field"><label>備註</label><textarea></textarea></div>`;
  noteWrap.querySelector("textarea").value = point.notes || "";
  noteWrap.querySelector("textarea").addEventListener("input", e => { point.notes = e.target.value; save(); });
  el.appendChild(noteWrap);

  const actions = document.createElement("div");
  actions.className = "d-actions";
  actions.innerHTML = `<button class="btn small danger" id="deletePointBtn">刪除此點位</button>`;
  el.appendChild(actions);
  document.getElementById("deletePointBtn").addEventListener("click", () => {
    if (confirm(`確定要刪除「${point.name}」嗎？`)) {
      state.points = state.points.filter(p => p.id !== point.id);
      selectedId = null;
      save();
      renderAll();
    }
  });
}

function renderList() {
  const tbody = document.getElementById("listBody");
  tbody.innerHTML = "";
  state.points
    .slice()
    .sort((a, b) => tierScore(b) - tierScore(a))
    .forEach(p => {
      const tr = document.createElement("tr");
      const missing = !p.contact && !p.phone;
      const hasLoc = p.lat && p.lng;
      tr.innerHTML = `
        <td>${escapeHtml(p.area || "—")}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${p.tier ? `<span class="badge tier-${p.tier}">${p.tier}</span>` : "—"}</td>
        <td>${escapeHtml(p.contact || "—")}</td>
        <td>${escapeHtml(p.phone || "—")}</td>
        <td>${escapeHtml(p.rent || "—")}</td>
        <td>${escapeHtml(p.size || "—")}</td>
        <td>${keptPhotos(p).length} 張</td>
        <td>${hasLoc ? `<span class="badge ok">已定位</span>` : `<span class="badge warn">尚未定位</span>`} ${missing ? `<span class="badge warn">待補資料</span>` : ""}</td>
      `;
      tr.addEventListener("click", () => {
        selectedId = p.id;
        setMode("map");
        renderDetail();
        const m = markers[p.id];
        if (m) { map.setView(m.getLatLng(), 16); m.openTooltip(); }
      });
      tbody.appendChild(tr);
    });
}

function escapeAttr(s) { return (s || "").replace(/"/g, "&quot;"); }
function escapeHtml(s) { return (s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function save() { Store.save(state); }

function openLightbox(src, boxes) {
  const img = document.getElementById("lightboxImg");
  const layer = document.getElementById("lightboxBoxes");
  const draw = () => {
    fitImageToBox(img, window.innerWidth * 0.92, window.innerHeight * 0.85);
    layer.innerHTML = "";
    (boxes || []).forEach(b => {
      const el = document.createElement("div");
      el.className = "box-outline";
      el.style.left = (b.x * 100) + "%";
      el.style.top = (b.y * 100) + "%";
      el.style.width = (b.w * 100) + "%";
      el.style.height = (b.h * 100) + "%";
      layer.appendChild(el);
    });
  };
  img.onload = draw;
  img.src = src;
  if (img.complete && img.naturalWidth) draw();
  document.getElementById("lightbox").classList.add("open");
}

function showBanner(text) {
  const b = document.getElementById("banner");
  b.textContent = text;
  b.classList.add("show");
}
function hideBanner() {
  document.getElementById("banner").classList.remove("show");
}

function setMode(m) {
  mode = m;
  document.getElementById("mapLayout").style.display = m === "map" ? "flex" : "none";
  document.getElementById("listPane").style.display = m === "list" ? "block" : "none";
  if (m === "map") setTimeout(() => map.invalidateSize(), 50);
}

function createPointAt(lat, lng) {
  const point = {
    id: Store.nextId(state),
    name: "新點位",
    area: "", facing: "", address: "",
    status: "confirmed",
    tier: "",
    lat: +lat.toFixed(6),
    lng: +lng.toFixed(6),
    visitDate: new Date().toISOString().slice(0, 10).replace(/-/g, "/"),
    photos: [],
    contact: "", phone: "", rent: "", deposit: "",
    size: "", material: "", lighting: "", direction: "",
    visibility: "", competitor: "", notes: ""
  };
  state.points.push(point);
  selectedId = point.id;
  save();
  renderAll();
}

async function addPhotoToPoint(point) {
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*"; input.multiple = true;
  input.onchange = async () => {
    for (const file of Array.from(input.files || [])) {
      const src = await filePreviewSrc(file);
      point.photos = point.photos || [];
      point.photos.push({ file: file.name, keep: true, src });
    }
    save();
    renderDetail();
  };
  input.click();
}

async function handleNewPhotosForPoints(files) {
  const noGpsQueue = [];
  for (const file of files) {
    const { lat, lng } = await readFileGPS(file);
    const src = await filePreviewSrc(file);
    const point = {
      id: Store.nextId(state),
      name: file.name.replace(/\.[^.]+$/, ""),
      area: "", facing: "", address: "",
      status: "confirmed",
      tier: "",
      lat: lat || null,
      lng: lng || null,
      visitDate: new Date().toISOString().slice(0, 10).replace(/-/g, "/"),
      photos: [{ file: file.name, keep: true, src }],
      contact: "", phone: "", rent: "", deposit: "",
      size: "", material: "", lighting: "", direction: "",
      visibility: "", competitor: "", notes: ""
    };
    state.points.push(point);
    if (!lat || !lng) noGpsQueue.push(point.id);
  }
  save();
  renderAll();
  if (noGpsQueue.length) {
    awaitingPinFor = noGpsQueue[0];
    showBanner(`「${state.points.find(p=>p.id===noGpsQueue[0]).name}」沒有 GPS，請點擊地圖設定其位置`);
    setMode("map");
  }
}

function buildPrintArea() {
  const pts = state.points.slice().sort((a, b) => tierScore(b) - tierScore(a));
  const area = document.getElementById("printArea");
  area.innerHTML = pts.map(p => `
    <div class="p-page">
      <h2>${p.area ? escapeHtml(p.area) + " · " : ""}${escapeHtml(p.name)} ${p.tier ? "（" + p.tier + " 級）" : ""}</h2>
      <div class="p-photos">
        ${keptPhotos(p).slice(0, 4).map(ph => `
          <div class="p-photo-wrap">
            <img src="${photoSrc(ph)}">
            ${(ph.boxes || []).map(b => `<div class="p-box" style="left:${b.x*100}%;top:${b.y*100}%;width:${b.w*100}%;height:${b.h*100}%;"></div>`).join("")}
          </div>
        `).join("")}
      </div>
      <table>
        <tr><td>GPS</td><td>${(p.lat && p.lng) ? p.lat + ", " + p.lng : "尚未定位"}</td><td>拍攝日期</td><td>${p.visitDate || "—"}</td></tr>
        <tr><td>地址</td><td>${escapeHtml(p.address || "—")}</td><td>朝向</td><td>${escapeHtml(p.facing || "—")}</td></tr>
        <tr><td>聯絡人</td><td>${escapeHtml(p.contact || "—")}</td><td>電話</td><td>${escapeHtml(p.phone || "—")}</td></tr>
        <tr><td>月租金</td><td>${escapeHtml(p.rent || "—")}</td><td>押金</td><td>${escapeHtml(p.deposit || "—")}</td></tr>
        <tr><td>尺寸</td><td>${escapeHtml(p.size || "—")}</td><td>材質</td><td>${escapeHtml(p.material || "—")}</td></tr>
        <tr><td>照明</td><td>${escapeHtml(p.lighting || "—")}</td><td>車流方向</td><td>${escapeHtml(p.direction || "—")}</td></tr>
        <tr><td>可視距離</td><td>${escapeHtml(p.visibility || "—")}</td><td>競品</td><td>${escapeHtml(p.competitor || "—")}</td></tr>
        <tr><td>備註</td><td colspan="3">${escapeHtml(p.notes || "—")}</td></tr>
      </table>
    </div>
  `).join("");
}

function exportExcel() {
  const pts = state.points;
  const rows = pts.map(p => ({
    "區域": p.area, "點位": p.name, "評等": p.tier,
    "GPS緯度": p.lat || "", "GPS經度": p.lng || "",
    "地址": p.address, "朝向": p.facing,
    "拍攝日期": p.visitDate, "聯絡人": p.contact, "電話": p.phone,
    "月租金": p.rent, "押金": p.deposit, "尺寸": p.size, "材質": p.material,
    "照明": p.lighting, "車流方向": p.direction, "可視距離": p.visibility,
    "競品": p.competitor, "照片數": keptPhotos(p).length, "備註": p.notes
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "點位資料");
  XLSX.writeFile(wb, `吉隆天曜OOH現勘報告_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function bindEvents() {
  document.getElementById("modeMapBtn").addEventListener("click", () => setMode("map"));
  document.getElementById("modeListBtn").addEventListener("click", () => setMode("list"));
  document.getElementById("addPinBtn").addEventListener("click", () => {
    pinDropArmed = true;
    setMode("map");
    showBanner("請在地圖上點擊，以新增點位");
  });
  document.getElementById("addPhotoBtn").addEventListener("click", () => document.getElementById("photoInput").click());
  document.getElementById("photoInput").addEventListener("change", e => {
    const files = Array.from(e.target.files || []);
    if (files.length) handleNewPhotosForPoints(files);
    e.target.value = "";
  });
  document.getElementById("exportExcelBtn").addEventListener("click", exportExcel);
  document.getElementById("printBtn").addEventListener("click", () => {
    buildPrintArea();
    setTimeout(() => window.print(), 100);
  });
  document.getElementById("lightboxClose").addEventListener("click", () => document.getElementById("lightbox").classList.remove("open"));
  document.getElementById("lightbox").addEventListener("click", e => { if (e.target.id === "lightbox") e.target.classList.remove("open"); });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    document.getElementById("lightbox").classList.remove("open");
    closeAnnotator();
  });
}

init();
