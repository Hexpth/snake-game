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
const NAME_KEY    = "snakeLastName";
const RECORDS_PATH = "records";

// === БОНУСНЫЙ ШАРИК ===
const BONUS_SCORE       = 5;     // сколько очков даёт
const BONUS_LIFETIME    = 6000;  // живёт 6 секунд
const BONUS_WARN_TIME   = 2000;  // последние 2 сек — мигает быстро
const BONUS_MIN_DELAY   = 8000;  // минимум 8 сек между появлениями
const BONUS_MAX_DELAY   = 15000; // максимум 15 сек между появлениями
const BONUS_SIZE        = 2;     // размер 2x2 клетки

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
let bonus = null;          // {x, y, spawnedAt}
let bonusTimer = null;     // таймер исчезновения
let bonusSpawnTimer = null; // таймер появления
let score;
let speed;
let gameInterval;
let gameOver;
let paused;
let cachedBestScore = 0;
let cachedTopCount  = 0;

// ===== РЕКОРДЫ В FIREBASE =====
function loadRecordsOnline(callback) {
  window.db
    .ref(RECORDS_PATH)
    .orderByChild("score")
    .limitToLast(MAX_RECORDS)
    .once("value")
    .then((snapshot) => {
      const records = [];
      snapshot.forEach((child) => {
        records.push({ id: child.key, ...child.val() });
      });
      records.sort((a, b) => b.score - a.score);
      callback(records);
    })
    .catch((err) => {
      console.error("Error loading records:", err);
      callback([]);
    });
}

function addRecordOnline(newScore, playerName, callback) {
  if (newScore === 0) {
    callback(-1);
    return;
  }

  const name = playerName.trim().toUpperCase().slice(0, MAX_NAME);
  const timestamp = Date.now();

  const entry = {
    name: name,
    score: newScore,
    date: new Date().toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }),
    timestamp: timestamp,
  };

  window.db
    .ref(RECORDS_PATH)
    .push(entry)
    .then(() => {
      window.db
        .ref(RECORDS_PATH)
        .orderByChild("score")
        .once("value")
        .then((snapshot) => {
          const all = [];
          snapshot.forEach((child) => {
            all.push({ id: child.key, ...child.val() });
          });
          all.sort((a, b) => b.score - a.score);

          if (all.length > MAX_RECORDS) {
            const toDelete = all.slice(MAX_RECORDS);
            toDelete.forEach((r) => {
              window.db.ref(RECORDS_PATH + "/" + r.id).remove();
            });
          }

          const top = all.slice(0, MAX_RECORDS);
          const position = top.findIndex(
            (r) =>
              r.timestamp === timestamp &&
              r.name === name &&
              r.score === newScore
          );

          callback(position);
        });
    })
    .catch((err) => {
      console.error("Error saving record:", err);
      callback(-1);
    });
}

function updateBestScoreDisplay() {
  loadRecordsOnline((records) => {
    cachedBestScore = records.length > 0 ? records[0].score : 0;
    cachedTopCount  = records.length;
    bestScoreEl.textContent = pad(cachedBestScore);
    topCountEl.textContent  = cachedTopCount;
  });
}

// ===== ПОСЛЕДНИЙ НИК =====
function getLastName() {
  return localStorage.getItem(NAME_KEY) || "";
}

function setLastName(name) {
  localStorage.setItem(NAME_KEY, name);
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
  if (errorEl) errorEl.textContent = "";
  nameInput.classList.remove("error");
}

// ===== РЕНДЕР РЕКОРДОВ =====
function renderRecordsListFromData(records, highlightIndex) {
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
  recordsList.innerHTML = '<li class="empty-message">Loading...</li>';
  recordsOverlay.classList.add("active");

  loadRecordsOnline((records) => {
    renderRecordsListFromData(records, highlightIndex);
  });
}

function hideRecords() {
  recordsOverlay.classList.remove("active");
}

