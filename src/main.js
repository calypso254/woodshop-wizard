import "./style.css";

const UNIT_CONFIG = {
  in: {
    label: "in",
    sheetWidth: 48,
    sheetHeight: 96,
    kerf: 0.125,
    step: "0.0625",
    precision: 3,
  },
  cm: {
    label: "cm",
    sheetWidth: 122,
    sheetHeight: 244,
    kerf: 0.3,
    step: "0.1",
    precision: 2,
  },
};

const state = {
  unit: "in",
  sheet: {
    width: UNIT_CONFIG.in.sheetWidth,
    height: UNIT_CONFIG.in.sheetHeight,
  },
  kerf: UNIT_CONFIG.in.kerf,
  allowRotation: true,
  checklistMode: true,
  pieces: [],
  nextPieceId: 1,
  placements: [],
  unplaced: [],
  hitRegions: [],
  cutIds: new Set(),
  totals: null,
};

const app = document.querySelector("#app");
app.innerHTML = `
  <main class="page">
    <header class="card hero">
      <p class="eyebrow">DIY Sheet Optimizer</p>
      <h1>Shop Assistant</h1>
      <p class="lead">
        Plan cleaner cuts from one sheet, include blade kerf, and track progress on a touch-first visual map.
      </p>
    </header>

    <section class="card setup" aria-labelledby="setup-title">
      <div class="title-row">
        <h2 id="setup-title">Setup & Cut List</h2>
        <div class="unit-toggle" role="group" aria-label="Unit toggle">
          <button class="unit-btn active" data-unit-btn="in" type="button">Inches</button>
          <button class="unit-btn" data-unit-btn="cm" type="button">cm</button>
        </div>
      </div>

      <div class="field-grid">
        <label class="field">
          Main Sheet Width <span class="unit-token" data-unit-token>in</span>
          <input id="sheet-width" inputmode="decimal" type="number" min="0.01" />
        </label>
        <label class="field">
          Main Sheet Height <span class="unit-token" data-unit-token>in</span>
          <input id="sheet-height" inputmode="decimal" type="number" min="0.01" />
        </label>
        <label class="field">
          Blade Kerf <span class="unit-token" data-unit-token>in</span>
          <input id="kerf" inputmode="decimal" type="number" min="0" />
        </label>
      </div>

      <div class="toggle-row">
        <label class="switch-label">
          <input id="rotation-toggle" type="checkbox" checked />
          Allow rotation for better fit
        </label>
        <label class="switch-label">
          <input id="checklist-toggle" type="checkbox" checked />
          Checklist mode on map taps
        </label>
      </div>

      <div class="piece-entry">
        <h3>Add Piece</h3>
        <div class="field-grid piece-grid">
          <label class="field">
            Quantity
            <input id="piece-qty" inputmode="numeric" type="number" min="1" value="1" />
          </label>
          <label class="field">
            Width <span class="unit-token" data-unit-token>in</span>
            <input id="piece-width" inputmode="decimal" type="number" min="0.01" />
          </label>
          <label class="field">
            Height <span class="unit-token" data-unit-token>in</span>
            <input id="piece-height" inputmode="decimal" type="number" min="0.01" />
          </label>
        </div>
      </div>

      <div class="action-row">
        <button id="add-piece-btn" class="btn accent" type="button">Add Piece</button>
        <button id="generate-btn" class="btn primary" type="button">Generate Layout</button>
        <button id="clear-btn" class="btn ghost" type="button">Clear List</button>
      </div>

      <div id="piece-list" class="piece-list" aria-live="polite"></div>
    </section>

    <section class="card ad-slot" aria-label="Ad banner area">
      <p>Ad banner container (horizontal). Place your Google AdSense unit here.</p>
      <div class="ad-banner-placeholder">320 x 50 / 728 x 90</div>
    </section>

    <section class="card results" aria-labelledby="results-title">
      <div class="title-row">
        <h2 id="results-title">Visual Cut Map</h2>
        <span id="summary-badge" class="badge">Awaiting layout</span>
      </div>
      <div id="summary-stats" class="summary-stats"></div>
      <div class="canvas-shell" id="canvas-shell">
        <canvas id="cut-canvas" aria-label="Sheet layout visualization"></canvas>
      </div>
      <div id="checklist-items" class="checklist-items"></div>
      <p id="status-text" class="status-text" role="status"></p>
    </section>

    <section class="card seo-copy" aria-labelledby="seo-copy-title">
      <h2 id="seo-copy-title">DIY Sheet Cutting, Optimized for Real Workshops</h2>
      <p>
        Shop Assistant helps hobbyists and makers generate practical sheet layouts for plywood, MDF, acrylic, or
        foam board. Instead of hand-sketching cuts, you can quickly enter quantities and dimensions, account for blade
        kerf, and get a visual map that is easy to follow while cutting.
      </p>
      <p>
        The layout engine applies a fit-first nesting strategy to reduce waste on a single sheet and supports quick
        unit switching between inches and centimeters. This makes the tool useful for weekend builds, cabinetry,
        workshop jigs, and repeatable project planning across different material standards.
      </p>
      <p>
        On mobile, every input is thumb-friendly and checklist mode allows you to tap each part as it is cut. That
        means less re-measuring, fewer missed parts, and a cleaner process from cut list to finished build.
      </p>
    </section>
  </main>
`;

