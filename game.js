const GRID_SIZE = 20;
const MAX_TURNS = 10;
const MAX_ROUNDS = 10;
const MAX_COMMANDS = 4;
const MAX_ENDPOINTS_PER_ROUND = MAX_TURNS * MAX_COMMANDS;
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
const totalTaxPaidElement = document.querySelector("#total-tax-paid");
const capitalHistoryElement = document.querySelector("#capital-history");
const taxPaidHistoryElement = document.querySelector("#tax-paid-history");
const treasuryBenefitElement = document.querySelector("#treasury-benefit");
const timedLifetimeElement = document.querySelector("#timed-lifetime");
const upgradeGridElement = document.querySelector("#upgrade-grid");
const lengthLabelElement = document.querySelector("#length-label");
const keyboardStatusElement = document.querySelector("#keyboard-status");

let player;
let pickups;
let cellTaxes;
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
let totalTaxPaid;
let capitalHistory;
let taxPaidHistory;
let timedLifetimeBonus;
let lengthSupply;
let upgradeOffers;

function randomInt(minimum, maximum) {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function setKeyboardActive(active) {
  keyboardStatusElement.classList.toggle("active", active);
  keyboardStatusElement.closest("footer").classList.toggle("shortcuts-active", active);
  keyboardStatusElement.querySelector("b").textContent = active ? "Keys active" : "Click game · keys off";
}

function sameCell(first, second) {
  return first.x === second.x && first.y === second.y;
}

function occupiedByPickup(cell) {
  return pickups.some((pickup) => sameCell(pickup, cell));
}

function treasuryLifetimeBonus() {
  return Math.min(2, Math.floor(totalTaxPaid / 100));
}

function timedPickupLifetime() {
  return 2 + timedLifetimeBonus + treasuryLifetimeBonus();
}

function rollLengthSupply() {
  return Object.fromEntries(SEGMENT_LENGTHS.map((length) => {
    const roll = Math.random();
    const uses = roll < 0.5 ? 1 : roll < 0.8 ? 2 : roll < 0.95 ? 3 : 4;
    return [length, uses];
  }));
}

function usedLengthCount(length) {
  return program.filter((command) => command.length === length).length;
}

function remainingLengthUses(length) {
  return lengthSupply[length] - usedLengthCount(length);
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
      expiresIn: isTimed ? timedPickupLifetime() : null,
    });
    nextPickupId += 1;
    return;
  }
}

function generateCellTaxes() {
  const roundTaxBudget = round * 0.001;
  const baseCellTax = roundTaxBudget / MAX_ENDPOINTS_PER_ROUND;
  return Array.from({ length: GRID_SIZE * GRID_SIZE }, () => {
    const roll = Math.random();
    if (roll < 0.9) return baseCellTax;
    if (roll < 0.98) return baseCellTax * 2;
    return baseCellTax * 5;
  });
}

function taxAtCell(cell) {
  return cellTaxes[cell.y * GRID_SIZE + cell.x];
}

function formatTaxRate(taxRate, precision = taxRate > 0 && taxRate < 0.0001 ? 4 : 2) {
  return `${(taxRate * 100).toFixed(precision)}%`;
}

function updateTreasuryDisplay() {
  const treasuryBonus = treasuryLifetimeBonus();
  timedLifetimeElement.textContent = `${timedPickupLifetime()} turns`;
  if (treasuryBonus >= 2) {
    treasuryBenefitElement.textContent = "Red +2 turns active";
  } else if (treasuryBonus === 1) {
    treasuryBenefitElement.textContent = `Red +1 active · ${200 - totalTaxPaid} to +2`;
  } else {
    treasuryBenefitElement.textContent = `${100 - totalTaxPaid} until red +1 turn`;
  }
}

