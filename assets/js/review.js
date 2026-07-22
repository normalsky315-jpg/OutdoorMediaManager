/* 吉隆天曜 OOH 照片篩選頁邏輯 */
let state = null;
let pinMap = null, pinMarker = null, pinTargetPointId = null;

function photoSrc(photo) {
  return photo.src || `assets/photos/${photo.file}`;
}

function gmapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

async function init() {
  state = await Store.load();
  render();
  bindGlobalEvents();
}

function render() {
  renderStats();
  renderGrid();
}

function renderStats() {
  const points = state.points;
  const totalPhotos = points.reduce((s, p) => s + keptPhotos(p).length, 0);
  const confirmed = points.filter(p => p.status === "confirmed").length;
  const unlocated = points.filter(p => !p.lat || !p.lng).length;
  document.getElementById("statBar").innerHTML = `
    <div class="stat-chip gold"><b>${points.length}</b> 候選點位</div>
    <div class="stat-chip"><b>${totalPhotos}</b> 張照片（已保留）</div>
    <div class="stat-chip ok"><b>${confirmed}</b> 已確認</div>
    <div class="stat-chip warn"><b>${unlocated}</b> 待定位</div>
  `;
  document.getElementById("bottomInfo").textContent =
    `共 ${points.length} 個候選點位，${totalPhotos} 張照片將納入報告`;
}

function renderGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  updateAreaList();
  if (state.points.length === 0) {
    grid.innerHTML = `<div class="empty-hint">目前沒有候選點位，請按上方「＋ 加入照片」開始。</div>`;
    return;
  }
  state.points.forEach(point => {
    grid.appendChild(renderCard(point));
  });
}

function updateAreaList() {
  const areas = [...new Set(state.points.map(p => p.area).filter(Boolean))];
  const dl = document.getElementById("areaList");
  if (dl) dl.innerHTML = areas.map(a => `<option value="${escapeAttr(a)}">`).join("");
}