function submitName() {
  const name = nameInput.value.trim();

  const result = validateName(name);
  if (!result.valid) {
    showNameError(result.error);
    nameInput.focus();
    return;
  }

  setLastName(name);
  hideNameInput();

  messageEl.textContent = "Saving...";

  addRecordOnline(score, name, (position) => {
    messageEl.textContent = "";
    updateBestScoreDisplay();

    if (position >= 0) {
      setTimeout(() => {
        showRecords(position);
      }, 300);
    }
  });
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

// проверяет — занята ли клетка (змейкой, едой или бонусом)
function isCellOccupied(x, y) {
  if (snake.some((s) => s.x === x && s.y === y)) return true;
  if (food && food.x === x && food.y === y) return true;
  if (bonus) {
    for (let dx = 0; dx < BONUS_SIZE; dx++) {
      for (let dy = 0; dy < BONUS_SIZE; dy++) {
        if (bonus.x + dx === x && bonus.y + dy === y) return true;
      }
    }
  }
  return false;
}

// ===== БОНУСНЫЙ ШАРИК =====
function trySpawnBonus() {
  if (gameOver || paused || bonus) return;

  // ищем свободное место под шарик 2x2
  const maxX = tilesX - BONUS_SIZE;
  const maxY = tilesY - BONUS_SIZE;

  let attempts = 0;
  while (attempts < 50) {
    const x = Math.floor(Math.random() * maxX);
    const y = Math.floor(Math.random() * maxY);

    let free = true;
    for (let dx = 0; dx < BONUS_SIZE && free; dx++) {
      for (let dy = 0; dy < BONUS_SIZE && free; dy++) {
        if (isCellOccupied(x + dx, y + dy)) free = false;
      }
    }

    if (free) {
      bonus = {
        x: x,
        y: y,
        spawnedAt: Date.now(),
      };

      // таймер исчезновения
      bonusTimer = setTimeout(() => {
        bonus = null;
        bonusTimer = null;
        scheduleNextBonus();
      }, BONUS_LIFETIME);

      return;
    }

    attempts++;
  }

  // если не нашли места — попробуем позже
  scheduleNextBonus();
}

function scheduleNextBonus() {
  if (bonusSpawnTimer) clearTimeout(bonusSpawnTimer);

  const delay =
    BONUS_MIN_DELAY +
    Math.random() * (BONUS_MAX_DELAY - BONUS_MIN_DELAY);

  bonusSpawnTimer = setTimeout(trySpawnBonus, delay);
}

function clearBonus() {
  bonus = null;
  if (bonusTimer) {
    clearTimeout(bonusTimer);
    bonusTimer = null;
  }
  if (bonusSpawnTimer) {
    clearTimeout(bonusSpawnTimer);
    bonusSpawnTimer = null;
  }
}

// проверяет — съел ли бонус головой
function checkBonusEaten(head) {
  if (!bonus) return false;

  for (let dx = 0; dx < BONUS_SIZE; dx++) {
    for (let dy = 0; dy < BONUS_SIZE; dy++) {
      if (head.x === bonus.x + dx && head.y === bonus.y + dy) {
        return true;
      }
    }
  }
  return false;
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

function drawBonus() {
  if (!bonus) return;

  const elapsed = Date.now() - bonus.spawnedAt;
  const remaining = BONUS_LIFETIME - elapsed;

  // если осталось < 2 сек — мигает быстро
  const blinkSpeed = remaining < BONUS_WARN_TIME ? 100 : 300;
  const visible = Math.floor(Date.now() / blinkSpeed) % 2 === 0;

  if (!visible) return;

  const px = bonus.x * cellSize;
  const py = bonus.y * cellSize;
  const size = cellSize * BONUS_SIZE;

  // рисуем круг
  ctx.fillStyle = COLOR_DARK;
  ctx.beginPath();
  ctx.arc(
    px + size / 2,
    py + size / 2,
    size / 2 - 2,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // блик в центре
  ctx.fillStyle = COLOR_BG;
  ctx.beginPath();
  ctx.arc(
    px + size / 2 - 2,
    py + size / 2 - 2,
    2,
    0,
    Math.PI * 2
  );
  ctx.fill();
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
  ctx.fillText("Best: " + pad(cachedBestScore), canvas.width / 2, 138);

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

// "+5" эффект когда съел бонус
let popupText = null;
function showPopup(text, x, y) {
  popupText = {
    text: text,
    x: x,
    y: y,
    startedAt: Date.now(),
  };
}

function drawPopup() {
  if (!popupText) return;

  const elapsed = Date.now() - popupText.startedAt;
  if (elapsed > 800) {
    popupText = null;
    return;
  }

  const progress = elapsed / 800;
  const offsetY = -progress * 20;

  ctx.fillStyle = COLOR_DARK;
  ctx.font = "10px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.fillText(
    popupText.text,
    popupText.x * cellSize,
    popupText.y * cellSize + offsetY
  );
}

function draw() {
  drawGrid();
  drawFood();
  drawBonus();
  drawSnake();
  drawPopup();

  if (gameOver) {
    drawGameOver();
    if (score > 0 && score >= cachedBestScore) {
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
  clearBonus();

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
  const willEatBonus = checkBonusEaten(head);

  const body = (willEat || willEatBonus) ? snake : snake.slice(0, -1);

  if (body.some((s) => s.x === head.x && s.y === head.y)) {
    endGame();
    return;
  }

  snake.unshift(head);

  // съели бонус
  if (willEatBonus) {
    score += BONUS_SCORE;
    scoreEl.textContent = pad(score);
    showPopup("+" + BONUS_SCORE, bonus.x + 1, bonus.y);
    clearBonus();
    scheduleNextBonus();
  }

  // съели обычную еду
  if (willEat) {
    score++;
    scoreEl.textContent = pad(score);
    food = randomFood();

    if (speed > 80) {
      speed -= 4;
      clearInterval(gameInterval);
      gameInterval = setInterval(gameLoop, speed);
    }
  }

  // если не съели ничего и не растём — обычная логика
  if (!willEat && !willEatBonus) {
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
  clearBonus();

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
  popupText = null;

  scoreEl.textContent = pad(score);
  messageEl.textContent = "";

  food = randomFood();
  updateBestScoreDisplay();

  clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, speed);

  // запускаем таймер появления бонуса
  scheduleNextBonus();

  draw();
}

function isOverlayOpen() {
  return (
    nameOverlay.classList.contains("active") ||
    recordsOverlay.classList.contains("active")
  );
}

// ===== ВВОД: КЛАВИАТУРА =====
document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  if (nameOverlay.classList.contains("active")) {
    if (key === "enter") {
      e.preventDefault();
      submitName();
    }
    return;
  }

  if (recordsOverlay.classList.contains("active")) {
    hideRecords();
    return;
  }

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

  if (key === "p" || key === "з") togglePause();
  if (key === "r" || key === "к") resetGame();
  if (key === "t" || key === "е") showRecords();
});

// ===== ВВОД: D-PAD =====
document.querySelectorAll(".dpad-btn").forEach((btn) => {
  const handler = (e) => {
    e.preventDefault();
    if (isOverlayOpen()) return;
    setDirection(btn.dataset.dir);
  };

  btn.addEventListener("click", handler);
  btn.addEventListener("touchstart", handler, { passive: false });
});

// ===== ВВОД: КНОПКИ =====
restartBtn.addEventListener("click", resetGame);
pauseBtn.addEventListener("click", togglePause);
recordsBtn.addEventListener("click", () => showRecords());
saveNameBtn.addEventListener("click", submitName);

nameInput.addEventListener("input", clearNameError);
nameInput.addEventListener("keydown", (e) => e.stopPropagation());

closeRecordsBtn.addEventListener("click", hideRecords);
recordsOverlay.addEventListener("click", (e) => {
  if (e.target === recordsOverlay) hideRecords();
});

// ===== ЗАПУСК =====
updateBestScoreDisplay();
resetGame();