function createUpgradeOffers() {
  const availableTypes = ["yield", "density", "shelter"];
  if (timedLifetimeBonus < 2) availableTypes.push("lifetime");
  const offerTypes = availableTypes
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  return offerTypes.map((type) => {
    if (type === "yield") {
      const factor = [1.2, 1.3, 1.4, 1.5, 1.6][randomInt(0, 4)];
      return { type, value: factor, title: `×${factor.toFixed(1)} Yield`, detail: "Future pickup values compound." };
    }
    if (type === "density") {
      const levels = randomInt(1, 2);
      return { type, value: levels, title: `Market +${levels * 8}`, detail: `+${levels * 8} starting and +${levels} per-turn pickup.` };
    }
    if (type === "lifetime") {
      return { type, value: 1, title: "Red +1 turn", detail: "Timed pickups remain longer permanently." };
    }
    const reduction = [0.1, 0.2, 0.3][randomInt(0, 2)];
    return { type, value: reduction, title: `Shelter ${Math.round(reduction * 100)}%`, detail: "Remove this share of the current tax rate." };
  });
}

function renderUpgradeOffers() {
  upgradeGridElement.replaceChildren(...upgradeOffers.map((offer, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<strong>${offer.title}</strong><span>${offer.detail}</span>`;
    button.addEventListener("click", () => chooseUpgrade(index));
    return button;
  }));
}

function startRound() {
  clearTimeout(animationFrame);
  player = { x: 9, y: 9 };
  pickups = [];
  cellTaxes = generateCellTaxes();
  program = [];
  lengthSupply = rollLengthSupply();
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
  wealthTaxRate = 0;
  totalTaxPaid = 0;
  capitalHistory = [];
  taxPaidHistory = [];
  timedLifetimeBonus = 0;
  upgradeOffers = [];
  nextPickupId = 1;
  restartButton.hidden = true;
  upgradeChoiceElement.hidden = false;
  startRound();
}

function closeRound() {
  const openingCapital = capital;
  const taxableWealth = openingCapital + score;
  const tax = Math.floor(taxableWealth * wealthTaxRate);
  totalTaxPaid += tax;
  capital = taxableWealth - tax;
  capitalHistory.push(capital);
  taxPaidHistory.push(totalTaxPaid);

  ledgerOpeningElement.textContent = openingCapital.toLocaleString();
  ledgerHarvestElement.textContent = `+${score.toLocaleString()}`;
  ledgerGrossElement.textContent = taxableWealth.toLocaleString();
  ledgerTaxLabelElement.textContent = `Wealth tax ${formatTaxRate(wealthTaxRate)}`;
  ledgerTaxElement.textContent = `−${tax.toLocaleString()}`;
  finalScoreElement.textContent = capital.toLocaleString();
  capitalHistoryElement.textContent = capitalHistory.map((value) => value.toLocaleString()).join(" → ");
  taxPaidHistoryElement.textContent = taxPaidHistory.map((value) => value.toLocaleString()).join(" → ");
  capitalElement.textContent = capital.toLocaleString();
  totalTaxPaidElement.textContent = totalTaxPaid.toLocaleString();
  updateTreasuryDisplay();

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
    upgradeOffers = createUpgradeOffers();
    renderUpgradeOffers();
  }
  gameOverElement.hidden = false;
}

function chooseUpgrade(offerIndex) {
  if (round >= MAX_ROUNDS) return;
  const offer = upgradeOffers[offerIndex];
  if (!offer) return;
  if (offer.type === "yield") yieldMultiplier *= offer.value;
  if (offer.type === "density") marketLevel += offer.value;
  if (offer.type === "lifetime") timedLifetimeBonus += offer.value;
  if (offer.type === "shelter") wealthTaxRate *= 1 - offer.value;
  round += 1;
  startRound();
}

function buildRoute() {
  const cells = [{ ...player }];
  const corners = [{ ...player }];
  const harvestCellIndexes = [];
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
    harvestCellIndexes.push(cells.length - 1);
  });

  return { cells, corners, harvestCellIndexes, inBounds };
}

function routePickups(route) {
  const harvestCells = route.harvestCellIndexes.map((index) => route.cells[index]);
  return pickups.filter((pickup) => harvestCells.some((cell) => sameCell(cell, pickup)));
}

function routeTax(route) {
  const endpointIndexes = new Set(route.harvestCellIndexes);
  return route.cells.reduce((total, cell, index) => {
    if (index === 0) return total;
    return total + taxAtCell(cell) * (endpointIndexes.has(index) ? 1 : 0.5);
  }, 0);
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
  if (directionName !== "skip" && remainingLengthUses(selectedLength) <= 0) {
    statusElement.textContent = `Length ${selectedLength} supply exhausted. Choose another length or undo.`;
    return;
  }
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
  animateRoute(route, () => {
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
    lengthSupply = rollLengthSupply();
    for (let index = 0; index < 5 + marketLevel; index += 1) spawnPickup();
    clearProgram();
  });
}

function animateRoute(route, onComplete) {
  let index = 0;
  const harvestCellIndexes = new Set(route.harvestCellIndexes);
  const step = () => {
    player = { ...route.cells[index] };
    if (index > 0) {
      const taxMultiplier = harvestCellIndexes.has(index) ? 1 : 0.5;
      wealthTaxRate = Math.min(1, wealthTaxRate + taxAtCell(player) * taxMultiplier);
    }
    if (harvestCellIndexes.has(index)) {
      collectAtCell(player);
    }
    drawBoard();
    index += 1;
    if (index < route.cells.length) {
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
  const addedTax = route.inBounds ? routeTax(route) : 0;
  const ready = program.length > 0 && route.inBounds;

  executeButton.disabled = !ready || gameOverElement.hidden === false || animating;
  executeButton.classList.toggle("ready", ready && gameOverElement.hidden && !animating);
  routeValueElement.textContent = `+${routeValue}`;
  scoreElement.textContent = score;
  capitalElement.textContent = capital.toLocaleString();
  roundElement.textContent = round;
  turnElement.textContent = turn;
  atRiskElement.textContent = pickups.filter((pickup) => pickup.expiresIn === 1).length;
  yieldMultiplierElement.textContent = `×${yieldMultiplier.toFixed(2)}`;
  marketLevelElement.textContent = `+${marketLevel}`;
  taxRateElement.textContent = formatTaxRate(wealthTaxRate);
  updateTreasuryDisplay();

  if (!route.inBounds) {
    statusElement.textContent = "Route leaves the board. Redirect one of the links.";
  } else if (program.length > 0) {
    const harvestText = routeValue > 0 ? `Harvest +${routeValue}.` : "No harvest.";
    statusElement.textContent = `ROUTE READY — ${harvestText} Tax +${formatTaxRate(addedTax, 4)}.`;
  } else {
    statusElement.textContent = `Length ${selectedLength} selected. Use 1–4 to change it, then choose a direction.`;
  }
  lengthLabelElement.textContent = `Selected length: ${selectedLength} · ${remainingLengthUses(selectedLength)} left`;
  document.querySelectorAll("[data-length]").forEach((button) => {
    const length = Number(button.dataset.length);
    const remaining = remainingLengthUses(length);
    button.textContent = `${length} ×${remaining}`;
    button.disabled = remaining <= 0;
    button.classList.toggle("active", length === selectedLength);
    button.setAttribute("aria-label", `Length ${length}, ${remaining} use${remaining === 1 ? "" : "s"} remaining`);
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

  cellTaxes.forEach((taxRate, index) => {
    const x = index % GRID_SIZE;
    const y = Math.floor(index / GRID_SIZE);
    const baseCellTax = (round * 0.001) / MAX_ENDPOINTS_PER_ROUND;
    const intensity = Math.min(1, taxRate / (baseCellTax * 5));
    context.fillStyle = `rgba(255, 107, 74, ${0.05 + intensity * 0.28})`;
    context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    if (taxRate >= baseCellTax * 2) {
      context.fillStyle = "rgba(32, 33, 31, 0.75)";
      context.font = "700 8px Bahnschrift, sans-serif";
      context.textAlign = "left";
      context.textBaseline = "top";
      context.fillText((taxRate * 100).toFixed(3), x * cellSize + 3, y * cellSize + 3);
    }
  });

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
document.querySelector(".game-shell").addEventListener("pointerdown", () => setKeyboardActive(true));
window.addEventListener("blur", () => setKeyboardActive(false));
window.addEventListener("keydown", (event) => {
  setKeyboardActive(true);
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
    const length = Number(event.key);
    if (remainingLengthUses(length) > 0) selectedLength = length;
    render();
  }
});

resetGame();