function renderCard(point) {
  const el = document.createElement("div");
  el.className = "card";
  if (point.status === "confirmed") el.classList.add("confirmed");

  const hasLoc = point.lat && point.lng;

  const head = document.createElement("div");
  head.className = "card-head";
  head.innerHTML = `
    <input class="name" value="${escapeAttr(point.name)}" placeholder="幫這個點位命名">
    <select class="tier">
      <option value="">未評等</option>
      <option value="S">S 級</option>
      <option value="A">A 級</option>
      <option value="B">B 級</option>
      <option value="C">C 級</option>
    </select>
  `;
  head.querySelector(".tier").value = point.tier || "";
  head.querySelector(".name").addEventListener("input", e => {
    point.name = e.target.value;
    Store.save(state);
  });
  head.querySelector(".tier").addEventListener("change", e => {
    point.tier = e.target.value;
    Store.save(state);
    renderStats();
  });

  const areaRow = document.createElement("div");
  areaRow.className = "area-row";
  const areaInput = document.createElement("input");
  areaInput.type = "text";
  areaInput.setAttribute("list", "areaList");
  areaInput.placeholder = "🗺 區域名稱（例如：光明路×中庄路口）— 同一區域的多個點位可填一樣的名字";
  areaInput.value = point.area || "";
  areaInput.addEventListener("input", e => {
    point.area = e.target.value;
    Store.save(state);
  });
  areaInput.addEventListener("change", updateAreaList);
  areaRow.appendChild(areaInput);

  const thumbs = document.createElement("div");
  thumbs.className = "thumbs";
  (point.photos || []).forEach(photo => {
    const t = document.createElement("div");
    t.className = "thumb" + (photo.keep === false ? " discarded" : "");
    const img = document.createElement("img");
    img.src = photoSrc(photo);
    img.loading = "lazy";
    img.onerror = () => {
      img.replaceWith(Object.assign(document.createElement("div"), {
        className: "fallback",
        innerHTML: `📷<br>${photo.file || ""}<br>(需 Safari 預覽)`
      }));
    };
    img.addEventListener("click", () => {
      if (photo.keep !== false) openLightbox(photoSrc(photo));
    });
    const rm = document.createElement("button");
    rm.className = "rm";
    rm.textContent = photo.keep === false ? "↺" : "✕";
    rm.title = photo.keep === false ? "恢復這張照片" : "移除這張照片";
    rm.addEventListener("click", ev => {
      ev.stopPropagation();
      photo.keep = photo.keep === false ? true : false;
      Store.save(state);
      render();
    });
    t.appendChild(img);
    t.appendChild(rm);
    thumbs.appendChild(t);
  });

  const meta = document.createElement("div");
  meta.className = "meta-row";
  meta.innerHTML = hasLoc
    ? `<span>📅 ${point.visitDate || "—"}</span><span>📍 ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}</span><a href="${gmapsLink(point.lat, point.lng)}" target="_blank" rel="noopener">在 Google 地圖開啟</a>`
    : `<span>📅 ${point.visitDate || "—"}</span>`;

  const facing = document.createElement("input");
  facing.type = "text";
  facing.className = "note";
  facing.style.marginBottom = "0";
  facing.placeholder = "朝向／座向（例如：面向大寮、南向車道）— 同地點不同朝向請用「複製點位」分開建卡";
  facing.value = point.facing || "";
  facing.addEventListener("input", e => {
    point.facing = e.target.value;
    Store.save(state);
  });

  const note = document.createElement("textarea");
  note.className = "note";
  note.placeholder = "現場筆記（租金行情、房東聯絡方式、備註...）";
  note.value = point.notes || "";
  note.addEventListener("input", e => {
    point.notes = e.target.value;
    Store.save(state);
  });

  const actions = document.createElement("div");
  actions.className = "card-actions";
  const dupBtn = document.createElement("button");
  dupBtn.className = "btn small";
  dupBtn.textContent = "➕ 複製點位（不同朝向）";
  dupBtn.title = "同一個地點但看板朝向/面向不同時，複製成獨立點位再分別勾選照片";
  dupBtn.addEventListener("click", () => {
    const clone = JSON.parse(JSON.stringify(point));
    clone.id = Store.nextId(state);
    clone.name = point.name + "（另一面）";
    const idx = state.points.findIndex(p => p.id === point.id);
    state.points.splice(idx + 1, 0, clone);
    Store.save(state);
    render();
  });
  const discardBtn = document.createElement("button");
  discardBtn.className = "btn small danger";
  discardBtn.textContent = "捨棄此點位";
  discardBtn.addEventListener("click", () => {
    if (confirm(`確定要捨棄「${point.name}」這個點位嗎？`)) {
      state.points = state.points.filter(p => p.id !== point.id);
      Store.save(state);
      render();
    }
  });
  actions.appendChild(dupBtn);
  actions.appendChild(discardBtn);

  let unlocatedNote = null;
  if (!hasLoc) {
    unlocatedNote = document.createElement("div");
    unlocatedNote.className = "unlocated-note";
    unlocatedNote.innerHTML = `⚠️ 這張照片沒有 GPS 資訊（例如廠商傳來的 POP 卡片）。可以先在下方填地址、點選地圖標記位置；如果暫時不知道確切位置，也可以先不標記，直接送出——之後在主管報告頁面的「列表模式」仍看得到、可以再補標記。`;
    const addrRow = document.createElement("input");
    addrRow.type = "text";
    addrRow.className = "note";
    addrRow.style.marginBottom = "0";
    addrRow.placeholder = "地址／位置描述（廠商提供的文字地址，之後可用來對照地圖）";
    addrRow.value = point.address || "";
    addrRow.addEventListener("input", e => {
      point.address = e.target.value;
      Store.save(state);
    });
    unlocatedNote.appendChild(document.createElement("br"));
    unlocatedNote.appendChild(addrRow);
    const pinBtn = document.createElement("button");
    pinBtn.className = "btn small";
    pinBtn.textContent = "📍 在地圖上標記位置";
    pinBtn.addEventListener("click", () => openPinModal(point.id));
    actions.appendChild(pinBtn);
  }

  el.appendChild(head);
  el.appendChild(areaRow);
  el.appendChild(thumbs);
  el.appendChild(meta);
  el.appendChild(facing);
  el.appendChild(note);
  if (unlocatedNote) el.appendChild(unlocatedNote);
  el.appendChild(actions);
  return el;
}

