// ===== ЭЛЕМЕНТЫ =====
const canvas          = document.getElementById("game");
const ctx             = canvas.getContext("2d");
const scoreEl         = document.getElementById("scoreDisplay");
const bestScoreEl     = document.getElementById("bestScore");
const topCountEl      = document.getElementById("topCount");
const messageEl       = document.getElementById("message");
const restartBtn      = document.getElementById("restartBtn");
const pauseBtn        = document.getElementById("pauseBtn");
const recordsBtn      = document.getElementById("recordsBtn");
const recordsOverlay  = document.getElementById("recordsOverlay");
const recordsList     = document.getElementById("recordsList");
const closeRecordsBtn = document.getElementById("closeRecordsBtn");
const nameOverlay     = document.getElementById("nameOverlay");
const nameInput       = document.getElementById("nameInput");
const finalScoreEl    = document.getElementById("finalScore");
const saveNameBtn     = document.getElementById("saveNameBtn");

// ===== НАСТРОЙКИ =====
const cellSize    = 12;
const tilesX      = canvas.width / cellSize;
const tilesY      = canvas.height / cellSize;
const MAX_RECORDS = 10;
const MIN_NAME    = 1;
const MAX_NAME    = 10;
const STORAGE_KEY = "snakeRecords";
const NAME_KEY    = "snakeLastName";

// Цвета LCD
const COLOR_BG    = "#9bbc0f";
const COLOR_LIGHT = "#8bac0f";
const COLOR_MID   = "#306230";
const COLOR_DARK  = "#0f380f";

// ===== СОСТОЯНИЕ ИГРЫ =====
let snake;
let direction;
let nextDirection;
let food;
let score;
let speed;
let gameInterval;
let gameOver;
let paused;
let lastRecordPosition = -1;

// ===== РЕКОРДЫ =====
function loadRecords() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function getLastName() {
  return localStorage.getItem(NAME_KEY) || "";
}

function setLastName(name) {
  localStorage.setItem(NAME_KEY, name);
}

function addRecord(newScore, playerName) {
  if (newScore === 0) return -1;

  const records = loadRecords();

  const name = playerName.trim().toUpperCase().slice(0, MAX_NAME);

  const entry = {
    name: name,
    score: newScore,
    date: new Date().toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }),
    _id: Date.now(),
  };

  records.push(entry);
  records.sort((a, b) => b.score - a.score);

  if (records.length > MAX_RECORDS) {
    records.length = MAX_RECORDS;
  }

  saveRecords(records);

  const position = records.findIndex((r) => r._id === entry._id);
  return position;
}

function getBestScore() {
  const records = loadRecords();
  return records.length > 0 ? records[0].score : 0;
}

function updateBestScoreDisplay() {
  bestScoreEl.textContent = pad(getBestScore());
  topCountEl.textContent = loadRecords().length;
}

// ===== ВАЛИДАЦИЯ НИКА =====
function validateName(name) {
  const trimmed = name.trim();

  if (trimmed.length < MIN_NAME) {
    return { valid: false, error: "Name cannot be empty" };
  }

  if (trimmed.length > MAX_NAME) {
    return { valid: false, error: "Max " + MAX_NAME + " characters" };
  }

  // разрешаем буквы, цифры, пробелы, дефисы, подчёркивания
  const allowed = /^[a-zA-Zа-яА-ЯёЁ0-9 _\-]+$/;
  if (!allowed.test(trimmed)) {
    return { valid: false, error: "Letters, numbers, - _ only" };
  }

  return { valid: true, error: "" };
}

function showNameError(text) {
  let errorEl = document.querySelector(".name-error");

  if (!errorEl) {
    errorEl = document.createElement("p");
    errorEl.className = "name-error";
    nameInput.parentNode.insertBefore(errorEl, nameInput.nextSibling);
  }

  errorEl.textContent = text;

  nameInput.classList.add("error");
  setTimeout(() => {
    nameInput.classList.remove("error");
  }, 400);
}

function clearNameError() {
  const errorEl = document.querySelector(".name-error");
  if (errorEl) {
    errorEl.textContent = "";
  }
  nameInput.classList.remove("error");
}

