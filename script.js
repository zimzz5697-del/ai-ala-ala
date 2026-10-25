// ============================================================
// KONFIGURASI
// ============================================================
const WORKER_URL = 'https://codeai-proxy.NAMA-KAMU.workers.dev'; // GANTI!
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'; // GANTI!

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
let currentUser = null;
let currentMode = 'code'; // 'code' | 'soal'
let chatHistory = [];
let isGenerating = false;

// ============================================================
// GOOGLE LOGIN
// ============================================================
window.handleGoogleLogin = function(response) {
    try {
        const payload = decodeJWT(response.credential);
        currentUser = {
            name: payload.name,
            email: payload.email,
            picture: payload.picture,
            sub: payload.sub
        };
        localStorage.setItem('user', JSON.stringify(currentUser));
        showApp();
        console.log('✅ Login:', currentUser.email);
    } catch (err) {
        console.error('Login error:', err);
        showToast('Login gagal', 'error');
    }
};

function decodeJWT(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
}

function showApp() {
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    userName.textContent = currentUser.name;
    userEmail.textContent = currentUser.email;
    if (currentUser.picture) {
        userAvatar.src = currentUser.picture;
        userAvatar.style.display = 'block';
        userAvatarFallback.style.display = 'none';
    }
    promptInput.focus();
}

function checkLogin() {
    const saved = localStorage.getItem('user');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            showApp();
            return true;
        } catch {}
    }
    return false;
}

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('user');
    currentUser = null;
    location.reload();
});

// ============================================================
// MODE SWITCH
// ============================================================
modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        modeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentMode = tab.dataset.mode;
        
        // Reset chat
        messagesEl.innerHTML = '';
        chatHistory = [];
        
        if (currentMode === 'code') {
            welcomeScreen.classList.remove('hidden');
            welcomeSoal.classList.add('hidden');
            promptInput.placeholder = 'Kirim pesan ke CodeAI...';
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
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
    if (WORKER_URL.includes('NAMA-KAMU')) {
        console.warn('⚠️ WORKER_URL belum diganti!');
    }
    checkLogin();
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
}
newChatBtn.addEventListener('click', startNewChat);
newChatLargeBtn.addEventListener('click', startNewChat);

// ============================================================
// PREVIEW
// ============================================================
closePreview.addEventListener('click', () => previewModal.classList.remove('active'));
previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) previewModal.classList.remove('active');
});

// ============================================================
// SEND
// ============================================================
sendBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt || isGenerating) return;
    if (WORKER_URL.includes('NAMA-KAMU')) {
        return showToast('Set WORKER_URL di script.js dulu!', 'error');
    }

    welcomeScreen.classList.add('hidden');
    welcomeSoal.classList.add('hidden');
    addUserMessage(prompt);
    chatHistory.push({ role: 'user', content: prompt });

    promptInput.value = '';
    promptInput.style.height = 'auto';
    sendBtn.disabled = true;
    isGenerating = true;
    const typingEl = addTypingIndicator();

    try {
        const language = languageSelect.value;
        const result = await callWorker(prompt, language, currentMode);
        typingEl.remove();
        chatHistory.push({ role: 'assistant', content: result.content });
        addAIMessage(result.content, result.language || 'text', currentMode);
        addToHistory(prompt);
    } catch (error) {
        typingEl.remove();
        addErrorMessage(error.message);
        showToast('Gagal: ' + error.message, 'error');
    } finally {
        isGenerating = false;
        sendBtn.disabled = !promptInput.value.trim();
    }
});

// ============================================================
// CALL WORKER
// ============================================================
async function callWorker(prompt, language, mode) {
    let response;
    try {
        response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                language: language,
                mode: mode, // 'code' | 'soal'
                history: chatHistory.slice(-6)
            })
        });
    } catch {
        throw new Error('Tidak bisa terhubung ke server.');
    }

    let data;
    try { data = await response.json(); }
    catch { throw new Error(`Server error (${response.status})`); }

    if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
    if (data.error) throw new Error(data.error);
    if (!data.code) throw new Error('AI tidak mengembalikan hasil');

    let content = data.code;
    if (mode === 'code') {
        content = content.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
    }

    let detectedLang = language;
    if (mode === 'soal') detectedLang = 'text';
    else if (language === 'auto') {
        if (content.includes('<!DOCTYPE html>') || content.includes('<html')) detectedLang = 'html';
        else if (content.includes('def ') && content.includes(':')) detectedLang = 'python';
        else if (content.includes('<?php')) detectedLang = 'php';
        else detectedLang = 'javascript';
    }

    return { content, language: detectedLang };
}