const elements = {
  unitButtons: [...document.querySelectorAll("[data-unit-btn]")],
  unitTokens: [...document.querySelectorAll("[data-unit-token]")],
  sheetWidth: document.querySelector("#sheet-width"),
  sheetHeight: document.querySelector("#sheet-height"),
  kerf: document.querySelector("#kerf"),
  rotationToggle: document.querySelector("#rotation-toggle"),
  checklistToggle: document.querySelector("#checklist-toggle"),
  pieceQty: document.querySelector("#piece-qty"),
  pieceWidth: document.querySelector("#piece-width"),
  pieceHeight: document.querySelector("#piece-height"),
  addPieceBtn: document.querySelector("#add-piece-btn"),
  generateBtn: document.querySelector("#generate-btn"),
  clearBtn: document.querySelector("#clear-btn"),
  pieceList: document.querySelector("#piece-list"),
  summaryBadge: document.querySelector("#summary-badge"),
  summaryStats: document.querySelector("#summary-stats"),
  canvas: document.querySelector("#cut-canvas"),
  canvasShell: document.querySelector("#canvas-shell"),
  checklistItems: document.querySelector("#checklist-items"),
  statusText: document.querySelector("#status-text"),
};

function roundForUnit(value, unit = state.unit) {
  const precision = UNIT_CONFIG[unit].precision;
  return Number(value.toFixed(precision));
}

function formatForUi(value, unit = state.unit) {
  return roundForUnit(value, unit).toString();
}