// ===== РЕНДЕР РЕКОРДОВ =====
function renderRecordsList(highlightIndex) {
  const records = loadRecords();
  recordsList.innerHTML = "";

  if (records.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-message";
    li.textContent = "No records yet. Play a game!";
    recordsList.appendChild(li);
    return;
  }

  records.forEach((record, index) => {
    const li = document.createElement("li");

    if (index === highlightIndex) {
      li.classList.add("new-record");
    }

    li.innerHTML = `
      <span class="rank">${index + 1}.</span>
      <span class="record-name">${escapeHtml(record.name)}</span>
      <span class="record-score">${pad(record.score)}</span>
      <span class="record-date">${record.date}</span>
    `;

    recordsList.appendChild(li);
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===== ОВЕРЛЕИ =====
function showNameInput() {
  finalScoreEl.textContent = pad(score);

  const lastName = getLastName();
  nameInput.value = lastName;

  clearNameError();

  nameOverlay.classList.add("active");

  setTimeout(() => {
    nameInput.focus();
    nameInput.select();
  }, 100);
}

function hideNameInput() {
  nameOverlay.classList.remove("active");
  clearNameError();
}

function showRecords(highlightIndex = -1) {
  renderRecordsList(highlightIndex);
  recordsOverlay.classList.add("active");
}

function hideRecords() {
  recordsOverlay.classList.remove("active");
}

function submitName() {
  const name = nameInput.value.trim();

  // валидация
  const result = validateName(name);

  if (!result.valid) {
    showNameError(result.error);
    nameInput.focus();
    return; // не закрываем окно, ждём правильный ник
  }

  // сохраняем ник для следующей игры
  setLastName(name);

  hideNameInput();

  const position = addRecord(score, name);
  lastRecordPosition = position;
  updateBestScoreDisplay();

  if (position >= 0) {
    setTimeout(() => {
      showRecords(position);
    }, 300);
  }
}

// ===== УТИЛИТЫ =====
function pad(n) {
  return String(n).padStart(4, "0");
}

function randomFood() {
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * tilesX),
      y: Math.floor(Math.random() * tilesY),
    };
  } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
  return pos;
}

// ===== РИСОВАНИЕ =====
function drawCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(
    x * cellSize + 1,
    y * cellSize + 1,
    cellSize - 2,
    cellSize - 2
  );
}

function drawGrid() {
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = COLOR_LIGHT;
  for (let x = 0; x < tilesX; x++) {
    for (let y = 0; y < tilesY; y++) {
      if ((x + y) % 2 === 0) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }
}

function drawFood() {
  const blink = Math.floor(Date.now() / 300) % 2 === 0;
  drawCell(food.x, food.y, blink ? COLOR_DARK : COLOR_MID);
}

function drawSnake() {
  snake.forEach((seg, i) => {
    drawCell(seg.x, seg.y, i === 0 ? COLOR_DARK : COLOR_MID);
  });
}

function drawGameOver() {
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(30, 70, 180, 100);

  ctx.strokeStyle = COLOR_DARK;
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 70, 180, 100);

  ctx.fillStyle = COLOR_DARK;
  ctx.font = "12px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, 100);

  ctx.font = "8px 'Press Start 2P'";
  ctx.fillText("Score: " + pad(score), canvas.width / 2, 120);
  ctx.fillText("Best: " + pad(getBestScore()), canvas.width / 2, 138);

  ctx.font = "6px 'Press Start 2P'";
  ctx.fillText("RESTART or RECORDS", canvas.width / 2, 158);
}

function drawPaused() {
  ctx.fillStyle = COLOR_DARK;
  ctx.font = "10px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
}

function drawNewRecord() {
  ctx.fillStyle = COLOR_DARK;
  ctx.font = "8px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.fillText("★ NEW RECORD! ★", canvas.width / 2, 56);
}

function draw() {
  drawGrid();
  drawFood();
  drawSnake();

  if (gameOver) {
    drawGameOver();

    if (score > 0 && score >= getBestScore()) {
      drawNewRecord();
    }
  }

  if (paused && !gameOver) {
    drawPaused();
  }
}

// ===== ЛОГИКА =====
function endGame() {
  gameOver = true;
  clearInterval(gameInterval);

  if (score > 0) {
    setTimeout(() => {
      showNameInput();
    }, 1000);
  }
}