function escapeAttr(s) {
  return (s || "").replace(/"/g, "&quot;");
}

function openLightbox(src) {
  document.getElementById("lightboxImg").src = src;
  document.getElementById("lightbox").classList.add("open");
}

function bindGlobalEvents() {
  document.getElementById("lightboxClose").addEventListener("click", () => {
    document.getElementById("lightbox").classList.remove("open");
  });
  document.getElementById("lightbox").addEventListener("click", e => {
    if (e.target.id === "lightbox") e.target.classList.remove("open");
  });

  document.getElementById("expandAll").addEventListener("click", () => {
    document.querySelectorAll(".card").forEach(c => c.classList.remove("collapsed"));
  });
  document.getElementById("collapseAll").addEventListener("click", () => {
    document.querySelectorAll(".card .meta-row, .card .note, .card .card-actions .unlocated-note").forEach(x => {});
  });

  document.getElementById("addPhotoBtn").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });
  document.getElementById("fileInput").addEventListener("change", handleNewFiles);

  document.getElementById("exportBackup").addEventListener("click", () => Store.exportJSON(state));
  document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importInput").click());
  document.getElementById("importInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (confirm("匯入備份將會覆蓋目前所有資料，確定嗎？")) {
      state = await Store.importJSONFile(file);
      render();
    }
    e.target.value = "";
  });

  document.getElementById("discardAllPending").addEventListener("click", () => {
    if (confirm("確定要捨棄所有「沒有保留任何照片」的空點位嗎？（沒有 GPS 但有照片的點位不會被捨棄）")) {
      state.points = state.points.filter(p => keptPhotos(p).length > 0);
      Store.save(state);
      render();
    }
  });

  document.getElementById("confirmAllBtn").addEventListener("click", () => {
    const valid = state.points.filter(p => keptPhotos(p).length > 0);
    if (valid.length === 0) {
      alert("目前沒有可用的點位（至少需保留一張照片）");
      return;
    }
    const unlocatedCount = valid.filter(p => !p.lat || !p.lng).length;
    if (unlocatedCount > 0 && !confirm(`有 ${unlocatedCount} 個點位還沒有標記地圖位置（例如廠商 POP 卡片），它們仍會被送到主管報告的列表模式，之後可以再補標記。要繼續嗎？`)) {
      return;
    }
    state.points.forEach(p => {
      if (keptPhotos(p).length > 0) p.status = "confirmed";
    });
    Store.save(state);
    window.location.href = "dashboard.html";
  });

  document.getElementById("pinCancel").addEventListener("click", closePinModal);
  document.getElementById("pinConfirm").addEventListener("click", () => {
    const point = state.points.find(p => p.id === pinTargetPointId);
    if (point && pinMarker) {
      const ll = pinMarker.getLatLng();
      point.lat = +ll.lat.toFixed(6);
      point.lng = +ll.lng.toFixed(6);
      Store.save(state);
      closePinModal();
      render();
    }
  });
}

function openPinModal(pointId) {
  pinTargetPointId = pointId;
  document.getElementById("pinModal").classList.add("open");
  document.getElementById("pinConfirm").disabled = true;
  setTimeout(() => {
    if (!pinMap) {
      pinMap = L.map("pinMap").setView([22.610, 120.385], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap"
      }).addTo(pinMap);
      pinMap.on("click", e => {
        if (pinMarker) pinMap.removeLayer(pinMarker);
        pinMarker = L.marker(e.latlng).addTo(pinMap);
        document.getElementById("pinConfirm").disabled = false;
      });
    } else {
      pinMap.invalidateSize();
    }
  }, 50);
}

function closePinModal() {
  document.getElementById("pinModal").classList.remove("open");
  if (pinMarker && pinMap) { pinMap.removeLayer(pinMarker); pinMarker = null; }
  pinTargetPointId = null;
}

async function handleNewFiles(e) {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;
  for (const file of files) {
    const { lat, lng } = await readGPS(file);
    const src = await fileToDataURL(file);
    const now = new Date();
    const point = {
      id: Store.nextId(state),
      name: file.name.replace(/\.[^.]+$/, ""),
      area: "",
      facing: "",
      address: "",
      status: "pending",
      tier: "",
      lat: lat || null,
      lng: lng || null,
      visitDate: now.toISOString().slice(0, 10).replace(/-/g, "/"),
      photos: [{ file: file.name, keep: true, src }],
      contact: "", phone: "", rent: "", deposit: "",
      size: "", material: "", lighting: "", direction: "",
      visibility: "", competitor: "", notes: ""
    };
    state.points.push(point);
  }
  Store.save(state);
  render();
  e.target.value = "";
}

function fileToDataURL(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function readGPS(file) {
  return new Promise(resolve => {
    if (typeof EXIF === "undefined" || !/jpe?g$/i.test(file.name)) {
      resolve({ lat: null, lng: null });
      return;
    }
    try {
      EXIF.getData(file, function () {
        const lat = EXIF.getTag(this, "GPSLatitude");
        const lng = EXIF.getTag(this, "GPSLongitude");
        const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
        const lngRef = EXIF.getTag(this, "GPSLongitudeRef") || "E";
        if (!lat || !lng) { resolve({ lat: null, lng: null }); return; }
        const toDeg = arr => arr[0] + arr[1] / 60 + arr[2] / 3600;
        let latitude = toDeg(lat);
        let longitude = toDeg(lng);
        if (latRef === "S") latitude = -latitude;
        if (lngRef === "W") longitude = -longitude;
        resolve({ lat: latitude, lng: longitude });
      });
    } catch (err) {
      resolve({ lat: null, lng: null });
    }
  });
}

init();