// ============================================================
// ADD MESSAGES
// ============================================================
function addUserMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'message user';
    msg.innerHTML = `<div class="msg-avatar">U</div><div class="msg-content"><div class="msg-bubble"></div></div>`;
    msg.querySelector('.msg-bubble').textContent = text;
    messagesEl.appendChild(msg);
    scrollToBottom();
}

function addAIMessage(content, language, mode) {
    const msg = document.createElement('div');
    msg.className = 'message ai';
    
    if (mode === 'soal' || language === 'text') {
        // Mode jawab soal: tampilkan sebagai teks
        msg.innerHTML = `
            <div class="msg-avatar"><i class="fas fa-question-circle"></i></div>
            <div class="msg-content">
                <div class="msg-bubble">
                    <div class="answer-block">${escapeHtml(content)}</div>
                </div>
            </div>
        `;
    } else {
        // Mode code: tampilkan code block
        const codeId = 'code-' + Date.now();
        const langMap = { html:'html', css:'css', javascript:'js', python:'py', php:'php', java:'java', cpp:'cpp', react:'jsx', nodejs:'js', sql:'sql' };
        msg.innerHTML = `
            <div class="msg-avatar"><i class="fas fa-code"></i></div>
            <div class="msg-content">
                <div class="msg-bubble">
                    <div class="code-block-wrapper">
                        <div class="code-header">
                            <span class="code-lang"><i class="fas fa-code"></i> ${language.toUpperCase()}</span>
                            <div class="code-actions">
                                <button class="code-action-btn" onclick="copyCode('${codeId}')"><i class="fas fa-copy"></i> Copy</button>
                                ${language === 'html' ? `<button class="code-action-btn" onclick="previewCode('${codeId}')"><i class="fas fa-eye"></i> Preview</button>` : ''}
                                <button class="code-action-btn" onclick="downloadCode('${codeId}', '${langMap[language] || 'txt'}')"><i class="fas fa-download"></i> Download</button>
                            </div>
                        </div>
                        <pre><code id="${codeId}" class="language-${language}">${escapeHtml(content)}</code></pre>
                    </div>
                </div>
            </div>
        `;
        messagesEl.appendChild(msg);
        const codeEl = document.getElementById(codeId);
        if (window.hljs && codeEl) hljs.highlightElement(codeEl);
        scrollToBottom();
        return;
    }
    messagesEl.appendChild(msg);
    scrollToBottom();
}

function addErrorMessage(error) {
    const msg = document.createElement('div');
    msg.className = 'message ai';
    msg.innerHTML = `<div class="msg-avatar" style="background:#ef4444;color:white"><i class="fas fa-exclamation-triangle"></i></div><div class="msg-content"><div class="msg-bubble" style="color:#ef4444">❌ ${escapeHtml(error)}</div></div>`;
    messagesEl.appendChild(msg);
    scrollToBottom();
}

function addTypingIndicator() {
    const msg = document.createElement('div');
    msg.className = 'message ai';
    msg.innerHTML = `<div class="msg-avatar"><i class="fas fa-code"></i></div><div class="msg-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
    messagesEl.appendChild(msg);
    scrollToBottom();
    return msg;
}

// ============================================================
// CODE ACTIONS
// ============================================================
window.copyCode = (codeId) => {
    const code = document.getElementById(codeId).textContent;
    navigator.clipboard.writeText(code).then(() => showToast('Code di-copy!', 'success'));
};
window.previewCode = (codeId) => {
    previewFrame.srcdoc = document.getElementById(codeId).textContent;
    previewModal.classList.add('active');
};
window.downloadCode = (codeId, ext) => {
    const code = document.getElementById(codeId).textContent;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `code.${ext}`; a.click();
    URL.revokeObjectURL(url);
    showToast('File di-download!', 'success');
};

// ============================================================
// HISTORY
// ============================================================
function addToHistory(prompt) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `<i class="fas fa-message"></i> <span>${escapeHtml(prompt.slice(0, 30))}${prompt.length > 30 ? '...' : ''}</span>`;
    item.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });
    historyList.prepend(item);
}

// ============================================================
// UTILS
// ============================================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function scrollToBottom() {
    setTimeout(() => { chatContainer.scrollTop = chatContainer.scrollHeight; }, 50);
}
function showToast(message, type = '') {
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
