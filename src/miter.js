const state = {
  material: "baseboard",
  cornerType: "inside",
  deferredInstallPrompt: null,
};

const elements = {
  materialButtons: [...document.querySelectorAll("[data-material-btn]")],
  cornerButtons: [...document.querySelectorAll("[data-corner-btn]")],
  wallAngle: document.querySelector("#wall-angle"),
  springAngle: document.querySelector("#spring-angle"),
  springAngleField: document.querySelector("#spring-angle-field"),
  leftMiter: document.querySelector("#left-miter"),
  leftBevel: document.querySelector("#left-bevel"),
  rightMiter: document.querySelector("#right-miter"),
  rightBevel: document.querySelector("#right-bevel"),
  statusText: document.querySelector("#status-text"),
  leftCutPreview: document.querySelector("#left-cut-preview"),
  rightCutPreview: document.querySelector("#right-cut-preview"),
  bookmarkBtn: document.querySelector("#bookmark-btn"),
  shareBtn: document.querySelector("#share-btn"),
  homeBtn: document.querySelector("#home-btn"),
};

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatAngle(value) {
  return `${value.toFixed(1)}deg`;
}

function setStatus(message, isError = false) {
  elements.statusText.textContent = message;
  elements.statusText.classList.toggle("error", isError);
}

function applyToggleState(buttons, activeValue, dataName) {
  for (const button of buttons) {
    button.classList.toggle("active", button.dataset[dataName] === activeValue);
  }
}

function readWallAngle() {
  const value = Number.parseFloat(elements.wallAngle.value);
  if (!Number.isFinite(value) || value <= 0 || value >= 180) {
    return null;
  }
  return value;
}

function getMiterSettings() {
  const measuredWallAngle = readWallAngle();
  if (measuredWallAngle === null) {
    return null;
  }

  const W = measuredWallAngle / 2;
  if (state.material === "baseboard") {
    return {
      measuredWallAngle,
      miter: Math.abs(90 - W),
      bevel: 0,
    };
  }

  const springAngle = Number.parseFloat(elements.springAngle.value);
  const springAngleRad = toRadians(springAngle);
  const halfWallRad = toRadians(W);
  const miter = toDegrees(Math.atan(Math.sin(springAngleRad) / Math.tan(halfWallRad)));
  const bevel = toDegrees(
    Math.asin(clamp(Math.cos(springAngleRad) * Math.cos(halfWallRad), -1, 1))
  );

  return {
    measuredWallAngle,
    miter: Math.abs(miter),
    bevel: Math.abs(bevel),
  };
}

