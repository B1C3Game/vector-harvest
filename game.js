const GRID_SIZE = 20;
const MAX_TURNS = 10;
const MAX_ROUNDS = 10;
const MAX_COMMANDS = 4;
const SEGMENT_LENGTHS = [1, 2, 3, 4];
const DIRECTIONS = {
  up: { x: 0, y: -1, arrow: "↑" },
  down: { x: 0, y: 1, arrow: "↓" },
  left: { x: -1, y: 0, arrow: "←" },
  right: { x: 1, y: 0, arrow: "→" },
  skip: { x: 0, y: 0, arrow: "—" },
};

const canvas = document.querySelector("#board");
const context = canvas.getContext("2d");
const segmentsElement = document.querySelector("#segments");
const executeButton = document.querySelector("#execute");
const clearButton = document.querySelector("#clear");
const statusElement = document.querySelector("#status");
const scoreElement = document.querySelector("#score");
const capitalElement = document.querySelector("#capital");
const roundElement = document.querySelector("#round");
const turnElement = document.querySelector("#turn");
const atRiskElement = document.querySelector("#at-risk");
const routeValueElement = document.querySelector("#route-value");
const gameOverElement = document.querySelector("#game-over");
const finalScoreElement = document.querySelector("#final-score");
const restartButton = document.querySelector("#restart");
const upgradeChoiceElement = document.querySelector("#upgrade-choice");
const ledgerLabelElement = document.querySelector("#ledger-label");
const ledgerTitleElement = document.querySelector("#ledger-title");
const ledgerOpeningElement = document.querySelector("#ledger-opening");
const ledgerHarvestElement = document.querySelector("#ledger-harvest");
const ledgerGrossElement = document.querySelector("#ledger-gross");
const ledgerTaxLabelElement = document.querySelector("#ledger-tax-label");
const ledgerTaxElement = document.querySelector("#ledger-tax");
const yieldMultiplierElement = document.querySelector("#yield-multiplier");
const marketLevelElement = document.querySelector("#market-level");
const taxRateElement = document.querySelector("#tax-rate");
const capitalHistoryElement = document.querySelector("#capital-history");

let player;
let pickups;
let program;
let selectedLength;
let score;
let turn;
let nextPickupId;
let animationFrame;
let animating;
let activeRoute;
let capital;
let round;
let yieldMultiplier;
let marketLevel;
let wealthTaxRate;
let capitalHistory;

function randomInt(minimum, maximum) {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function sameCell(first, second) {
  return first.x === second.x && first.y === second.y;
}

function occupiedByPickup(cell) {
  return pickups.some((pickup) => sameCell(pickup, cell));
}

function spawnPickup() {
  const isTimed = Math.random() < 0.3;
  const values = isTimed ? [8, 13] : [2, 3, 5];
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const cell = { x: randomInt(0, GRID_SIZE - 1), y: randomInt(0, GRID_SIZE - 1) };
    if (sameCell(cell, player) || occupiedByPickup(cell)) continue;

    const value = Math.round(values[randomInt(0, values.length - 1)] * yieldMultiplier);
    pickups.push({
      ...cell,
      id: nextPickupId,
      value,
      expiresIn: isTimed ? 2 : null,
    });
    nextPickupId += 1;
    return;
  }
}

function startRound() {
  clearTimeout(animationFrame);
  player = { x: 9, y: 9 };
  pickups = [];
  program = [];
  selectedLength = 1;
  score = 0;
  turn = 1;
  animating = false;
  activeRoute = null;
  gameOverElement.hidden = true;
  for (let index = 0; index < 40 + marketLevel * 8; index += 1) spawnPickup();
  render();
}

function resetGame() {
  capital = 0;
  round = 1;
  yieldMultiplier = 1;
  marketLevel = 0;
  wealthTaxRate = 0.1;
  capitalHistory = [];
  nextPickupId = 1;
  restartButton.hidden = true;
  upgradeChoiceElement.hidden = false;
  startRound();
}

function closeRound() {
  const openingCapital = capital;
  const taxableWealth = openingCapital + score;
  const tax = Math.floor(taxableWealth * wealthTaxRate);
  capital = taxableWealth - tax;
  capitalHistory.push(capital);

  ledgerOpeningElement.textContent = openingCapital.toLocaleString();
  ledgerHarvestElement.textContent = `+${score.toLocaleString()}`;
  ledgerGrossElement.textContent = taxableWealth.toLocaleString();
  ledgerTaxLabelElement.textContent = `Wealth tax ${Math.round(wealthTaxRate * 100)}%`;
  ledgerTaxElement.textContent = `−${tax.toLocaleString()}`;
  finalScoreElement.textContent = capital.toLocaleString();
  capitalHistoryElement.textContent = capitalHistory.map((value) => value.toLocaleString()).join(" → ");
  capitalElement.textContent = capital.toLocaleString();

  if (round >= MAX_ROUNDS) {
    ledgerLabelElement.textContent = "CAMPAIGN COMPLETE";
    ledgerTitleElement.textContent = "Final account";
    upgradeChoiceElement.hidden = true;
    restartButton.hidden = false;
  } else {
    ledgerLabelElement.textContent = `ROUND ${round} LEDGER`;
    ledgerTitleElement.textContent = "Tax assessed";
    upgradeChoiceElement.hidden = false;
    restartButton.hidden = true;
  }
  gameOverElement.hidden = false;
}

