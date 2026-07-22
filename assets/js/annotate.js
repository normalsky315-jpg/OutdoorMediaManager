/* 共用的「畫框標記看板範圍」工具（篩選頁／主管報告頁共用） */
let annBoxes = [];
let annOnSave = null;
let annDrawing = null;
let annLayerBound = false;

function openAnnotator(src, existingBoxes, onSave) {
  annBoxes = (existingBoxes || []).map(b => ({ ...b }));
  annOnSave = onSave;
  const img = document.getElementById("annotateImg");
  img.onload = renderAnnBoxes;
  img.src = src;
  document.getElementById("annotateModal").classList.add("open");
  if (img.complete) renderAnnBoxes();
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
    layer.appendChild(el);
  });
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
