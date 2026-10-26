// ============================================================
// ⚠️ KONFIGURASI — GANTI URL INI!
// ============================================================
const WORKER_URL = 'https://codeai-proxy.NAMA-KAMU.workers.dev';

// ============================================================
// ELEMENTS
// ============================================================
const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');
const messagesEl = document.getElementById('messages');
const welcomeScreen = document.getElementById('welcomeScreen');
const chatContainer = document.getElementById('chatContainer');
const newChatBtn = document.getElementById('newChatBtn');
const newChatLargeBtn = document.getElementById('newChatLargeBtn');
const modeTabs = document.querySelectorAll('.mode-tab');
const languageBtn = document.getElementById('languageBtn');
const languageSelect = document.getElementById('languageSelect');
const langLabel = document.getElementById('langLabel');
const previewModal = document.getElementById('previewModal');
const closePreview = document.getElementById('closePreview');
const previewFrame = document.getElementById('previewFrame');
const toast = document.getElementById('toast');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const historyList = document.getElementById('historyList');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const imagePreviewBar = document.getElementById('imagePreviewBar');
const imgThumb = document.getElementById('imgThumb');
const removeImgBtn = document.getElementById('removeImgBtn');

// ============================================================
// STATE
// ============================================================
let currentMode = 'chat'; // 'chat' | 'code' | 'soal'
let chatHistory = [];
let isGenerating = false;
let pendingImageBase64 = null; // data URL gambar
let pendingImageType = null;   // mime type

// ============================================================
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Bye Zimzz loaded');
    if (WORKER_URL.includes('NAMA-KAMU')) {
        console.warn('⚠️ WORKER_URL belum diganti!');
        setTimeout(() => showToast('⚠️ Set WORKER_URL di script.js dulu!', 'error'), 500);
    }
    promptInput.focus();
});

// ============================================================
// MOBILE SIDEBAR
// ============================================================
menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
});
sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
});

// ============================================================
// MODE SWITCH
// ============================================================
modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        modeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentMode = tab.dataset.mode;

        messagesEl.innerHTML = '';
        chatHistory = [];

        welcomeScreen.classList.remove('hidden');
        if (currentMode === 'code') {
            promptInput.placeholder = 'Minta code apa ke Bye Zimzz...';
            languageBtn.style.display = 'flex';
        } else if (currentMode === 'soal') {
            promptInput.placeholder = 'Tempel soal atau ketik pertanyaan...';
            languageBtn.style.display = 'none';
        } else {
            promptInput.placeholder = 'Tanya apa saja ke Bye Zimzz...';
            languageBtn.style.display = 'none';
        }
    });
});

// ============================================================
// LANGUAGE
// ============================================================
languageBtn.addEventListener('click', (e) => { e.preventDefault(); languageSelect.click(); });
languageSelect.addEventListener('change', () => {
    langLabel.textContent = languageSelect.options[languageSelect.selectedIndex].text;
});

// ============================================================
// IMAGE UPLOAD
// ============================================================
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0
