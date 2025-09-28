// client.js
// Подключение к серверу и базовая игровая логика

const SERVER_URL = window.location.origin.replace(/^http/, 'ws'); // ws://localhost:3001 или ws://sealmes.com/room1
const socket = new WebSocket(SERVER_URL);

let playerId = null;
let players = {};
let username = localStorage.getItem('username') || 'Гость';
let coins = parseInt(localStorage.getItem('coins')) || 0;
let items = JSON.parse(localStorage.getItem('items') || '[]');

const canvas = document.createElement('canvas');
canvas.width = 800;
canvas.height = 600;
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

let keys = {};

// Игровая позиция и состояние
let x = 50, y = 0, z = 50;
let hp = 100;
let weapon = 'палка';

// Интервал для отправки движения (20 раз в секунду)
let sendMoveInterval = null;

// Инициализация
function init() {
  setupUI();
  setupSocket();
  setupControls();
  startGameLoop();
}

// UI: чат, магазин, статус
function setupUI() {
  const chatDiv = document.createElement('div');
  chatDiv.id = 'chat';
  chatDiv.style.position = 'absolute';
  chatDiv.style.bottom = '10px';
  chatDiv.style.left = '10px';
  chatDiv.style.width = '300px';
  chatDiv.style.height = '200px';
  chatDiv.style.background = 'rgba(0,0,0,0.7)';
  chatDiv.style.color = '#eee';
  chatDiv.style.overflowY = 'auto';
  chatDiv.style.fontSize = '14px';
  chatDiv.style.padding = '8px';
  chatDiv.style.borderRadius = '5px';
  document.body.appendChild(chatDiv);

  const chatInput = document.createElement('input');
  chatInput.id = 'chatInput';
  chatInput.placeholder = 'Введите сообщение...';
  chatInput.style.position = 'absolute';
  chatInput.style.bottom = '5px';
  chatInput.style.left = '10px';
  chatInput.style.width = '280px';
  chatInput.style.padding = '6px';
  chatInput.style.borderRadius = '5px';
  document.body.appendChild(chatInput);

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendChatMessage(chatInput.value);
      chatInput.value = '';
    }
  });

  // Магазин
  const shopDiv = document.createElement('div');
  shopDiv.id = 'shop';
  shopDiv.style.position = 'absolute';
  shopDiv.style.top = '10px';
  shopDiv.style.right = '10px';
  shopDiv.style.width = '180px';
  shopDiv.style.background = 'rgba(0,0,0,0.7)';
  shopDiv.style.color = '#eee';
  shopDiv.style.padding = '10px';
  shopDiv.style.borderRadius = '5px';
  shopDiv.style.fontSize = '14px';
  shopDiv.innerHTML = `
    <h3>Магазин</h3>
    <button data-item="firework">Фейерверк — 50 монет</button><br/>
    <button data-item="soda">Газировка — 20 монет</button><br/>
    <button data-item="burger">Бургер — 20 монет</button><br/>
    <button data-item="stick">Меч (палка) — 20 монет</button>
  `;
  document.body.appendChild(shopDiv);

  shopDiv.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      buyItem(btn.dataset.item);
    });
  });

  // Статус (HP, монеты)
  const statusDiv = document.createElement('div');
  statusDiv.id = 'status';
  statusDiv.style.position = 'absolute';
  statusDiv.style.top = '10px';
  statusDiv.style.left = '10px';
  statusDiv.style.color = '#00bcd4';
  statusDiv.style.fontSize = '16px';
  statusDiv.style.fontWeight = 'bold';
  statusDiv.style.textShadow = '0 0 5px #00bcd4';
  document.body.appendChild(statusDiv);

  updateStatus();
}

// Обновить статус HP и монет
function updateStatus() {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = `HP: ${hp} | Монеты: ${coins} | Оружие: ${weapon}`;
}

// Отправить сообщение в чат
function sendChatMessage(msg) {
  if (!msg.trim()) return;
  socket.send(JSON.stringify({ type: 'chat', message: msg }));
}

// Купить предмет
function buyItem(item) {
  socket.send(JSON.stringify({ type: 'buy', item }));
}

// Обработать сообщения от сервера
function setupSocket() {
  socket.addEventListener('open', () => {
    // При подключении отправляем join
    socket.send(JSON.stringify({
      type: 'join',
      username,
      x, y, z,
      coins,
      items,
    }));
    startSendingMoves();
  });

  socket.addEventListener('message', (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    switch(data.type) {
      case 'joined':
        playerId = data.id;
        players = {};
        data.players.forEach(p => { players[p.id] = p; });
        logMessage(`Вы вошли в игру как ${username}`);
        break;

      case 'playerJoin':
        players[data.player.id] = data.player;
        logMessage(`${data.player.username} присоединился`);
        break;

      case 'playerLeave':
        delete players[data.id];
        logMessage(`Игрок вышел`);
        break;

      case 'playerMove':
        if (players[data.id]) {
          players[data.id].x = data.x;
          players[data.id].y = data.y;
          players[data.id].z = data.z;
        }
        break;

      case 'hpUpdate':
        if (players[data.id]) {
          players[data.id].hp = data.hp;
          if (data.id === playerId) hp = data.hp;
          updateStatus();
        }
        break;

      case 'coinsUpdate':
        if (playerId && data.coins !== undefined) {
          coins = data.coins;
          localStorage.setItem('coins', coins);
          updateStatus();
        }
        break;

      case 'chat':
        logMessage(`${data.username}: ${data.message}`);
        break;

      case 'message':
        logMessage(data.message);
        break;

      case 'kick':
        alert(data.reason);
        window.location.href = '/'; // Возврат в лобби
        break;

      default:
        break;
    }
  });
}

// Вывод сообщения в чат
function logMessage(msg) {
  const chatDiv = document.getElementById('chat');
  if (!chatDiv) return;
  const p = document.createElement('p');
  p.textContent = msg;
  chatDiv.appendChild(p);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

// Управление клавишами (WASD, прыжок пробел)
function setupControls() {
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });
}

// Отправка позиции на сервер
function sendMove() {
  let speed = 0.3;
  if (keys['shift']) speed = 0.6;

  if (keys['w']) z -= speed;
  if (keys['s']) z += speed;
  if (keys['a']) x -= speed;
  if (keys['d']) x += speed;

  if (keys[' ']) y = 1; else y = 0; // Прыжок условно

  socket.send(JSON.stringify({ type: 'move', x, y, z }));
}

// Игровой цикл (отрисовка и обновление)
function startGameLoop() {
  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }
  loop();
}

// Обновление логики
function update() {
  // Для простоты, только движение отправляем через интервал
}

// Отрисовка (простая 2D топ-даун карта)
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Отрисовка игроков
  for (const id in players) {
    const p = players[id];
    const screenX = p.x * 5 + canvas.width / 2;
    const screenY = p.z * 5 + canvas.height / 2;

    ctx.fillStyle = id == playerId ? '#00bcd4' : '#ccc';
    ctx.beginPath();
    ctx.arc(screenX, screenY, 10, 0, 2 * Math.PI);
    ctx.fill();

    // Имя
    ctx.fillStyle = '#eee';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(p.username, screenX, screenY - 15);

    // HP бар
    ctx.fillStyle = 'red';
    ctx.fillRect(screenX - 15, screenY + 12, 30 * (p.hp / 100), 5);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(screenX - 15, screenY + 12, 30, 5);
  }
}

// Интервал отправки движения
function startSendingMoves() {
  if (sendMoveInterval) clearInterval(sendMoveInterval);
  sendMoveInterval = setInterval(sendMove, 50); // 20 раз в секунду
}

init();