function parsePositive(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegative(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function setStatus(message, isError = false) {
  elements.statusText.textContent = message;
  elements.statusText.classList.toggle("error", isError);
}

function setInputsFromState() {
  elements.sheetWidth.value = formatForUi(state.sheet.width);
  elements.sheetHeight.value = formatForUi(state.sheet.height);
  elements.kerf.value = formatForUi(state.kerf);
  elements.rotationToggle.checked = state.allowRotation;
  elements.checklistToggle.checked = state.checklistMode;
}

function setInputSteps() {
  const unitSettings = UNIT_CONFIG[state.unit];
  elements.sheetWidth.step = unitSettings.step;
  elements.sheetHeight.step = unitSettings.step;
  elements.kerf.step = state.unit === "cm" ? "0.01" : "0.001";
  elements.pieceWidth.step = unitSettings.step;
  elements.pieceHeight.step = unitSettings.step;
}

function renderUnitUi() {
  elements.unitButtons.forEach((button) => {
    const isActive = button.dataset.unitBtn === state.unit;
    button.classList.toggle("active", isActive);
  });
  elements.unitTokens.forEach((token) => {
    token.textContent = UNIT_CONFIG[state.unit].label;
  });
}

function setUnit(nextUnit) {
  if (!UNIT_CONFIG[nextUnit] || state.unit === nextUnit) {
    return;
  }
  const factor = nextUnit === "cm" ? 2.54 : 1 / 2.54;
  state.sheet.width = roundForUnit(state.sheet.width * factor, nextUnit);
  state.sheet.height = roundForUnit(state.sheet.height * factor, nextUnit);
  state.kerf = roundForUnit(state.kerf * factor, nextUnit);
  state.pieces = state.pieces.map((piece) => ({
    ...piece,
    width: roundForUnit(piece.width * factor, nextUnit),
    height: roundForUnit(piece.height * factor, nextUnit),
  }));

  const pieceWidth = parsePositive(elements.pieceWidth.value);
  const pieceHeight = parsePositive(elements.pieceHeight.value);
  if (pieceWidth) {
    elements.pieceWidth.value = formatForUi(pieceWidth * factor, nextUnit);
  }
  if (pieceHeight) {
    elements.pieceHeight.value = formatForUi(pieceHeight * factor, nextUnit);
  }

  state.unit = nextUnit;
  renderUnitUi();
  setInputSteps();
  setInputsFromState();
  renderPieceList();
  renderSummary();
  drawCanvas();
  renderChecklist();
}

function readSheetSettings() {
  const width = parsePositive(elements.sheetWidth.value);
  const height = parsePositive(elements.sheetHeight.value);
  const kerf = parseNonNegative(elements.kerf.value);
  if (!width || !height) {
    setStatus("Enter valid sheet width and height before generating.", true);
    return false;
  }
  if (kerf === null) {
    setStatus("Kerf must be zero or a positive value.", true);
    return false;
  }
  state.sheet.width = width;
  state.sheet.height = height;
  state.kerf = kerf;
  state.allowRotation = elements.rotationToggle.checked;
  state.checklistMode = elements.checklistToggle.checked;
  return true;
}

function addPiece() {
  const quantityRaw = Number.parseInt(elements.pieceQty.value, 10);
  const quantity = Number.isInteger(quantityRaw) && quantityRaw > 0 ? quantityRaw : null;
  const width = parsePositive(elements.pieceWidth.value);
  const height = parsePositive(elements.pieceHeight.value);
  if (!quantity || !width || !height) {
    setStatus("Provide a valid quantity, width, and height to add a piece.", true);
    return;
  }

  state.pieces.push({
    id: state.nextPieceId,
    label: `P${state.nextPieceId}`,
    quantity,
    width,
    height,
  });
  state.nextPieceId += 1;

  elements.pieceQty.value = "1";
  elements.pieceWidth.value = "";
  elements.pieceHeight.value = "";
  renderPieceList();
  setStatus("Piece added to cut list.");
}

function renderPieceList() {
  if (!state.pieces.length) {
    elements.pieceList.innerHTML = `<p class="empty">No pieces yet. Add parts to build your cut list.</p>`;
    return;
  }

  const unit = UNIT_CONFIG[state.unit].label;
  elements.pieceList.innerHTML = state.pieces
    .map(
      (piece) => `
      <article class="piece-row">
        <div>
          <strong>${piece.label}</strong>
          <p>${piece.quantity} pcs - ${formatForUi(piece.width)} ${unit} x ${formatForUi(piece.height)} ${unit}</p>
        </div>
        <button class="tiny-btn" data-remove-id="${piece.id}" type="button">Remove</button>
      </article>
    `
    )
    .join("");
}

function expandPieces() {
  const expanded = [];
  for (const piece of state.pieces) {
    for (let i = 1; i <= piece.quantity; i += 1) {
      expanded.push({
        id: `${piece.id}-${i}`,
        label: `${piece.label}-${i}`,
        width: piece.width,
        height: piece.height,
      });
    }
  }
  return expanded.sort((a, b) => b.width * b.height - a.width * a.height);
}

function intersects(a, b) {
  return !(
    a.x >= b.x + b.w ||
    a.x + a.w <= b.x ||
    a.y >= b.y + b.h ||
    a.y + a.h <= b.y
  );
}

function splitFreeRect(freeRect, usedRect) {
  const result = [];
  if (usedRect.x > freeRect.x) {
    result.push({
      x: freeRect.x,
      y: freeRect.y,
      w: usedRect.x - freeRect.x,
      h: freeRect.h,
    });
  }
  if (usedRect.x + usedRect.w < freeRect.x + freeRect.w) {
    result.push({
      x: usedRect.x + usedRect.w,
      y: freeRect.y,
      w: freeRect.x + freeRect.w - (usedRect.x + usedRect.w),
      h: freeRect.h,
    });
  }
  if (usedRect.y > freeRect.y) {
    result.push({
      x: freeRect.x,
      y: freeRect.y,
      w: freeRect.w,
      h: usedRect.y - freeRect.y,
    });
  }
  if (usedRect.y + usedRect.h < freeRect.y + freeRect.h) {
    result.push({
      x: freeRect.x,
      y: usedRect.y + usedRect.h,
      w: freeRect.w,
      h: freeRect.y + freeRect.h - (usedRect.y + usedRect.h),
    });
  }
  return result.filter((rect) => rect.w > 0.0001 && rect.h > 0.0001);
}

function isContainedWithin(a, b) {
  return (
    a.x >= b.x &&
    a.y >= b.y &&
    a.x + a.w <= b.x + b.w &&
    a.y + a.h <= b.y + b.h
  );
}

function pruneRectangles(rectangles) {
  const pruned = [];
  for (let i = 0; i < rectangles.length; i += 1) {
    const rectA = rectangles[i];
    let contained = false;
    for (let j = 0; j < rectangles.length; j += 1) {
      if (i === j) {
        continue;
      }
      if (isContainedWithin(rectA, rectangles[j])) {
        contained = true;
        break;
      }
    }
    if (!contained) {
      pruned.push(rectA);
    }
  }
  return pruned;
}

function findBestPlacement(piece, freeRects, kerf, allowRotation) {
  const orientations = [{ width: piece.width, height: piece.height, rotated: false }];
  if (allowRotation && Math.abs(piece.width - piece.height) > 0.0001) {
    orientations.push({ width: piece.height, height: piece.width, rotated: true });
  }

  let best = null;
  for (const free of freeRects) {
    for (const option of orientations) {
      const requiredW = option.width + kerf;
      const requiredH = option.height + kerf;
      if (requiredW > free.w || requiredH > free.h) {
        continue;
      }
      const shortFit = Math.min(free.w - requiredW, free.h - requiredH);
      const longFit = Math.max(free.w - requiredW, free.h - requiredH);
      const areaFit = free.w * free.h - requiredW * requiredH;
      const candidate = {
        x: free.x,
        y: free.y,
        width: option.width,
        height: option.height,
        rotated: option.rotated,
        shortFit,
        longFit,
        areaFit,
      };
      if (
        !best ||
        candidate.shortFit < best.shortFit ||
        (candidate.shortFit === best.shortFit && candidate.longFit < best.longFit) ||
        (candidate.shortFit === best.shortFit &&
          candidate.longFit === best.longFit &&
          candidate.areaFit < best.areaFit) ||
        (candidate.shortFit === best.shortFit &&
          candidate.longFit === best.longFit &&
          candidate.areaFit === best.areaFit &&
          (candidate.y < best.y || (candidate.y === best.y && candidate.x < best.x)))
      ) {
        best = candidate;
      }
    }
  }
  return best;
}

function optimizeLayout(pieces, sheet, kerf, allowRotation) {
  const freeRects = [{ x: 0, y: 0, w: sheet.width, h: sheet.height }];
  const placements = [];
  const unplaced = [];

  for (const piece of pieces) {
    const best = findBestPlacement(piece, freeRects, kerf, allowRotation);
    if (!best) {
      unplaced.push(piece);
      continue;
    }

    placements.push({
      id: piece.id,
      label: piece.label,
      x: best.x,
      y: best.y,
      width: best.width,
      height: best.height,
      rotated: best.rotated,
    });

    const usedRect = {
      x: best.x,
      y: best.y,
      w: best.width + kerf,
      h: best.height + kerf,
    };

    const updatedFreeRects = [];
    for (const free of freeRects) {
      if (!intersects(free, usedRect)) {
        updatedFreeRects.push(free);
      } else {
        updatedFreeRects.push(...splitFreeRect(free, usedRect));
      }
    }

    freeRects.length = 0;
    freeRects.push(...pruneRectangles(updatedFreeRects));
  }

  const placedArea = placements.reduce((sum, piece) => sum + piece.width * piece.height, 0);
  const sheetArea = sheet.width * sheet.height;
  const utilization = sheetArea > 0 ? (placedArea / sheetArea) * 100 : 0;

  return {
    placements,
    unplaced,
    utilization,
    sheetArea,
    placedArea,
  };
}

function renderSummary() {
  if (!state.totals) {
    elements.summaryBadge.textContent = "Awaiting layout";
    elements.summaryStats.innerHTML = `
      <div class="empty">Generate a layout to see utilization, waste, and cut progress.</div>
    `;
    return;
  }

  const totalPlaced = state.placements.length;
  const totalPieces = state.placements.length + state.unplaced.length;
  const cutDone = [...state.cutIds].filter((id) => state.placements.some((p) => p.id === id)).length;
  const utilization = state.totals.utilization.toFixed(1);
  const waste = Math.max(0, 100 - state.totals.utilization).toFixed(1);

  elements.summaryBadge.textContent = `${utilization}% used`;
  elements.summaryStats.innerHTML = `
    <div class="stat-card">
      <strong>${totalPlaced}/${totalPieces}</strong>
      <span>Pieces placed</span>
    </div>
    <div class="stat-card">
      <strong>${cutDone}/${totalPlaced}</strong>
      <span>Cuts completed</span>
    </div>
    <div class="stat-card">
      <strong>${waste}%</strong>
      <span>Estimated waste</span>
    </div>
    ${
      state.unplaced.length
        ? `<p class="warning">Not placed: ${state.unplaced.map((piece) => piece.label).join(", ")}</p>`
        : ""
    }
  `;
}

function renderChecklist() {
  if (!state.placements.length) {
    elements.checklistItems.innerHTML = `<p class="empty">Checklist appears after generating a layout.</p>`;
    return;
  }
  const unit = UNIT_CONFIG[state.unit].label;
  elements.checklistItems.innerHTML = state.placements
    .map((piece) => {
      const isCut = state.cutIds.has(piece.id);
      return `
        <button
          type="button"
          class="check-item ${isCut ? "done" : ""}"
          data-check-piece="${piece.id}"
          ${state.checklistMode ? "" : "disabled"}
        >
          <span>${piece.label}</span>
          <span>${formatForUi(piece.width)} x ${formatForUi(piece.height)} ${unit}</span>
        </button>
      `;
    })
    .join("");
}

function drawCanvas() {
  const ctx = elements.canvas.getContext("2d");
  const shellWidth = Math.max(280, elements.canvasShell.clientWidth - 2);
  const ratio = state.sheet.height / state.sheet.width;
  const idealHeight = shellWidth * ratio + 34;
  const maxHeight = Math.max(280, window.innerHeight * 0.58);
  const cssHeight = Math.round(Math.min(maxHeight, Math.max(280, idealHeight)));
  const dpr = window.devicePixelRatio || 1;

  elements.canvas.style.width = `${shellWidth}px`;
  elements.canvas.style.height = `${cssHeight}px`;
  elements.canvas.width = Math.floor(shellWidth * dpr);
  elements.canvas.height = Math.floor(cssHeight * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, shellWidth, cssHeight);

  const grid = 12;
  ctx.fillStyle = "#edf4f7";
  ctx.fillRect(0, 0, shellWidth, cssHeight);
  ctx.strokeStyle = "rgba(181, 210, 216, 0.35)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= shellWidth; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, cssHeight);
    ctx.stroke();
  }
  for (let y = 0; y <= cssHeight; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(shellWidth, y);
    ctx.stroke();
  }

  const margin = 18;
  const scale = Math.min(
    (shellWidth - margin * 2) / state.sheet.width,
    (cssHeight - margin * 2) / state.sheet.height
  );
  const originX = (shellWidth - state.sheet.width * scale) / 2;
  const originY = (cssHeight - state.sheet.height * scale) / 2;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(originX, originY, state.sheet.width * scale, state.sheet.height * scale);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#006D77";
  ctx.strokeRect(originX, originY, state.sheet.width * scale, state.sheet.height * scale);

  if (!state.placements.length) {
    ctx.fillStyle = "#2d3436";
    ctx.font = "600 14px Inter, sans-serif";
    ctx.fillText("No layout yet. Add pieces and tap Generate Layout.", originX + 12, originY + 24);
    state.hitRegions = [];
    return;
  }

  state.hitRegions = [];
  for (const piece of state.placements) {
    const x = originX + piece.x * scale;
    const y = originY + piece.y * scale;
    const width = piece.width * scale;
    const height = piece.height * scale;
    const isCut = state.cutIds.has(piece.id);

    ctx.fillStyle = isCut ? "rgba(55, 148, 149, 0.30)" : "rgba(55, 148, 149, 0.82)";
    ctx.fillRect(x, y, width, height);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#006D77";
    ctx.strokeRect(x, y, width, height);

    if (isCut) {
      ctx.fillStyle = "rgba(255, 111, 97, 0.22)";
      ctx.fillRect(x, y, width, height);
      ctx.strokeStyle = "#ff6f61";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 6);
      ctx.lineTo(x + width - 6, y + height - 6);
      ctx.moveTo(x + width - 6, y + 6);
      ctx.lineTo(x + 6, y + height - 6);
      ctx.stroke();
    }

    if (width > 50 && height > 28) {
      ctx.fillStyle = "#2d3436";
      ctx.font = "600 12px Inter, sans-serif";
      ctx.fillText(piece.label, x + 6, y + 14);
    }

    state.hitRegions.push({
      id: piece.id,
      x,
      y,
      w: width,
      h: height,
    });
  }
}