function getPoint(cx, cy, radius, angleDeg) {
  const radians = toRadians(angleDeg);
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function toPointString(points) {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

function buildPointedBoardGeometry(cx, cy, angleDeg, length, width) {
  const radians = toRadians(angleDeg);
  const axis = { x: Math.cos(radians), y: Math.sin(radians) };
  const normal = { x: -Math.sin(radians), y: Math.cos(radians) };
  const halfWidth = width / 2;
  const tip = { x: cx, y: cy };
  const farCenter = {
    x: cx + axis.x * length,
    y: cy + axis.y * length,
  };
  const topFar = {
    x: farCenter.x + normal.x * halfWidth,
    y: farCenter.y + normal.y * halfWidth,
  };
  const bottomFar = {
    x: farCenter.x - normal.x * halfWidth,
    y: farCenter.y - normal.y * halfWidth,
  };

  return {
    polygon: [tip, topFar, bottomFar],
    tip,
    topEdge: [tip, topFar],
    bottomEdge: [tip, bottomFar],
    farEdge: [topFar, bottomFar],
    labelPoint: {
      x: cx + axis.x * (length * 0.62),
      y: cy + axis.y * (length * 0.62),
    },
  };
}

function renderCutSetup(preview, side, measuredWallAngle, sawMiterAngle) {
  if (!preview) {
    return;
  }

  const fenceY = 58;
  const boardDepth = 46;
  const centerX = side === "left" ? 220 : 100;
  const outerX = side === "left" ? 12 : 308;
  const safeMiter = clamp(sawMiterAngle, 0.1, 89.4);
  const rawOffset = Math.tan(toRadians(safeMiter)) * boardDepth;
  const cutOffset = clamp(rawOffset, 8, 86);
  const guideLength = 76;
  const miterRadians = toRadians(safeMiter);
  const direction = side === "left" ? -1 : 1;
  const bladeEnd = {
    x: centerX + direction * Math.sin(miterRadians) * guideLength,
    y: fenceY + Math.cos(miterRadians) * guideLength,
  };

  const boardPolygon =
    side === "left"
      ? [
          { x: outerX, y: fenceY },
          { x: centerX, y: fenceY },
          { x: centerX - cutOffset, y: fenceY + boardDepth },
          { x: outerX, y: fenceY + boardDepth },
        ]
      : [
          { x: centerX, y: fenceY },
          { x: outerX, y: fenceY },
          { x: outerX, y: fenceY + boardDepth },
          { x: centerX + cutOffset, y: fenceY + boardDepth },
        ];

  const cutEdgeBottomX = side === "left" ? centerX - cutOffset : centerX + cutOffset;
  const sideLabel = side === "left" ? "TOP side against fence" : "BOTTOM side against fence";
  const rotateLabel = side === "left" ? "Rotate saw LEFT" : "Rotate saw RIGHT";
  const pieceLabel = side === "left" ? "Left Piece" : "Right Piece";
  const cornerLabel = state.cornerType === "inside" ? "Inside Corner" : "Outside Corner";

  preview.innerHTML = `
    <rect class="miter-preview-bg" x="0" y="0" width="320" height="220"></rect>
    <line class="miter-saw-fence" x1="12" y1="${fenceY}" x2="308" y2="${fenceY}"></line>
    <text class="miter-saw-fence-label" x="160" y="${(fenceY - 10).toFixed(2)}">Saw Fence</text>

    <polygon class="miter-board ${side}" points="${toPointString(boardPolygon)}"></polygon>
    <line class="miter-square-edge" x1="${outerX}" y1="${fenceY}" x2="${outerX}" y2="${fenceY + boardDepth}"></line>
    <line class="miter-cut-edge" x1="${centerX}" y1="${fenceY}" x2="${cutEdgeBottomX.toFixed(2)}" y2="${(fenceY + boardDepth).toFixed(2)}"></line>

    <line class="miter-blade-center-line" x1="${centerX}" y1="${fenceY}" x2="${centerX}" y2="${fenceY + 86}"></line>
    <line class="miter-blade-guide ${side}" x1="${centerX}" y1="${fenceY}" x2="${bladeEnd.x.toFixed(2)}" y2="${bladeEnd.y.toFixed(2)}"></line>

    <text class="miter-piece-label" x="160" y="${(fenceY + boardDepth + 26).toFixed(2)}">${pieceLabel}</text>
    <text class="miter-side-tag ${side}" x="160" y="${(fenceY + 17).toFixed(2)}">${sideLabel}</text>
    <text class="miter-angle-label" x="160" y="${(fenceY + 112).toFixed(2)}">Set saw miter to ${safeMiter.toFixed(1)}deg</text>
    <text class="miter-angle-sub" x="160" y="${(fenceY + 130).toFixed(2)}">${rotateLabel} ${safeMiter.toFixed(1)}deg</text>
    <text class="miter-corner-label" x="14" y="204">${cornerLabel}  |  Wall Angle ${measuredWallAngle.toFixed(1)}deg</text>
  `;
}

function renderPreview(measuredWallAngle, sawMiterAngle) {
  renderCutSetup(elements.leftCutPreview, "left", measuredWallAngle, sawMiterAngle);
  renderCutSetup(elements.rightCutPreview, "right", measuredWallAngle, sawMiterAngle);
  renderWallLayoutPreview(measuredWallAngle);
}

function renderWallLayoutPreview(measuredWallAngle) {
  const preview = document.querySelector("#wall-layout-preview");
  if (!preview) {
    return;
  }

  const cx = 120;
  const cy = 108;
  const boardLength = 136;
  const boardWidth = 20;
  const spread = measuredWallAngle / 2;
  const leftAxis = 270 - spread;
  const rightAxis = 270 + spread;

  const leftBoard = buildPointedBoardGeometry(cx, cy, leftAxis, boardLength, boardWidth);
  const rightBoard = buildPointedBoardGeometry(cx, cy, rightAxis, boardLength, boardWidth);
  const leftWallEnd = getPoint(cx, cy, 88, leftAxis);
  const rightWallEnd = getPoint(cx, cy, 88, rightAxis);

  preview.innerHTML = `
    <rect class="wall-preview-bg" x="0" y="0" width="240" height="140"></rect>
    <line class="wall-guide-line" x1="${cx}" y1="${cy}" x2="${leftWallEnd.x.toFixed(2)}" y2="${leftWallEnd.y.toFixed(2)}"></line>
    <line class="wall-guide-line" x1="${cx}" y1="${cy}" x2="${rightWallEnd.x.toFixed(2)}" y2="${rightWallEnd.y.toFixed(2)}"></line>
    <polygon class="wall-board left" points="${toPointString(leftBoard.polygon)}"></polygon>
    <polygon class="wall-board right" points="${toPointString(rightBoard.polygon)}"></polygon>
    <line
      class="wall-square-edge"
      x1="${leftBoard.farEdge[0].x.toFixed(2)}"
      y1="${leftBoard.farEdge[0].y.toFixed(2)}"
      x2="${leftBoard.farEdge[1].x.toFixed(2)}"
      y2="${leftBoard.farEdge[1].y.toFixed(2)}"
    ></line>
    <line
      class="wall-square-edge"
      x1="${rightBoard.farEdge[0].x.toFixed(2)}"
      y1="${rightBoard.farEdge[0].y.toFixed(2)}"
      x2="${rightBoard.farEdge[1].x.toFixed(2)}"
      y2="${rightBoard.farEdge[1].y.toFixed(2)}"
    ></line>
    <text class="wall-preview-label" x="120" y="18">Final Wall Layout</text>
  `;
}

function render() {
  applyToggleState(elements.materialButtons, state.material, "materialBtn");
  applyToggleState(elements.cornerButtons, state.cornerType, "cornerBtn");
  elements.springAngleField.classList.toggle("hidden", state.material !== "crown");

  const settings = getMiterSettings();
  if (!settings) {
    elements.leftMiter.textContent = "--";
    elements.rightMiter.textContent = "--";
    elements.leftBevel.textContent = "--";
    elements.rightBevel.textContent = "--";
    setStatus("Enter a valid wall angle between 0 and 180 degrees.", true);
    renderPreview(90, 45);
    return;
  }

  const miterText = formatAngle(settings.miter);
  const bevelText = formatAngle(settings.bevel);

  elements.leftMiter.textContent = miterText;
  elements.rightMiter.textContent = miterText;
  elements.leftBevel.textContent = bevelText;
  elements.rightBevel.textContent = bevelText;

  const materialLabel = state.material === "crown" ? "Crown molding" : "Baseboard / flat";
  const cornerLabel = state.cornerType === "inside" ? "Inside corner" : "Outside corner";
  setStatus(
    `${materialLabel} for a ${settings.measuredWallAngle.toFixed(1)}deg ${cornerLabel.toLowerCase()}: set miter to ${miterText} and bevel to ${bevelText}.`,
    false
  );

  renderPreview(settings.measuredWallAngle, settings.miter);
}

async function sharePage() {
  const shareData = {
    title: document.title,
    text: "Use this Miter Cut Wizard to calculate trim saw settings.",
    url: window.location.href,
  };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      setStatus("Share dialog opened.");
      return;
    } catch {
      // Fall through to clipboard.
    }
  }
  try {
    await navigator.clipboard.writeText(shareData.url);
    setStatus("Link copied to clipboard.");
  } catch {
    setStatus("Sharing was blocked. Copy the URL from your address bar.", true);
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

for (const button of elements.materialButtons) {
  button.addEventListener("click", () => {
    state.material = button.dataset.materialBtn;
    render();
  });
}

for (const button of elements.cornerButtons) {
  button.addEventListener("click", () => {
    state.cornerType = button.dataset.cornerBtn;
    render();
  });
}

elements.wallAngle.addEventListener("input", render);
elements.wallAngle.addEventListener("change", render);
elements.springAngle.addEventListener("change", render);
elements.bookmarkBtn.addEventListener("click", bookmarkHint);
elements.shareBtn.addEventListener("click", sharePage);
elements.homeBtn.addEventListener("click", promptInstall);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.deferredInstallPrompt = event;
});

render();
