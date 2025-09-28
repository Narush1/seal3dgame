const API_BASE = '/api'; // assuming lobby-server runs on same origin

// Элементы
const regUsername = document.getElementById('reg-username');
const regPassword = document.getElementById('reg-password');
const registerBtn = document.getElementById('register-btn');
const regMessage = document.getElementById('reg-message');

const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const loginMessage = document.getElementById('login-message');

const registerLoginDiv = document.getElementById('register-login');
const serverSelectionDiv = document.getElementById('server-selection');
const serversListDiv = document.getElementById('servers-list');

let currentUser = null;

// Регистрация
registerBtn.addEventListener('click', async () => {
  regMessage.textContent = '';
  const username = regUsername.value.trim();
  const password = regPassword.value;

  if (!username || !password) {
    regMessage.textContent = 'Введите имя пользователя и пароль';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.success) {
      regMessage.style.color = 'lightgreen';
      regMessage.textContent = 'Регистрация успешна! Теперь войдите.';
      regUsername.value = '';
      regPassword.value = '';
    } else {
      regMessage.style.color = 'salmon';
      regMessage.textContent = data.error || 'Ошибка регистрации';
    }
  } catch (e) {
    regMessage.style.color = 'salmon';
    regMessage.textContent = 'Ошибка сети';
  }
});

// Вход
loginBtn.addEventListener('click', async () => {
  loginMessage.textContent = '';
  const username = loginUsername.value.trim();
  const password = loginPassword.value;

  if (!username || !password) {
    loginMessage.textContent = 'Введите имя пользователя и пароль';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.success) {
      currentUser = {
        username,
        coins: data.coins,
        items: data.items,
      };
      showServerSelection();
    } else {
      loginMessage.style.color = 'salmon';
      loginMessage.textContent = data.error || 'Ошибка входа';
    }
  } catch (e) {
    loginMessage.style.color = 'salmon';
    loginMessage.textContent = 'Ошибка сети';
  }
});

// Показ выбора сервера
function showServerSelection() {
  registerLoginDiv.style.display = 'none';
  serverSelectionDiv.style.display = 'block';
  loginMessage.textContent = '';
  regMessage.textContent = '';

  serversListDiv.innerHTML = '';

  // 4 игровых сервера — меняй адреса и порты если нужно
  const servers = [
    { name: 'Сервер 1', url: 'http://localhost:3001' },
    { name: 'Сервер 2', url: 'http://localhost:3002' },
    { name: 'Сервер 3', url: 'http://localhost:3003' },
    { name: 'Сервер 4', url: 'http://localhost:3004' },
  ];

  servers.forEach(({ name, url }) => {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.addEventListener('click', () => {
      // Переход на игру
      // Можно сохранить пользователя в localStorage или передавать через URL
      localStorage.setItem('username', currentUser.username);
      localStorage.setItem('coins', currentUser.coins);
      localStorage.setItem('items', JSON.stringify(currentUser.items));

      window.location.href = `${url}/`; // Переход на игровой сервер
    });
    serversListDiv.appendChild(btn);
  });
}