function move() {
  if (gameOver || paused) return;

  direction = nextDirection;

  const head = { ...snake[0] };

  if (direction === "up") head.y -= 1;
  if (direction === "down") head.y += 1;
  if (direction === "left") head.x -= 1;
  if (direction === "right") head.x += 1;

  if (head.x < 0 || head.x >= tilesX || head.y < 0 || head.y >= tilesY) {
    endGame();
    return;
  }

  const willEat = head.x === food.x && head.y === food.y;
  const body = willEat ? snake : snake.slice(0, -1);

  if (body.some((s) => s.x === head.x && s.y === head.y)) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (willEat) {
    score++;
    scoreEl.textContent = pad(score);
    food = randomFood();

    if (speed > 80) {
      speed -= 4;
      clearInterval(gameInterval);
      gameInterval = setInterval(gameLoop, speed);
    }
  } else {
    snake.pop();
  }
}

function gameLoop() {
  move();
  draw();
}

// ===== НАПРАВЛЕНИЕ =====
function setDirection(dir) {
  const opposites = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };

  if (dir !== opposites[direction]) {
    nextDirection = dir;
  }
}

// ===== ПАУЗА =====
function togglePause() {
  if (gameOver) return;
  paused = !paused;
  draw();
}

// ===== СБРОС =====
function resetGame() {
  hideRecords();
  hideNameInput();

  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];

  direction = "right";
  nextDirection = "right";
  score = 0;
  speed = 150;
  gameOver = false;
  paused = false;
  lastRecordPosition = -1;

  scoreEl.textContent = pad(score);
  messageEl.textContent = "";

  food = randomFood();
  updateBestScoreDisplay();

  clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, speed);

  draw();
}

// ===== ПРОВЕРКА: ОВЕРЛЕЙ ОТКРЫТ? =====
function isOverlayOpen() {
  return (
    nameOverlay.classList.contains("active") ||
    recordsOverlay.classList.contains("active")
  );
}

// ===== ВВОД: КЛАВИАТУРА =====
document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  // окно ввода ника
  if (nameOverlay.classList.contains("active")) {
    if (key === "enter") {
      e.preventDefault();
      submitName();
    }
    return;
  }

  // окно рекордов
  if (recordsOverlay.classList.contains("active")) {
    hideRecords();
    return;
  }

  // движение: стрелки + WASD + русская раскладка
  if (key === "arrowup"    || key === "w" || key === "ц") {
    e.preventDefault();
    setDirection("up");
  }
  if (key === "arrowdown"  || key === "s" || key === "ы") {
    e.preventDefault();
    setDirection("down");
  }
  if (key === "arrowleft"  || key === "a" || key === "ф") {
    e.preventDefault();
    setDirection("left");
  }
  if (key === "arrowright" || key === "d" || key === "в") {
    e.preventDefault();
    setDirection("right");
  }

  // пауза
  if (key === "p" || key === "з") togglePause();

  // рестарт
  if (key === "r" || key === "к") resetGame();

  // рекорды
  if (key === "t" || key === "е") showRecords();
});

// ===== ВВОД: D-PAD КНОПКИ =====
document.querySelectorAll(".dpad-btn").forEach((btn) => {
  const handler = (e) => {
    e.preventDefault();
    if (isOverlayOpen()) return;
    setDirection(btn.dataset.dir);
  };

  btn.addEventListener("click", handler);
  btn.addEventListener("touchstart", handler, { passive: false });
});

// ===== ВВОД: КНОПКИ ДЕЙСТВИЙ =====
restartBtn.addEventListener("click", resetGame);
pauseBtn.addEventListener("click", togglePause);
recordsBtn.addEventListener("click", () => showRecords());

// ===== ВВОД: ОКНО НИКА =====
saveNameBtn.addEventListener("click", submitName);

// очищаем ошибку при вводе
nameInput.addEventListener("input", () => {
  clearNameError();
});

// не даём клавишам влиять на игру
nameInput.addEventListener("keydown", (e) => {
  e.stopPropagation();
});

// ===== ВВОД: ОКНО РЕКОРДОВ =====
closeRecordsBtn.addEventListener("click", hideRecords);

recordsOverlay.addEventListener("click", (e) => {
  if (e.target === recordsOverlay) {
    hideRecords();
  }
});

// ===== ЗАПУСК =====
updateBestScoreDisplay();
resetGame();