function toggleCut(pieceId) {
  if (state.cutIds.has(pieceId)) {
    state.cutIds.delete(pieceId);
  } else {
    state.cutIds.add(pieceId);
  }
  renderSummary();
  renderChecklist();
  drawCanvas();
}

function generateLayout() {
  if (!readSheetSettings()) {
    return;
  }
  if (!state.pieces.length) {
    setStatus("Add at least one piece before generating a layout.", true);
    return;
  }

  const expanded = expandPieces();
  const result = optimizeLayout(expanded, state.sheet, state.kerf, state.allowRotation);
  state.placements = result.placements;
  state.unplaced = result.unplaced;
  state.totals = result;
  state.cutIds = new Set();

  renderSummary();
  renderChecklist();
  drawCanvas();

  if (!state.placements.length) {
    setStatus("No pieces fit this sheet size. Check dimensions and kerf.", true);
    return;
  }
  if (state.unplaced.length) {
    setStatus("Layout generated with some pieces not placed. Try a larger sheet or fewer parts.");
    return;
  }
  setStatus("Layout generated. Tap pieces on the map to mark them as cut.");
}

elements.unitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setUnit(button.dataset.unitBtn);
  });
});

elements.addPieceBtn.addEventListener("click", addPiece);
elements.generateBtn.addEventListener("click", generateLayout);

