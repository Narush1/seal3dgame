const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

const PORT = 3002; // Менять для server2.js и т.д.

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '../shared/public')));

let players = {}; // { id: { username, x, y, z, hp, coins, lastActive, items, ... } }
let sockets = {}; // { id: ws }

const MAX_PLAYERS = 20;
const AFK_TIMEOUT = 3 * 60 * 1000; // 3 минуты
const COINS_PER_MIN = 1;

// Проверка на buildzone (пример, можно расширить)
const BUILDZONE_POSITION = { x: 100, y: 0, z: 100 };
const BUILDZONE_RADIUS = 10;

// Уникальный ID для игроков
let nextId = 1;

function broadcast(data) {
  const message = JSON.stringify(data);
  for (const id in sockets) {
    sockets[id].send(message);
  }
}

function isInBuildZone(pos) {
  const dx = pos.x - BUILDZONE_POSITION.x;
  const dy = pos.y - BUILDZONE_POSITION.y;
  const dz = pos.z - BUILDZONE_POSITION.z;
  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
  return dist < BUILDZONE_RADIUS;
}

// Автокик AFK
function checkAFK() {
  const now = Date.now();
  for (const id in players) {
    if (now - players[id].lastActive > AFK_TIMEOUT) {
      const ws = sockets[id];
      if (ws) {
        ws.send(JSON.stringify({ type: 'kick', reason: 'Вы были кикнуты за бездействие (3 мин)' }));
        ws.close();
      }
      delete players[id];
      delete sockets[id];
      broadcast({ type: 'playerLeave', id });
    }
  }
}

// Начисление монет каждую минуту
function addCoins() {
  for (const id in players) {
    players[id].coins = (players[id].coins || 0) + COINS_PER_MIN;
    // Здесь можно уведомлять клиента о новом балансе
    if (sockets[id]) {
      sockets[id].send(JSON.stringify({ type: 'coinsUpdate', coins: players[id].coins }));
    }
  }
}

setInterval(checkAFK, 30 * 1000);
setInterval(addCoins, 60 * 1000);

wss.on('connection', (ws, req) => {
  // Лимит игроков
  if (Object.keys(players).length >= MAX_PLAYERS) {
    ws.send(JSON.stringify({ type: 'error', message: 'Сервер переполнен' }));
    ws.close();
    return;
  }

  const id = nextId++;
  sockets[id] = ws;

  // Ждём от клиента сообщение с юзером
  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (e) {
      return;
    }

    // Обновляем последнее время активности
    if (players[id]) players[id].lastActive = Date.now();

    switch (data.type) {
      case 'join': {
        // { username, x, y, z, coins, items }
        players[id] = {
          id,
          username: data.username || 'Безымянный',
          x: data.x || 0,
          y: data.y || 0,
          z: data.z || 0,
          hp: 100,
          coins: data.coins || 0,
          items: data.items || [],
          lastActive: Date.now(),
          weapon: 'палка',
        };
        ws.send(JSON.stringify({ type: 'joined', id, players: Object.values(players) }));
        broadcast({ type: 'playerJoin', player: players[id] });
        break;
      }

      case 'move': {
        // { x, y, z }
        if (!players[id]) break;

        // Проверка buildzone (запрет)
        if (isInBuildZone({ x: data.x, y: data.y, z: data.z })) {
          ws.send(JSON.stringify({ type: 'message', message: 'Зона buildzone пока закрыта — Soon!' }));
          break;
        }

        players[id].x = data.x;
        players[id].y = data.y;
        players[id].z = data.z;

        broadcast({ type: 'playerMove', id, x: data.x, y: data.y, z: data.z });
        break;
      }

      case 'attack': {
        // { targetId }
        if (!players[id]) break;
        const target = players[data.targetId];
        if (!target) break;

        // Урон 10 очков, если в пределах 3 метров
        const dx = players[id].x - target.x;
        const dy = players[id].y - target.y;
        const dz = players[id].z - target.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist <= 3) {
          target.hp -= 10;
          if (target.hp <= 0) {
            target.hp = 100;
            // Перезагрузка позиции цели
            target.x = 0;
            target.y = 0;
            target.z = 0;
            // Можно начислять монеты победителю
            players[id].coins += 5;
            if (sockets[id]) sockets[id].send(JSON.stringify({ type: 'coinsUpdate', coins: players[id].coins }));
          }
          broadcast({ type: 'hpUpdate', id: data.targetId, hp: target.hp });
        }
        break;
      }

      case 'chat': {
        // { message }
        if (!players[id]) break;
        const text = data.message.trim().slice(0, 200);
        if (text.length === 0) break;
        broadcast({ type: 'chat', username: players[id].username, message: text });
        break;
      }

      case 'buy': {
        // { item }
        if (!players[id]) break;
        const itemsShop = {
          firework: 50,
          soda: 20,
          burger: 20,
          stick: 20,
        };

        const item = data.item;
        if (!itemsShop[item]) {
          ws.send(JSON.stringify({ type: 'message', message: 'Такого предмета нет в магазине' }));
          break;
        }

        if (players[id].coins < itemsShop[item]) {
          ws.send(JSON.stringify({ type: 'message', message: 'Недостаточно монет' }));
          break;
        }

        players[id].coins -= itemsShop[item];
        players[id].items = players[id].items || [];
        players[id].items.push(item);
        ws.send(JSON.stringify({ type: 'message', message: `Вы купили ${item}` }));
        ws.send(JSON.stringify({ type: 'coinsUpdate', coins: players[id].coins }));

        // Можно отправить обновление для всех (если нужно)
        break;
      }

      default:
        break;
    }
  });

  ws.on('close', () => {
    delete players[id];
    delete sockets[id];
    broadcast({ type: 'playerLeave', id });
  });
});

server.listen(PORT, () => {
  console.log(`Game server started on http://localhost:${PORT}`);
});
