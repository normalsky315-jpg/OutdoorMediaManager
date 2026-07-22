/* 共用的「畫框標記看板範圍」工具（篩選頁／主管報告頁共用） */
let annBoxes = [];
let annOnSave = null;
let annDrawing = null;
let annLayerBound = false;

function openAnnotator(src, existingBoxes, onSave) {
  annBoxes = (existingBoxes || []).map(b => ({ ...b }));
  annOnSave = onSave;
  const img = document.getElementById("annotateImg");
  const setup = () => {
    fitImageToBox(img, Math.min(window.innerWidth * 0.88, 820), Math.min(window.innerHeight * 0.64, 680));
    renderAnnBoxes();
  };
  img.onload = setup;
  img.src = src;
  document.getElementById("annotateModal").classList.add("open");
  if (img.complete && img.naturalWidth) setup();
  bindAnnotateLayer();
}

function closeAnnotator() {
  document.getElementById("annotateModal").classList.remove("open");
  annDrawing = null;
}

function renderAnnBoxes() {
  const layer = document.getElementById("annotateLayer");
  if (!layer) return;
  layer.innerHTML = "";
  annBoxes.forEach((b, i) => {
    const el = boxOverlayDiv(b);
    const del = document.createElement("button");
    del.className = "ann-del";
    del.textContent = "✕";
    del.addEventListener("pointerdown", ev => ev.stopPropagation());
    del.addEventListener("click", ev => {
      ev.stopPropagation();
      annBoxes.splice(i, 1);
      renderAnnBoxes();
    });
    el.appendChild(del);

    ["nw", "ne", "sw", "se"].forEach(corner => {
      const handle = document.createElement("div");
      handle.className = "ann-handle ann-handle-" + corner;
      handle.addEventListener("pointerdown", ev => {
        ev.stopPropagation();
        startResize(ev, i, corner, layer);
      });
      el.appendChild(handle);
    });

    layer.appendChild(el);
  });
}

function startResize(e, index, corner, layer) {
  const rect = layer.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const box = annBoxes[index];
  const fixedX = corner.includes("w") ? box.x + box.w : box.x;
  const fixedY = corner.includes("n") ? box.y + box.h : box.y;
  layer.setPointerCapture(e.pointerId);

  function onMove(ev) {
    const cx = clamp01((ev.clientX - rect.left) / rect.width);
    const cy = clamp01((ev.clientY - rect.top) / rect.height);
    annBoxes[index] = {
      x: Math.min(fixedX, cx), y: Math.min(fixedY, cy),
      w: Math.abs(cx - fixedX), h: Math.abs(cy - fixedY)
    };
    renderAnnBoxes();
  }
  function onUp() {
    layer.removeEventListener("pointermove", onMove);
    layer.removeEventListener("pointerup", onUp);
  }
  layer.addEventListener("pointermove", onMove);
  layer.addEventListener("pointerup", onUp);
}

function boxOverlayDiv(b) {
  const el = document.createElement("div");
  el.className = "ann-box";
  el.style.left = (b.x * 100) + "%";
  el.style.top = (b.y * 100) + "%";
  el.style.width = (b.w * 100) + "%";
  el.style.height = (b.h * 100) + "%";
  return el;
}

function bindAnnotateLayer() {
  if (annLayerBound) return;
  annLayerBound = true;
  const layer = document.getElementById("annotateLayer");
  let start = null, tempEl = null;

  layer.addEventListener("pointerdown", e => {
    if (e.target !== layer) return;
    const rect = layer.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    start = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    tempEl = document.createElement("div");
    tempEl.className = "ann-box";
    layer.appendChild(tempEl);
    layer.setPointerCapture(e.pointerId);
  });

  layer.addEventListener("pointermove", e => {
    if (!start || !tempEl) return;
    const rect = layer.getBoundingClientRect();
    const cur = { x: clamp01((e.clientX - rect.left) / rect.width), y: clamp01((e.clientY - rect.top) / rect.height) };
    const x = Math.min(start.x, cur.x), y = Math.min(start.y, cur.y);
    const w = Math.abs(cur.x - start.x), h = Math.abs(cur.y - start.y);
    tempEl.style.left = (x * 100) + "%";
    tempEl.style.top = (y * 100) + "%";
    tempEl.style.width = (w * 100) + "%";
    tempEl.style.height = (h * 100) + "%";
    tempEl._box = { x, y, w, h };
  });

  layer.addEventListener("pointerup", () => {
    const box = tempEl && tempEl._box;
    if (tempEl) layer.removeChild(tempEl);
    tempEl = null;
    start = null;
    if (box && box.w > 0.02 && box.h > 0.02) {
      annBoxes.push(box);
      renderAnnBoxes();
    }
  });
}

function clamp01(n) { return Math.max(0, Math.min(1, n)); }

/* 讓照片依比例放大/縮小以「精確」填滿目標尺寸（不留白邊），小圖也會放大到舒適大小 */
function fitImageToBox(img, maxW, maxH) {
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) return;
  const scale = Math.min(maxW / nw, maxH / nh);
  img.style.width = (nw * scale) + "px";
  img.style.height = (nh * scale) + "px";
}

/* 依照 object-fit:cover 或 contain 的實際顯示比例，把百分比方框正確疊加在縮圖／相簿容器上 */
function positionOverlayBoxes(container, img, boxes, mode) {
  container.querySelectorAll(".box-outline").forEach(el => el.remove());
  if (!boxes || !boxes.length) return;
  const cw = container.clientWidth, ch = container.clientHeight;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!cw || !ch || !nw || !nh) return;
  const scale = mode === "contain" ? Math.min(cw / nw, ch / nh) : Math.max(cw / nw, ch / nh);
  const rw = nw * scale, rh = nh * scale;
  const ox = (cw - rw) / 2, oy = (ch - rh) / 2;
  boxes.forEach(b => {
    const el = document.createElement("div");
    el.className = "box-outline";
    el.style.left = (ox + b.x * rw) + "px";
    el.style.top = (oy + b.y * rh) + "px";
    el.style.width = (b.w * rw) + "px";
    el.style.height = (b.h * rh) + "px";
    container.appendChild(el);
  });
}

function bindAnnotateModalChrome() {
  const clearBtn = document.getElementById("annotateClearBtn");
  const doneBtn = document.getElementById("annotateDoneBtn");
  const closeBtn = document.getElementById("annotateCloseBtn");
  if (clearBtn) clearBtn.addEventListener("click", () => { annBoxes = []; renderAnnBoxes(); });
  if (doneBtn) doneBtn.addEventListener("click", () => {
    if (annOnSave) annOnSave(annBoxes.map(b => ({ ...b })));
    closeAnnotator();
  });
  if (closeBtn) closeBtn.addEventListener("click", closeAnnotator);
}

document.addEventListener("DOMContentLoaded", bindAnnotateModalChrome);