elements.clearBtn.addEventListener("click", () => {
  state.pieces = [];
  state.placements = [];
  state.unplaced = [];
  state.totals = null;
  state.cutIds = new Set();
  renderPieceList();
  renderSummary();
  renderChecklist();
  drawCanvas();
  setStatus("Cut list cleared.");
});

elements.rotationToggle.addEventListener("change", (event) => {
  state.allowRotation = event.target.checked;
});

elements.checklistToggle.addEventListener("change", (event) => {
  state.checklistMode = event.target.checked;
  renderChecklist();
  setStatus(state.checklistMode ? "Checklist mode enabled." : "Checklist mode disabled.");
});

elements.pieceList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const removeId = target.dataset.removeId;
  if (!removeId) {
    return;
  }
  state.pieces = state.pieces.filter((piece) => piece.id !== Number(removeId));
  renderPieceList();
  setStatus("Piece removed from cut list.");
});

elements.checklistItems.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const button = target.closest("[data-check-piece]");
  if (!(button instanceof HTMLElement) || !state.checklistMode) {
    return;
  }
  toggleCut(button.dataset.checkPiece);
});

elements.canvas.addEventListener("pointerdown", (event) => {
  if (!state.checklistMode || !state.hitRegions.length) {
    return;
  }
  const rect = elements.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  for (let i = state.hitRegions.length - 1; i >= 0; i -= 1) {
    const hit = state.hitRegions[i];
    if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) {
      toggleCut(hit.id);
      setStatus(`Toggled ${hit.id}.`);
      break;
    }
  }
});

window.addEventListener("resize", drawCanvas);

renderUnitUi();
setInputSteps();
setInputsFromState();
renderPieceList();
renderSummary();
renderChecklist();
drawCanvas();
setStatus("Set sheet size, add pieces, then generate your cut map.");