function chooseUpgrade(upgradeName) {
  if (round >= MAX_ROUNDS) return;
  if (upgradeName === "yield") yieldMultiplier *= 1.5;
  if (upgradeName === "density") marketLevel += 1;
  if (upgradeName === "shelter") wealthTaxRate = Math.max(0, wealthTaxRate - 0.02);
  round += 1;
  startRound();
}

function buildRoute() {
  const cells = [{ ...player }];
  const corners = [{ ...player }];
  let current = { ...player };
  let inBounds = true;

  program.forEach((command) => {
    if (command.direction === "skip") {
      corners.push({ ...current });
      return;
    }
    const direction = DIRECTIONS[command.direction];
    for (let step = 0; step < command.length; step += 1) {
      current = { x: current.x + direction.x, y: current.y + direction.y };
      cells.push({ ...current });
      if (current.x < 0 || current.x >= GRID_SIZE || current.y < 0 || current.y >= GRID_SIZE) inBounds = false;
    }
    corners.push({ ...current });
  });

  return { cells, corners, inBounds };
}

function routePickups(route) {
  return pickups.filter((pickup) => route.cells.some((cell) => sameCell(cell, pickup)));
}

function collectAtCell(cell) {
  const collected = pickups.filter((pickup) => sameCell(pickup, cell));
  if (collected.length === 0) return;

  score += collected.reduce((total, pickup) => total + pickup.value, 0);
  const collectedIds = new Set(collected.map((pickup) => pickup.id));
  pickups = pickups.filter((pickup) => !collectedIds.has(pickup.id));
  scoreElement.textContent = score;
}

function assignDirection(directionName) {
  if (gameOverElement.hidden === false || animating) return;
  if (program.length >= MAX_COMMANDS) return;
  program.push({ length: directionName === "skip" ? 0 : selectedLength, direction: directionName });
  render();
}

function undo() {
  if (animating) return;
  program.pop();
  render();
}

function clearProgram() {
  if (animating) return;
  program = [];
  render();
}

function executeRoute() {
  const route = buildRoute();
  if (program.length === 0 || !route.inBounds || animating) return;

  animating = true;
  activeRoute = route;

  render();
  animateRoute(route.cells, () => {
    pickups = pickups
      .map((pickup) => pickup.expiresIn === null
        ? pickup
        : { ...pickup, expiresIn: pickup.expiresIn - 1 })
      .filter((pickup) => pickup.expiresIn === null || pickup.expiresIn > 0);
    animating = false;
    activeRoute = null;
    player = { ...route.cells.at(-1) };
    if (turn >= MAX_TURNS) {
      render();
      closeRound();
      return;
    }
    turn += 1;
    for (let index = 0; index < 5 + marketLevel; index += 1) spawnPickup();
    clearProgram();
  });
}

function animateRoute(cells, onComplete) {
  let index = 0;
  const step = () => {
    player = { ...cells[index] };
    collectAtCell(player);
    drawBoard();
    index += 1;
    if (index < cells.length) {
      animationFrame = window.setTimeout(step, 65);
    } else {
      onComplete();
    }
  };
  step();
}

