const UNIT_CONFIG = {
  in: {
    label: "in",
    sheetWidth: 48,
    sheetHeight: 96,
    kerf: 0.125,
    precision: 4,
  },
  cm: {
    label: "cm",
    sheetWidth: 122,
    sheetHeight: 244,
    kerf: 0.3,
    precision: 3,
  },
};

const DIMENSION_STEP = "0.0625";
const MAX_FIT_PIECES = 18000;

const state = {
  unit: "in",
  sheet: {
    width: UNIT_CONFIG.in.sheetWidth,
    height: UNIT_CONFIG.in.sheetHeight,
  },
  kerf: UNIT_CONFIG.in.kerf,
  allowRotation: true,
  checklistMode: true,
  howManyFitMode: false,
  guideCollapsed: false,
  setupCollapsed: false,
  pieces: [],
  nextPieceId: 1,
  placements: [],
  unplaced: [],
  hitRegions: [],
  cutIds: new Set(),
  totals: null,
  fitResultCount: null,
  deferredInstallPrompt: null,
  shopPad: {
    open: false,
    target: null,
    flow: "general",
    whole: "",
    decimal: "",
    editingDecimal: false,
    fraction: 0,
    fractionLabel: "",
    manualFractionMode: false,
    manualFractionNumerator: "",
    manualFractionDenominator: "",
  },
};

