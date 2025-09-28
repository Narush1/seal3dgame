const express = require('express');
const http = require('http');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const USERS_FILE = path.join(__dirname, 'users.json');
let users = {};

// Загрузка пользователей из файла при старте
if (fs.existsSync(USERS_FILE)) {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    users = JSON.parse(data);
  } catch (e) {
    console.error('Error reading users.json:', e);
    users = {};
  }
}

// Сохраняем пользователей в файл
function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Регистрация нового пользователя
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Введите имя и пароль' });

  if (users[username]) {
    return res.status(400).json({ error: 'Имя пользователя уже занято' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    users[username] = {
      password: hash,
      coins: 0,
      items: [],       // Список купленных предметов
      lastLogin: Date.now(),
    };
    saveUsers();
    res.json({ success: true });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Вход пользователя
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Введите имя и пароль' });

  const user = users[username];
  if (!user) return res.status(400).json({ error: 'Неверное имя или пароль' });

  try {
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Неверное имя или пароль' });

    user.lastLogin = Date.now();
    saveUsers();

    res.json({
      success: true,
      coins: user.coins,
      items: user.items || [],
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновление монет и предметов
app.post('/api/update-profile', (req, res) => {
  const { username, coins, items } = req.body;
  if (!username || typeof coins !== 'number' || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Неверные данные' });
  }

  const user = users[username];
  if (!user) return res.status(400).json({ error: 'Пользователь не найден' });

  user.coins = coins;
  user.items = items;
  saveUsers();

  res.json({ success: true });
});

// Запуск сервера
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Lobby server running on http://localhost:${PORT}`);
});
