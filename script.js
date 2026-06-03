// ===== ЭЛЕМЕНТЫ =====
const canvas         = document.getElementById("game");
const ctx            = canvas.getContext("2d");
const scoreEl        = document.getElementById("scoreDisplay");
const bestScoreEl    = document.getElementById("bestScore");
const topCountEl     = document.getElementById("topCount");
const messageEl      = document.getElementById("message");
const restartBtn     = document.getElementById("restartBtn");
const pauseBtn       = document.getElementById("pauseBtn");
const recordsBtn     = document.getElementById("recordsBtn");
const recordsOverlay = document.getElementById("recordsOverlay");
const recordsList    = document.getElementById("recordsList");
const closeRecordsBtn = document.getElementById("closeRecordsBtn");
const clearRecordsBtn = document.getElementById("clearRecordsBtn");

// ===== НАСТРОЙКИ =====
const cellSize   = 12;
const tilesX     = canvas.width  / cellSize;
const tilesY     = canvas.height / cellSize;
const MAX_RECORDS = 10;

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

// ===== РЕКОРДЫ =====
function loadRecords() {
  try {
    const data = localStorage.getItem("snakeRecords");
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem("snakeRecords", JSON.stringify(records));
}

function addRecord(newScore) {
  if (newScore === 0) return -1;

  const records = loadRecords();

  const entry = {
    score: newScore,
    date: new Date().toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  records.push(entry);
  records.sort((a, b) => b.score - a.score);

  // оставляем только TOP 10
  if (records.length > MAX_RECORDS) {
    records.length = MAX_RECORDS;
  }

  saveRecords(records);

  // возвращаем позицию нового рекорда (-1 если не попал в топ)
  const position = records.findIndex(
    (r) => r.score === entry.score && r.date === entry.date
  );

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

function clearRecords() {
  localStorage.removeItem("snakeRecords");
  updateBestScoreDisplay();
  renderRecordsList(-1);
}

function renderRecordsList(highlightIndex) {
  const records = loadRecords();
  recordsList.innerHTML = "";

  if (records.length === 0) {
    recordsList.innerHTML =
      '<li class="empty-message">No records yet.<br>Play a game!</li>';
    return;
  }

  records.forEach((record, index) => {
    const li = document.createElement("li");

    if (index === highlightIndex) {
      li.classList.add("new-record");
    }

    li.innerHTML = `
      <span class="rank">${index + 1}.</span>
      <span class="record-score">${pad(record.score)}</span>
      <span class="record-date">${record.date}</span>
    `;

    recordsList.appendChild(li);
  });
}

function showRecords(highlightIndex = -1) {
  renderRecordsList(highlightIndex);
  recordsOverlay.classList.add("active");
}

function hideRecords() {
  recordsOverlay.classList.remove("active");
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
  ctx.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
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

    // проверяем новый рекорд
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

  // сохраняем рекорд
  const position = addRecord(score);
  updateBestScoreDisplay();

  // если попал в топ — показываем таблицу через секунду
  if (position >= 0) {
    setTimeout(() => {
      showRecords(position);
    }, 1500);
  }
}

function move() {
  if (gameOver || paused) return;

  direction = nextDirection;

  const head = { ...snake[0] };

  if (direction === "up")    head.y -= 1;
  if (direction === "down")  head.y += 1;
  if (direction === "left")  head.x -= 1;
  if (direction === "right") head.x += 1;

  // столкновение со стеной
  if (head.x < 0 || head.x >= tilesX || head.y < 0 || head.y >= tilesY) {
    endGame();
    return;
  }

  const willEat = head.x === food.x && head.y === food.y;
  const body    = willEat ? snake : snake.slice(0, -1);

  // столкновение с собой
  if (body.some((s) => s.x === head.x && s.y === head.y)) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (willEat) {
    score++;
    scoreEl.textContent = pad(score);
    food = randomFood();

    // ускорение
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

  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];

  direction     = "right";
  nextDirection = "right";
  score    = 0;
  speed    = 150;
  gameOver = false;
  paused   = false;

  scoreEl.textContent = pad(score);
  messageEl.textContent = "";

  food = randomFood();
  updateBestScoreDisplay();

  clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, speed);

  draw();
}

// ===== ВВОД: КЛАВИАТУРА =====
document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  // если открыто окно рекордов — закрываем по любой клавише
  if (recordsOverlay.classList.contains("active")) {
    hideRecords();
    return;
  }

  if (key === "ц" || key === "w") { e.preventDefault(); setDirection("up"); }
  if (key === "ы" || key === "s") { e.preventDefault(); setDirection("down"); }
  if (key === "ф" || key === "a") { e.preventDefault(); setDirection("left"); }
  if (key === "в" || key === "d") { e.preventDefault(); setDirection("right"); }
  if (key === "p" || key === "з") togglePause();
  if (key === "r" || key === "к") resetGame();
  if (key === "t" || key === "е") showRecords();
});

// ===== ВВОД: D-PAD КНОПКИ =====
document.querySelectorAll(".dpad-btn").forEach((btn) => {
  const handler = (e) => {
    e.preventDefault();
    setDirection(btn.dataset.dir);
  };

  btn.addEventListener("click", handler);
  btn.addEventListener("touchstart", handler, { passive: false });
});

// ===== ВВОД: КНОПКИ ДЕЙСТВИЙ =====
restartBtn.addEventListener("click", resetGame);
pauseBtn.addEventListener("click", togglePause);
recordsBtn.addEventListener("click", () => showRecords());
closeRecordsBtn.addEventListener("click", hideRecords);
clearRecordsBtn.addEventListener("click", () => {
  clearRecords();
});

// закрытие по клику на фон
recordsOverlay.addEventListener("click", (e) => {
  if (e.target === recordsOverlay) {
    hideRecords();
  }
});

// ===== ЗАПУСК =====
updateBestScoreDisplay();
resetGame();