const elements = {
  guideTop: document.querySelector("#guide-top"),
  guideTopBody: document.querySelector("#guide-top-body"),
  guideCollapseBtn: document.querySelector("#guide-collapse-btn"),
  setup: document.querySelector("#setup"),
  setupBody: document.querySelector("#setup-body"),
  setupCollapseBtn: document.querySelector("#setup-collapse-btn"),
  unitButtons: [...document.querySelectorAll("[data-unit-btn]")],
  unitTokens: [...document.querySelectorAll("[data-unit-token]")],
  sheetWidth: document.querySelector("#sheet-width"),
  sheetHeight: document.querySelector("#sheet-height"),
  kerf: document.querySelector("#kerf"),
  rotationToggle: document.querySelector("#rotation-toggle"),
  checklistToggle: document.querySelector("#checklist-toggle"),
  fitToggle: document.querySelector("#fit-toggle"),
  pieceQtyField: document.querySelector("#piece-qty-field"),
  pieceQty: document.querySelector("#piece-qty"),
  pieceWidth: document.querySelector("#piece-width"),
  pieceHeight: document.querySelector("#piece-height"),
  addPieceBtn: document.querySelector("#add-piece-btn"),
  generateBtn: document.querySelector("#generate-btn"),
  exportBtn: document.querySelector("#export-btn"),
  clearBtn: document.querySelector("#clear-btn"),
  pieceList: document.querySelector("#piece-list"),
  summaryStats: document.querySelector("#summary-stats"),
  results: document.querySelector("#results"),
  shopModeBtn: document.querySelector("#shop-mode-btn"),
  canvas: document.querySelector("#cut-canvas"),
  canvasShell: document.querySelector("#canvas-shell"),
  checklistItems: document.querySelector("#checklist-items"),
  statusText: document.querySelector("#status-text"),
  bookmarkBtn: document.querySelector("#bookmark-btn"),
  shareBtn: document.querySelector("#share-btn"),
  homeBtn: document.querySelector("#home-btn"),
  setupPadBtn: document.querySelector("#setup-pad-btn"),
  piecePadBtn: document.querySelector("#piece-pad-btn"),
  shopPadOverlay: document.querySelector("#shop-pad-overlay"),
  shopPadModal: document.querySelector("#shop-pad-modal"),
  shopPadTitle: document.querySelector("#shop-pad-title"),
  shopPadDisplay: document.querySelector("#shop-pad-display"),
  shopPadClose: document.querySelector("#shop-pad-close"),
  shopPadNextBtn: document.querySelector('[data-pad-action="next"]'),
  shopPadFields: [...document.querySelectorAll("[data-shop-pad]")],
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

function clearLayoutState() {
  state.placements = [];
  state.unplaced = [];
  state.hitRegions = [];
  state.cutIds = new Set();
  state.totals = null;
  state.fitResultCount = null;
}

function setInputsFromState() {
  elements.sheetWidth.value = formatForUi(state.sheet.width);
  elements.sheetHeight.value = formatForUi(state.sheet.height);
  elements.kerf.value = formatForUi(state.kerf);
  elements.rotationToggle.checked = state.allowRotation;
  elements.checklistToggle.checked = state.checklistMode;
  elements.fitToggle.checked = state.howManyFitMode;
}

function setInputSteps() {
  elements.sheetWidth.step = DIMENSION_STEP;
  elements.sheetHeight.step = DIMENSION_STEP;
  elements.kerf.step = DIMENSION_STEP;
  elements.pieceWidth.step = DIMENSION_STEP;
  elements.pieceHeight.step = DIMENSION_STEP;
  elements.pieceQty.step = "1";
}

function renderUnitUi() {
  elements.unitButtons.forEach((button) => {
    const isActive = button.dataset.unitBtn === state.unit;
    button.classList.toggle("active", isActive);
  });
  elements.unitTokens.forEach((token) => {
    token.textContent = UNIT_CONFIG[state.unit].label;
  });
  elements.shopPadModal.classList.toggle("cm-mode", state.unit === "cm");
}

function renderFitModeUi() {
  elements.pieceQtyField.classList.toggle("hidden", state.howManyFitMode);
  elements.addPieceBtn.textContent = state.howManyFitMode ? "Calculate Fit" : "Add Piece";
}

function setGuideCollapsed(collapsed) {
  state.guideCollapsed = collapsed;
  elements.guideTop.classList.toggle("collapsed", collapsed);
  elements.guideCollapseBtn.setAttribute("aria-expanded", String(!collapsed));
  elements.guideCollapseBtn.setAttribute(
    "aria-label",
    collapsed ? "Expand how to use section" : "Collapse how to use section"
  );
  elements.guideCollapseBtn.textContent = collapsed ? "+" : "-";
}

function setSetupCollapsed(collapsed, scrollToMap = false) {
  state.setupCollapsed = collapsed;
  elements.setup.classList.toggle("collapsed", collapsed);
  elements.setupCollapseBtn.setAttribute("aria-expanded", String(!collapsed));
  elements.setupCollapseBtn.setAttribute("aria-label", collapsed ? "Expand setup" : "Collapse setup");
  elements.setupCollapseBtn.textContent = collapsed ? "+" : "-";
  if (scrollToMap) {
    elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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
  clearLayoutState();
  renderUnitUi();
  if (state.unit === "cm" && (state.shopPad.fraction || state.shopPad.manualFractionMode)) {
    state.shopPad.fraction = 0;
    state.shopPad.fractionLabel = "";
    state.shopPad.manualFractionMode = false;
    state.shopPad.manualFractionNumerator = "";
    state.shopPad.manualFractionDenominator = "";
    updateShopPadOutput();
  }
  setInputSteps();
  setInputsFromState();
  renderFitModeUi();
  renderPieceList();
  renderSummary();
  drawCanvas();
  renderChecklist();
  setStatus("Units updated. Generate a new layout to refresh the map.");
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

function commitPlacementToFreeRects(best, freeRects) {
  const usedRect = {
    x: best.x,
    y: best.y,
    w: best.width + best.kerfX,
    h: best.height + best.kerfY,
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

function findBestPlacement(piece, freeRects, kerf, allowRotation) {
  const orientations = [{ width: piece.width, height: piece.height, rotated: false }];
  if (allowRotation && Math.abs(piece.width - piece.height) > 0.0001) {
    orientations.push({ width: piece.height, height: piece.width, rotated: true });
  }

  let best = null;
  for (const free of freeRects) {
    for (const option of orientations) {
      const remainingW = free.w - option.width;
      const remainingH = free.h - option.height;
      if (remainingW < 0 || remainingH < 0) {
        continue;
      }
      // Kerf is needed only when another cut can continue on that side.
      const kerfX = remainingW > 0 ? Math.min(kerf, remainingW) : 0;
      const kerfY = remainingH > 0 ? Math.min(kerf, remainingH) : 0;
      const requiredW = option.width + kerfX;
      const requiredH = option.height + kerfY;
      const shortFit = Math.min(free.w - requiredW, free.h - requiredH);
      const longFit = Math.max(free.w - requiredW, free.h - requiredH);
      const areaFit = free.w * free.h - requiredW * requiredH;
      const candidate = {
        x: free.x,
        y: free.y,
        width: option.width,
        height: option.height,
        rotated: option.rotated,
        kerfX,
        kerfY,
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

    commitPlacementToFreeRects(best, freeRects);
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

function calculateMaxFitLayout(pieceWidth, pieceHeight, sheet, kerf, allowRotation) {
  const freeRects = [{ x: 0, y: 0, w: sheet.width, h: sheet.height }];
  const placements = [];

  for (let index = 1; index <= MAX_FIT_PIECES; index += 1) {
    const piece = {
      id: `fit-${index}`,
      label: `FIT-${index}`,
      width: pieceWidth,
      height: pieceHeight,
    };
    const best = findBestPlacement(piece, freeRects, kerf, allowRotation);
    if (!best) {
      break;
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
    commitPlacementToFreeRects(best, freeRects);
  }

  const placedArea = placements.reduce((sum, piece) => sum + piece.width * piece.height, 0);
  const sheetArea = sheet.width * sheet.height;
  const utilization = sheetArea > 0 ? (placedArea / sheetArea) * 100 : 0;

  return {
    placements,
    unplaced: [],
    utilization,
    sheetArea,
    placedArea,
    maxedOut: placements.length === MAX_FIT_PIECES,
  };
}

function renderSummary() {
  if (!state.totals) {
    elements.summaryStats.innerHTML = `
      <div class="stat-card">
        <strong>0/0</strong>
        <span>Pieces placed</span>
      </div>
      <div class="stat-card">
        <strong>0/0</strong>
        <span>Cuts completed</span>
      </div>
      <div class="stat-card">
        <strong>0.0%</strong>
        <span>Used</span>
      </div>
      <div class="stat-card">
        <strong>100.0%</strong>
        <span>Estimated waste</span>
      </div>
    `;
    return;
  }

  const totalPlaced = state.placements.length;
  const totalPieces = state.fitResultCount ?? state.placements.length + state.unplaced.length;
  const cutDone = [...state.cutIds].filter((id) => state.placements.some((p) => p.id === id)).length;
  const utilization = state.totals.utilization.toFixed(1);
  const waste = Math.max(0, 100 - state.totals.utilization).toFixed(1);

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
      <strong>${utilization}%</strong>
      <span>Used</span>
    </div>
    <div class="stat-card">
      <strong>${waste}%</strong>
      <span>Estimated waste</span>
    </div>
    ${
      state.fitResultCount !== null
        ? `<p class="info">How many fit result: <strong>${state.fitResultCount}</strong> identical parts.</p>`
        : ""
    }
    ${
      state.unplaced.length
        ? `<p class="warning">Not placed: ${state.unplaced.slice(0, 15).map((piece) => piece.label).join(", ")}${
            state.unplaced.length > 15 ? "..." : ""
          }</p>`
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
  const shellStyles = window.getComputedStyle(elements.canvasShell);
  const paddingX =
    Number.parseFloat(shellStyles.paddingLeft || "0") +
    Number.parseFloat(shellStyles.paddingRight || "0");
  const shellWidth = Math.max(240, Math.floor(elements.canvasShell.clientWidth - paddingX));
  const ratio = state.sheet.height / state.sheet.width;
  const idealHeight = shellWidth * ratio;
  const cssHeight = Math.round(Math.min(620, Math.max(260, idealHeight)));
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

  const sheetDrawWidth = state.sheet.width * scale;
  const sheetDrawHeight = state.sheet.height * scale;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(originX, originY, sheetDrawWidth, sheetDrawHeight);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#006D77";
  ctx.strokeRect(originX, originY, sheetDrawWidth, sheetDrawHeight);

  if (!state.placements.length) {
    const message = "No layout yet. Add pieces and tap Generate Layout.";
    ctx.save();
    ctx.beginPath();
    ctx.rect(originX + 2, originY + 2, sheetDrawWidth - 4, sheetDrawHeight - 4);
    ctx.clip();
    ctx.fillStyle = "#2d3436";
    ctx.font = "600 14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = message.split(" ");
    const maxWidth = Math.max(80, sheetDrawWidth - 24);
    const lines = [];
    let line = "";
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width <= maxWidth) {
        line = testLine;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
    const lineHeight = 18;
    const startY = originY + sheetDrawHeight / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((text, idx) => {
      ctx.fillText(text, originX + sheetDrawWidth / 2, startY + idx * lineHeight);
    });
    ctx.restore();
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

    if (piece.rotated) {
      const markerSize = Math.max(12, Math.min(16, Math.min(width, height) * 0.35));
      const markerX = x + width - markerSize - 3;
      const markerY = y + 3;
      ctx.fillStyle = "#ff6f61";
      ctx.fillRect(markerX, markerY, markerSize, markerSize);
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 9px Space Grotesk, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("R", markerX + markerSize / 2, markerY + markerSize / 2 + 0.5);
    }

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

    if (width > 42 && height > 24) {
      ctx.fillStyle = "#14363a";
      ctx.font = "600 11px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      if (piece.rotated && height >= 58) {
        ctx.save();
        ctx.translate(x + 12, y + height - 8);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(piece.label, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(piece.label, x + 6, y + 14);
      }
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
  if (!pieceId) {
    return;
  }
  if (state.cutIds.has(pieceId)) {
    state.cutIds.delete(pieceId);
  } else {
    state.cutIds.add(pieceId);
  }
  renderSummary();
  renderChecklist();
  drawCanvas();
}

function runStandardLayout() {
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
  state.fitResultCount = null;

  renderSummary();
  renderChecklist();
  drawCanvas();
  setSetupCollapsed(true, true);

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

function runHowManyFitLayout() {
  if (!readSheetSettings()) {
    return;
  }
  const width = parsePositive(elements.pieceWidth.value);
  const height = parsePositive(elements.pieceHeight.value);
  if (!width || !height) {
    setStatus("Enter a valid width and height to calculate how many fit.", true);
    return;
  }

  const result = calculateMaxFitLayout(width, height, state.sheet, state.kerf, state.allowRotation);
  state.placements = result.placements;
  state.unplaced = [];
  state.totals = result;
  state.cutIds = new Set();
  state.fitResultCount = result.placements.length;

  renderSummary();
  renderChecklist();
  drawCanvas();
  setSetupCollapsed(true, true);

  if (!result.placements.length) {
    setStatus("That piece size does not fit on the current sheet.", true);
    return;
  }
  if (result.maxedOut) {
    setStatus(`Calculated ${result.placements.length} pieces before reaching mode limit (${MAX_FIT_PIECES}).`);
    return;
  }
  setStatus(`How Many Fit result: ${result.placements.length} pieces can fit on this sheet.`);
}

function generateLayout() {
  if (state.howManyFitMode) {
    runHowManyFitLayout();
    return;
  }
  runStandardLayout();
}

async function exportAsPdf() {
  if (!state.totals || !state.placements.length) {
    setStatus("Generate a layout before exporting to PDF.", true);
    return;
  }
  try {
    drawCanvas();
    const { jsPDF } = await import("jspdf");
    const unit = UNIT_CONFIG[state.unit].label;
    const mapImage = elements.canvas.toDataURL("image/png", 1.0);
    const isLandscape = elements.canvas.width >= elements.canvas.height;
    const pdf = new jsPDF({
      orientation: isLandscape ? "landscape" : "portrait",
      unit: "pt",
      format: "letter",
      compress: true,
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 36;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("The Sheet Cut Wizard", margin, margin);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(
      `Utilization: ${state.totals.utilization.toFixed(1)}% | Sheet: ${formatForUi(state.sheet.width)} ${unit} x ${formatForUi(
        state.sheet.height
      )} ${unit}`,
      margin,
      margin + 18
    );

    const imgMaxW = pageWidth - margin * 2;
    const imgMaxH = pageHeight - margin * 2 - 150;
    const imgRatio = elements.canvas.width / elements.canvas.height;
    let imgWidth = imgMaxW;
    let imgHeight = imgWidth / imgRatio;
    if (imgHeight > imgMaxH) {
      imgHeight = imgMaxH;
      imgWidth = imgHeight * imgRatio;
    }
    const imgX = (pageWidth - imgWidth) / 2;
    const imgY = margin + 34;
    pdf.addImage(mapImage, "PNG", imgX, imgY, imgWidth, imgHeight, undefined, "FAST");

    let y = imgY + imgHeight + 20;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Placed Parts", margin, y);
    y += 14;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const partLines = state.placements.map(
      (piece) =>
        `${piece.label}: ${formatForUi(piece.width)} ${unit} x ${formatForUi(piece.height)} ${unit}${piece.rotated ? " (rotated)" : ""}`
    );
    for (const line of partLines) {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
      }
      pdf.text(line, margin, y);
      y += 11;
    }

    const stamp = new Date().toISOString().slice(0, 10);
    pdf.save(`sheet-cut-map-${stamp}.pdf`);
    setStatus("PDF downloaded.");
  } catch {
    setStatus("Unable to export PDF right now.", true);
  }
}

async function shareLayout() {
  const shareData = {
    title: "The Sheet Cut Wizard",
    text: "Optimize plywood and sheet layouts with this cut map wizard.",
    url: window.location.href,
  };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
      setStatus("Share sheet opened.");
      return;
    }
    await navigator.clipboard.writeText(window.location.href);
    setStatus("Link copied. Paste it anywhere to share.");
  } catch {
    setStatus("Unable to share right now. Copy the URL from your browser bar.", true);
  }
}

function bookmarkHint() {
  const pageUrl = window.location.href;
  const pageTitle = document.title;
  try {
    if (window.external && typeof window.external.AddFavorite === "function") {
      window.external.AddFavorite(pageUrl, pageTitle);
      setStatus("Bookmark dialog opened.");
      return;
    }
    if (window.sidebar && typeof window.sidebar.addPanel === "function") {
      window.sidebar.addPanel(pageTitle, pageUrl, "");
      setStatus("Bookmark dialog opened.");
      return;
    }
  } catch {
    // Browser blocked direct bookmark API; fall back below.
  }
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const shortcut = isMac ? "Cmd + D" : "Ctrl + D";
  navigator.clipboard
    .writeText(pageUrl)
    .then(() => {
      setStatus(`Link copied. Press ${shortcut} to bookmark this page.`);
    })
    .catch(() => {
      setStatus(`Press ${shortcut} to bookmark this page.`);
    });
}

async function promptInstall() {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (isStandalone) {
    setStatus("This tool is already installed on your home screen.");
    return;
  }
  if (state.deferredInstallPrompt) {
    state.deferredInstallPrompt.prompt();
    const choice = await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    setStatus(choice?.outcome === "accepted" ? "Install prompt accepted." : "Install prompt dismissed.");
    return;
  }
  const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isiOS) {
    setStatus("On iPhone/iPad: tap Share, then Add to Home Screen.");
    return;
  }
  setStatus("Use your browser menu and choose Install App or Add to Home Screen.");
}

async function toggleShopMode() {
  const usingFallback = elements.results.classList.contains("shop-mode-fallback");
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  if (usingFallback) {
    elements.results.classList.remove("shop-mode-fallback");
    elements.shopModeBtn.classList.remove("active");
    elements.shopModeBtn.textContent = "Enter Shop Mode";
    setStatus("Exited Shop Mode.");
    drawCanvas();
    return;
  }
  if (elements.results.requestFullscreen) {
    try {
      await elements.results.requestFullscreen();
      setStatus("Shop Mode enabled. Tap map pieces to track cuts.");
      return;
    } catch {
      // fallback below
    }
  }
  elements.results.classList.add("shop-mode-fallback");
  elements.shopModeBtn.classList.add("active");
  elements.shopModeBtn.textContent = "Exit Shop Mode";
  setStatus("Shop Mode expanded without fullscreen support.");
  drawCanvas();
}

function syncShopModeButton() {
  const isFullscreen = document.fullscreenElement === elements.results;
  if (isFullscreen) {
    elements.shopModeBtn.classList.add("active");
    elements.shopModeBtn.textContent = "Exit Shop Mode";
    return;
  }
  if (!elements.results.classList.contains("shop-mode-fallback")) {
    elements.shopModeBtn.classList.remove("active");
    elements.shopModeBtn.textContent = "Enter Shop Mode";
  }
  drawCanvas();
}

function shouldUseShopPad() {
  const mobileViewport = window.matchMedia("(max-width: 719px)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return mobileViewport && (coarsePointer || mobileUserAgent);
}

function syncShopPadInputMode() {
  const usePad = shouldUseShopPad();
  for (const field of elements.shopPadFields) {
    const nativeInputMode = field.getAttribute("inputmode") || "decimal";
    field.readOnly = false;
    field.inputMode = nativeInputMode;
  }
  if (!usePad && state.shopPad.open) {
    closeShopPad();
  }
}

function getPiecePadFlowFields() {
  return state.howManyFitMode
    ? [elements.pieceWidth, elements.pieceHeight]
    : [elements.pieceQty, elements.pieceWidth, elements.pieceHeight];
}

function getShopPadFlowForInput(input) {
  if (!input) {
    return "general";
  }
  if ([elements.sheetWidth, elements.sheetHeight, elements.kerf].includes(input)) {
    return "setup";
  }
  if ([elements.pieceQty, elements.pieceWidth, elements.pieceHeight].includes(input)) {
    return "piece";
  }
  return "general";
}

function getShopPadActiveFieldsForFlow(flow) {
  if (flow === "setup") {
    return [elements.sheetWidth, elements.sheetHeight, elements.kerf];
  }
  if (flow === "piece") {
    return getPiecePadFlowFields();
  }
  return elements.shopPadFields.filter((field) => !field.closest(".hidden") && !field.disabled);
}

function updateShopPadNextButtonLabel() {
  if (!state.shopPad.open || !state.shopPad.target || !elements.shopPadNextBtn) {
    return;
  }
  const activeFields = getShopPadActiveFieldsForFlow(state.shopPad.flow);
  const currentIndex = activeFields.indexOf(state.shopPad.target);
  const hasNext = currentIndex >= 0 && Boolean(activeFields[currentIndex + 1]);
  elements.shopPadNextBtn.textContent = hasNext ? "NEXT" : "DONE";
}

function getShopPadValue() {
  const whole = state.shopPad.whole ? Number.parseInt(state.shopPad.whole, 10) : 0;
  const decimal = state.shopPad.decimal ? Number.parseFloat(`0.${state.shopPad.decimal}`) : 0;
  let manualFraction = 0;
  if (state.shopPad.manualFractionMode) {
    const numerator = Number.parseFloat(state.shopPad.manualFractionNumerator);
    const denominator = Number.parseFloat(state.shopPad.manualFractionDenominator);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
      manualFraction = numerator / denominator;
    }
  }
  return Number((whole + decimal + state.shopPad.fraction + manualFraction).toFixed(4));
}

function updateShopPadOutput() {
  if (!state.shopPad.target) {
    return;
  }
  const hasInput =
    state.shopPad.whole ||
    state.shopPad.decimal ||
    state.shopPad.fraction ||
    state.shopPad.editingDecimal ||
    state.shopPad.manualFractionMode;

  let expression = "0";
  if (state.shopPad.manualFractionMode) {
    const wholePart = state.shopPad.whole || "";
    const numerator = state.shopPad.manualFractionNumerator || "";
    const denominator = state.shopPad.manualFractionDenominator || "";
    const fractionText = `${numerator || ""}/${denominator || ""}`;
    expression = `${wholePart ? `${wholePart} ` : ""}${fractionText}`.trim() || "0";
  } else {
    const expressionBaseRaw =
      state.shopPad.whole || state.shopPad.decimal || state.shopPad.editingDecimal
        ? `${state.shopPad.whole || "0"}${state.shopPad.editingDecimal || state.shopPad.decimal ? `.${state.shopPad.decimal}` : ""}`
        : "0";
    const expressionBase = expressionBaseRaw === "0" && state.shopPad.fractionLabel ? "" : expressionBaseRaw;
    expression = state.shopPad.fractionLabel
      ? `${expressionBase ? `${expressionBase} ` : ""}${state.shopPad.fractionLabel}`
      : expressionBaseRaw;
  }

  const value = getShopPadValue();
  elements.shopPadDisplay.textContent = hasInput ? expression : "0";
  state.shopPad.target.value = value.toString();
}

function parseValueToShopPad(value) {
  if (!Number.isFinite(value) || value < 0) {
    return {
      whole: "",
      decimal: "",
      editingDecimal: false,
      fraction: 0,
      fractionLabel: "",
      manualFractionMode: false,
      manualFractionNumerator: "",
      manualFractionDenominator: "",
    };
  }
  const fixed = value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  const [wholePart, decimalPart = ""] = fixed.split(".");
  return {
    whole: wholePart === "0" && !decimalPart ? "" : wholePart,
    decimal: decimalPart,
    editingDecimal: Boolean(decimalPart),
    fraction: 0,
    fractionLabel: "",
    manualFractionMode: false,
    manualFractionNumerator: "",
    manualFractionDenominator: "",
  };
}

function openShopPad(input) {
  const parsed = parseValueToShopPad(Number.parseFloat(input.value));
  const flow = getShopPadFlowForInput(input);
  state.shopPad = {
    open: true,
    target: input,
    flow,
    whole: parsed.whole,
    decimal: parsed.decimal,
    editingDecimal: parsed.editingDecimal,
    fraction: parsed.fraction,
    fractionLabel: parsed.fractionLabel,
    manualFractionMode: parsed.manualFractionMode,
    manualFractionNumerator: parsed.manualFractionNumerator,
    manualFractionDenominator: parsed.manualFractionDenominator,
  };
  elements.shopPadTitle.textContent = input.dataset.padLabel || "Dimension";
  elements.shopPadOverlay.classList.add("open");
  elements.shopPadOverlay.setAttribute("aria-hidden", "false");
  updateShopPadOutput();
  updateShopPadNextButtonLabel();
}

function closeShopPad() {
  if (!state.shopPad.open) {
    return;
  }
  const activeTarget = state.shopPad.target;
  state.shopPad = {
    open: false,
    target: null,
    flow: "general",
    whole: "",
    decimal: "",
    editingDecimal: false,
    fraction: 0,
    fractionLabel: "",
    manualFractionMode: false,
    manualFractionNumerator: "",
    manualFractionDenominator: "",
  };
  elements.shopPadOverlay.classList.remove("open");
  elements.shopPadOverlay.setAttribute("aria-hidden", "true");
  if (elements.shopPadNextBtn) {
    elements.shopPadNextBtn.textContent = "NEXT";
  }
  if (activeTarget) {
    activeTarget.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function moveToNextShopPadField() {
  if (!state.shopPad.target) {
    closeShopPad();
    return;
  }
  const activeFields = getShopPadActiveFieldsForFlow(state.shopPad.flow);
  const currentIndex = activeFields.indexOf(state.shopPad.target);
  if (currentIndex < 0 || !activeFields[currentIndex + 1]) {
    closeShopPad();
    return;
  }
  openShopPad(activeFields[currentIndex + 1]);
}

function moveToPreviousShopPadField() {
  if (!state.shopPad.target) {
    closeShopPad();
    return;
  }
  const activeFields = getShopPadActiveFieldsForFlow(state.shopPad.flow);
  const currentIndex = activeFields.indexOf(state.shopPad.target);
  if (currentIndex <= 0) {
    closeShopPad();
    return;
  }
  openShopPad(activeFields[currentIndex - 1]);
}

function handleShopPadAction(button) {
  if (!state.shopPad.open) {
    return;
  }
  const digit = button.dataset.padDigit;
  const fractionValue = button.dataset.padFraction;
  const action = button.dataset.padAction;
  if (digit) {
    if (state.shopPad.manualFractionMode) {
      if (!state.shopPad.manualFractionNumerator) {
        state.shopPad.manualFractionNumerator = digit;
      } else if (state.shopPad.manualFractionDenominator.length < 4) {
        state.shopPad.manualFractionDenominator += digit;
      }
    } else if (state.shopPad.editingDecimal) {
      if (state.shopPad.decimal.length < 4) {
        state.shopPad.decimal += digit;
      }
    } else {
      state.shopPad.whole = `${state.shopPad.whole}${digit}`.replace(/^0+(\d)/, "$1");
    }
    updateShopPadOutput();
    return;
  }
  if (fractionValue) {
    if (state.unit !== "in") {
      return;
    }
    state.shopPad.decimal = "";
    state.shopPad.editingDecimal = false;
    state.shopPad.fraction = Number.parseFloat(fractionValue);
    state.shopPad.fractionLabel = button.dataset.padFractionLabel || "";
    state.shopPad.manualFractionMode = false;
    state.shopPad.manualFractionNumerator = "";
    state.shopPad.manualFractionDenominator = "";
    updateShopPadOutput();
    return;
  }
  if (action === "slash") {
    if (state.shopPad.manualFractionMode) {
      updateShopPadOutput();
      return;
    }
    state.shopPad.decimal = "";
    state.shopPad.editingDecimal = false;
    state.shopPad.fraction = 0;
    state.shopPad.fractionLabel = "";
    const source = state.shopPad.whole || "";
    if (source) {
      state.shopPad.manualFractionNumerator = source.slice(-1);
      state.shopPad.whole = source.slice(0, -1);
    } else {
      state.shopPad.manualFractionNumerator = "";
    }
    state.shopPad.manualFractionDenominator = "";
    state.shopPad.manualFractionMode = true;
    updateShopPadOutput();
    return;
  }
  if (action === "decimal") {
    state.shopPad.manualFractionMode = false;
    state.shopPad.manualFractionNumerator = "";
    state.shopPad.manualFractionDenominator = "";
    state.shopPad.editingDecimal = true;
    state.shopPad.fraction = 0;
    state.shopPad.fractionLabel = "";
    updateShopPadOutput();
    return;
  }
  if (action === "backspace") {
    if (state.shopPad.manualFractionMode) {
      if (state.shopPad.manualFractionDenominator.length > 0) {
        state.shopPad.manualFractionDenominator = state.shopPad.manualFractionDenominator.slice(0, -1);
      } else if (state.shopPad.manualFractionNumerator) {
        state.shopPad.whole = `${state.shopPad.whole}${state.shopPad.manualFractionNumerator}`;
        state.shopPad.manualFractionNumerator = "";
        state.shopPad.manualFractionMode = false;
      } else {
        state.shopPad.manualFractionMode = false;
      }
    } else if (state.shopPad.editingDecimal && state.shopPad.decimal.length > 0) {
      state.shopPad.decimal = state.shopPad.decimal.slice(0, -1);
      if (!state.shopPad.decimal) {
        state.shopPad.editingDecimal = false;
      }
    } else if (state.shopPad.editingDecimal && !state.shopPad.decimal) {
      state.shopPad.editingDecimal = false;
    } else if (state.shopPad.whole.length > 0) {
      state.shopPad.whole = state.shopPad.whole.slice(0, -1);
    } else if (state.shopPad.fractionLabel) {
      state.shopPad.fraction = 0;
      state.shopPad.fractionLabel = "";
    }
    updateShopPadOutput();
    return;
  }
  if (action === "clear") {
    state.shopPad.whole = "";
    state.shopPad.decimal = "";
    state.shopPad.editingDecimal = false;
    state.shopPad.fraction = 0;
    state.shopPad.fractionLabel = "";
    state.shopPad.manualFractionMode = false;
    state.shopPad.manualFractionNumerator = "";
    state.shopPad.manualFractionDenominator = "";
    updateShopPadOutput();
    return;
  }
  if (action === "next") {
    moveToNextShopPadField();
    return;
  }
  if (action === "prev") {
    moveToPreviousShopPadField();
  }
}

elements.unitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setUnit(button.dataset.unitBtn);
  });
});

elements.setupCollapseBtn.addEventListener("click", () => {
  setSetupCollapsed(!state.setupCollapsed);
});

elements.setupPadBtn.addEventListener("click", () => {
  const setupFields = [elements.sheetWidth, elements.sheetHeight, elements.kerf];
  const activeElement = document.activeElement;
  const activeSetupField = setupFields.find((field) => field === activeElement);
  const target = activeSetupField || setupFields[0];
  if (target) {
    openShopPad(target);
  }
});

elements.piecePadBtn.addEventListener("click", () => {
  const pieceFields = state.howManyFitMode
    ? [elements.pieceWidth, elements.pieceHeight]
    : [elements.pieceQty, elements.pieceWidth, elements.pieceHeight];
  const activeElement = document.activeElement;
  const activePieceField = pieceFields.find((field) => field === activeElement);
  const target = activePieceField || pieceFields[0];
  if (target) {
    openShopPad(target);
  }
});

elements.guideCollapseBtn.addEventListener("click", () => {
  setGuideCollapsed(!state.guideCollapsed);
});

elements.fitToggle.addEventListener("change", (event) => {
  state.howManyFitMode = event.target.checked;
  renderFitModeUi();
  if (state.shopPad.open && state.shopPad.flow === "piece") {
    const pieceFields = getPiecePadFlowFields();
    if (!pieceFields.includes(state.shopPad.target)) {
      openShopPad(pieceFields[0]);
    } else {
      updateShopPadNextButtonLabel();
    }
  }
  setStatus(state.howManyFitMode ? "How Many Fit mode enabled." : "How Many Fit mode disabled.");
});

elements.addPieceBtn.addEventListener("click", () => {
  if (state.howManyFitMode) {
    runHowManyFitLayout();
    return;
  }
  addPiece();
});
elements.generateBtn.addEventListener("click", generateLayout);
elements.exportBtn.addEventListener("click", exportAsPdf);

elements.clearBtn.addEventListener("click", () => {
  state.pieces = [];
  clearLayoutState();
  renderPieceList();
  renderSummary();
  renderChecklist();
  drawCanvas();
  setStatus("Cut list and layout cleared.");
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

elements.shopModeBtn.addEventListener("click", toggleShopMode);
elements.bookmarkBtn.addEventListener("click", bookmarkHint);
elements.shareBtn.addEventListener("click", shareLayout);
elements.homeBtn.addEventListener("click", promptInstall);

elements.shopPadClose.addEventListener("click", closeShopPad);
elements.shopPadModal.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const button = target.closest("button");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  handleShopPadAction(button);
});
elements.shopPadOverlay.addEventListener("click", (event) => {
  if (event.target === elements.shopPadOverlay) {
    closeShopPad();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.shopPad.open) {
    closeShopPad();
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.deferredInstallPrompt = event;
  setStatus("Install ready. Use Add to Home when needed.");
});
window.addEventListener("appinstalled", () => {
  state.deferredInstallPrompt = null;
  setStatus("The Sheet Cut Wizard was added to your home screen.");
});

window.addEventListener("fullscreenchange", syncShopModeButton);
window.addEventListener("resize", () => {
  syncShopPadInputMode();
  drawCanvas();
});

renderUnitUi();
setGuideCollapsed(false);
renderFitModeUi();
setInputSteps();
setInputsFromState();
syncShopPadInputMode();
renderPieceList();
renderSummary();
renderChecklist();
drawCanvas();
setStatus("Set sheet size, add pieces, then generate your cut map.");

