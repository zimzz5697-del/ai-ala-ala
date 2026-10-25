// ============================================================
// ⚠️ KONFIGURASI — WAJIB DIISI!
// ============================================================
const WORKER_URL = 'https://codeai-proxy.NAMA-KAMU.workers.dev';
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

// ============================================================
// ELEMENTS
// ============================================================
const loginScreen = document.getElementById('loginScreen');
const appContainer = document.getElementById('appContainer');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const userAvatar = document.getElementById('userAvatar');
const userAvatarFallback = document.getElementById('userAvatarFallback');
const logoutBtn = document.getElementById('logoutBtn');
const modeTabs = document.querySelectorAll('.mode-tab');
const welcomeScreen = document.getElementById('welcomeScreen');
const welcomeSoal = document.getElementById('welcomeSoal');
const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');
const messagesEl = document.getElementById('messages');
const chatContainer = document.getElementById('chatContainer');
const newChatBtn = document.getElementById('newChatBtn');
const newChatLargeBtn = document.getElementById('newChatLargeBtn');
const languageBtn = document.getElementById('languageBtn');
const languageSelect = document.getElementById('languageSelect');
const langLabel = document
