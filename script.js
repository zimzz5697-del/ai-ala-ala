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
    console.log('✅ Bye Zimzz loaded (tanpa login)');
    if (WORKER_URL.includes('NAMA-KAMU')) {
        console.warn('⚠️ WORKER_URL belum diganti!');
        showToast('⚠️ Set WORKER_URL di script.js dulu!', 'error');
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

        // Reset chat
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
// SEND MESSAGE
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
                mode: mode,
                history: chatHistory.slice(-6)
            })
        });
    } catch {
        throw new Error('Tidak bisa terhubung ke server Bye Zimzz.');
    }

    let data;
    try { data = await response.json(); }
    catch { throw new Error(`Server error (${response.status})`); }

    if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
    if (data.error) throw new Error(data.error);
    if (!data.code) throw new Error('Bye Zimzz tidak mengembalikan hasil');

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
        // Mode jawab soal
        msg.innerHTML = `
            <div class="msg-avatar"><i class="fas fa-question-circle"></i></div>
            <div class="msg-content">
                <div class="msg-bubble">
                    <div class="answer-block"></div>
                </div>
            </div>
        `;
        msg.querySelector('.answer-block').textContent = content;
        messagesEl.appendChild(msg);
        scrollToBottom();
        return;
    }

    // Mode code
    const codeId = 'code-' + Date.now();
    const langMap = {
        html: 'html', css: 'css', javascript: 'js', python: 'py',
        php: 'php', java: 'java', cpp: 'cpp', react: 'jsx',
        nodejs: 'js', sql: 'sql'
    };
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
                    <pre><code id="${codeId}" class="language-${language}"></code></pre>
                </div>
            </div>
        </div>
    `;
    messagesEl.appendChild(msg);

    // Isi code pakai textContent supaya aman dari XSS
    const codeEl = document.getElementById(codeId);
    codeEl.textContent = content;

    if (window.hljs) {
        hljs.highlightElement(codeEl);
    }
    scrollToBottom();
}

function addErrorMessage(error) {
    const msg = document.createElement('div');
    msg.className = 'message ai';
    msg.innerHTML = `
        <div class="msg-avatar" style="background:#ef4444;color:white"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="msg-content">
            <div class="msg-bubble" style="color:#ef4444">❌ ${escapeHtml(error)}</div>
        </div>
    `;
    messagesEl.appendChild(msg);
    scrollToBottom();
}

function addTypingIndicator() {
    const msg = document.createElement('div');
    msg.className = 'message ai';
    msg.innerHTML = `
        <div class="msg-avatar"><i class="fas fa-code"></i></div>
        <div class="msg-content">
            <div class="typing-indicator"><span></span><span></span><span></span></div>
        </div>
    `;
    messagesEl.appendChild(msg);
    scrollToBottom();
    return msg;
}

// ============================================================
// CODE ACTIONS
// ============================================================
window.copyCode = (codeId) => {
    const code = document.getElementById(codeId).textContent;
    navigator.clipboard.writeText(code).then(() => {
        showToast('Code di-copy! 📋', 'success');
    }).catch(() => showToast('Gagal copy', 'error'));
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
    a.href = url;
    a.download = `bye-zimzz-code.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('File di-download! 📥', 'success');
};

// ============================================================
// HISTORY
// ============================================================
function addToHistory(prompt) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `<i class="fas fa-message"></i> <span></span>`;
    item.querySelector('span').textContent = prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '');
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
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 50);
}
function showToast(message,
