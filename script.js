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
const welcomeSoal = document.getElementById('welcomeSoal');
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

// ============================================================
// STATE
// ============================================================
let currentMode = 'code';
let chatHistory = [];
let isGenerating = false;

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

        if (currentMode === 'code') {
            welcomeScreen.classList.remove('hidden');
            welcomeSoal.classList.add('hidden');
            promptInput.placeholder = 'Kirim pesan ke Bye Zimzz...';
            languageBtn.style.display = 'flex';
        } else {
            welcomeScreen.classList.add('hidden');
            welcomeSoal.classList.remove('hidden');
            promptInput.placeholder = 'Tempel soal atau ketik pertanyaan...';
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
// TEXTAREA
// ============================================================
promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 200) + 'px';
    sendBtn.disabled = !promptInput.value.trim() || isGenerating;
});
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) sendBtn.click();
    }
});

// ============================================================
// SUGGESTIONS
// ============================================================
document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
        promptInput.value = card.dataset.prompt || '';
        promptInput.dispatchEvent(new Event('input'));
        promptInput.focus();
    });
});

// ============================================================
// NEW CHAT
// ============================================================
function startNewChat() {
    messagesEl.innerHTML = '';
    chatHistory = [];
    promptInput.value = '';
    promptInput.style.height = 'auto';
    sendBtn.disabled = true;
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
    if (currentMode === 'code') welcomeScreen.classList.remove('hidden');
    else welcomeSoal.classList.remove('hidden');
    promptInput.focus();
}
newChatBtn.addEventListener('click', startNewChat);
newChatLargeBtn.addEventListener('click', startNewChat);

// ============================================================
// PREVIEW
// ============================================================
closePreview.addEventListener('click', () => previewModal.classList.remove('active'));
previewModal.addEventListener