function renderSegments() {
  segmentsElement.replaceChildren(...Array.from({ length: MAX_COMMANDS }, (_, index) => {
    const button = document.createElement("button");
    const command = program[index];
    button.type = "button";
    button.className = `segment${command ? " assigned" : ""}`;
    button.disabled = !command;
    button.setAttribute("aria-label", command ? `Remove command ${index + 1}` : `Empty command ${index + 1}`);
    button.innerHTML = `
      <span class="segment-number">${command ? command.length || "—" : index + 1}</span>
      <span class="segment-state">${command ? `#${index + 1} ${command.direction}` : "empty"}</span>
      <span class="segment-arrow">${command ? DIRECTIONS[command.direction].arrow : "·"}</span>
    `;
    button.addEventListener("click", () => {
      program.splice(index, 1);
      render();
    });
    return button;
  }));
}

function render() {
  renderSegments();
  const route = buildRoute();
  const available = routePickups(route);
  const routeValue = available.reduce((total, pickup) => total + pickup.value, 0);
  const ready = program.length > 0 && route.inBounds;

  executeButton.disabled = !ready || gameOverElement.hidden === false || animating;
  routeValueElement.textContent = `+${routeValue}`;
  scoreElement.textContent = score;
  capitalElement.textContent = capital.toLocaleString();
  roundElement.textContent = round;
  turnElement.textContent = turn;
  atRiskElement.textContent = pickups.filter((pickup) => pickup.expiresIn === 1).length;
  yieldMultiplierElement.textContent = `×${yieldMultiplier.toFixed(2)}`;
  marketLevelElement.textContent = `+${marketLevel}`;
  taxRateElement.textContent = `${Math.round(wealthTaxRate * 100)}%`;

  if (!route.inBounds) {
    statusElement.textContent = "Route leaves the board. Redirect one of the links.";
  } else if (routeValue > 0) {
    statusElement.textContent = `Ready: ${program.length}/4 commands cross ${available.length} pickup${available.length === 1 ? "" : "s"} worth ${routeValue}.`;
  } else if (program.length > 0) {
    statusElement.textContent = `Ready: ${program.length}/4 commands. This route crosses no pickups.`;
  } else {
    statusElement.textContent = `Magnitude ${selectedLength} selected. Choose a direction.`;
  }
  document.querySelectorAll("[data-length]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.length) === selectedLength);
  });
  drawBoard();
}

function drawBoard() {
  const size = canvas.width;
  const cellSize = size / GRID_SIZE;
  const route = activeRoute || buildRoute();
  context.clearRect(0, 0, size, size);
  context.fillStyle = "#fffef8";
  context.fillRect(0, 0, size, size);

  context.strokeStyle = "rgba(32, 33, 31, 0.14)";
  context.lineWidth = 1;
  for (let line = 1; line < GRID_SIZE; line += 1) {
    const position = line * cellSize;
    context.beginPath();
    context.moveTo(position, 0);
    context.lineTo(position, size);
    context.moveTo(0, position);
    context.lineTo(size, position);
    context.stroke();
  }

  pickups.forEach((pickup) => {
    const centerX = (pickup.x + 0.5) * cellSize;
    const centerY = (pickup.y + 0.5) * cellSize;
    const isTimed = pickup.expiresIn !== null;
    context.save();
    context.translate(centerX, centerY);
    context.rotate(Math.PI / 4);
    context.fillStyle = isTimed ? "#ff6b4a" : "#0f8b8d";
    context.fillRect(-cellSize * 0.31, -cellSize * 0.31, cellSize * 0.62, cellSize * 0.62);
    context.restore();
    context.fillStyle = isTimed ? "#20211f" : "#fffef8";
    context.font = "700 16px Bahnschrift, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(pickup.value, centerX, centerY);
    context.fillStyle = "#20211f";
    context.font = "700 10px Bahnschrift, sans-serif";
    if (isTimed) {
      context.fillText(pickup.expiresIn, centerX + cellSize * 0.34, centerY - cellSize * 0.34);
    }
  });

  if (program.length > 0) {
    context.strokeStyle = route.inBounds ? "#20211f" : "#ff6b4a";
    context.lineWidth = 7;
    context.lineCap = "square";
    context.lineJoin = "miter";
    context.beginPath();
    route.corners.forEach((corner, index) => {
      const x = (corner.x + 0.5) * cellSize;
      const y = (corner.y + 0.5) * cellSize;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }

  const playerX = (player.x + 0.5) * cellSize;
  const playerY = (player.y + 0.5) * cellSize;
  context.fillStyle = "#d9f43b";
  context.strokeStyle = "#20211f";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(playerX, playerY, cellSize * 0.32, 0, Math.PI * 2);
  context.fill();
  context.stroke();
}

document.querySelectorAll("[data-direction]").forEach((button) => {
  button.addEventListener("click", () => assignDirection(button.dataset.direction));
});
document.querySelectorAll("[data-length]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedLength = Number(button.dataset.length);
    render();
  });
});
executeButton.addEventListener("click", executeRoute);
clearButton.addEventListener("click", clearProgram);
restartButton.addEventListener("click", resetGame);
document.querySelectorAll("[data-upgrade]").forEach((button) => {
  button.addEventListener("click", () => chooseUpgrade(button.dataset.upgrade));
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) {
    event.preventDefault();
    return;
  }

  const keyDirections = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  if (keyDirections[event.key]) {
    event.preventDefault();
    assignDirection(keyDirections[event.key]);
  } else if (event.code === "Space") {
    event.preventDefault();
    assignDirection("skip");
  } else if (event.key === "Enter") {
    event.preventDefault();
    executeRoute();
  } else if (event.key === "Backspace") {
    event.preventDefault();
    undo();
  } else if (event.key === "Delete") {
    event.preventDefault();
    clearProgram();
  } else if (/^[1-4]$/.test(event.key)) {
    selectedLength = Number(event.key);
    render();
  }
});

resetGame();