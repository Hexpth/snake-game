// ===== ЭЛЕМЕНТЫ =====
const canvas     = document.getElementById("game");
const ctx        = canvas.getContext("2d");
const scoreEl    = document.getElementById("scoreDisplay");
const messageEl  = document.getElementById("message");
const restartBtn = document.getElementById("restartBtn");
const pauseBtn   = document.getElementById("pauseBtn");

// ===== НАСТРОЙКИ =====
const cellSize = 12;
const tilesX   = canvas.width  / cellSize;
const tilesY   = canvas.height / cellSize;

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
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
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
  ctx.fillRect(40, 90, 160, 60);

  ctx.strokeStyle = COLOR_DARK;
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 90, 160, 60);

  ctx.fillStyle = COLOR_DARK;
  ctx.font = "12px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, 118);

  ctx.font = "8px 'Press Start 2P'";
  ctx.fillText("Press RESTART", canvas.width / 2, 140);
}

function drawPaused() {
  ctx.fillStyle = COLOR_DARK;
  ctx.font = "10px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
}

function draw() {
  drawGrid();
  drawFood();
  drawSnake();

  if (gameOver) {
    drawGameOver();
  }

  if (paused && !gameOver) {
    drawPaused();
  }
}

// ===== ЛОГИКА =====
function endGame() {
  gameOver = true;
  clearInterval(gameInterval);
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
  if (body.some(s => s.x === head.x && s.y === head.y)) {
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
    up:    "down",
    down:  "up",
    left:  "right",
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
  snake = [
    { x: 10, y: 10 },
    { x: 9,  y: 10 },
    { x: 8,  y: 10 },
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

  clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, speed);

  draw();
}

// ===== ВВОД: КЛАВИАТУРА =====
document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  if (key === "ц" || key === "w") { e.preventDefault(); setDirection("up");    }
  if (key === "ы" || key === "s") { e.preventDefault(); setDirection("down");  }
  if (key === "ф" || key === "a") { e.preventDefault(); setDirection("left");  }
  if (key === "в" || key === "d") { e.preventDefault(); setDirection("right"); }
  if (key === "p" || key === "з") togglePause();
  if (key === "r" || key === "к") resetGame();
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

// ===== ЗАПУСК =====
resetGame();