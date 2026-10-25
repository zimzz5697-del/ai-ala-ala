// ============================================
// KONFIGURASI - GANTI INI SETELAH DEPLOY WORKER
// ============================================
const WORKER_URL = 'https://codeai-proxy.NAMA-KAMU.workers.dev';
// Contoh: 'https://codeai-proxy.johndoe.workers.dev'

// ============ ELEMENTS ============
const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');
const messagesEl = document.getElementById('messages');
const welcomeScreen = document.getElementById('welcomeScreen');
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

// ============ STATE ============
let isGenerating = false;
let chatHistory = [];

// ============ MOBILE SIDEBAR ============
menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
});

sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
});

// ============ LANGUAGE SELECT ============
languageBtn.addEventListener('click', () => languageSelect.click());

languageSelect.addEventListener('change', () => {
    langLabel.textContent = languageSelect.options[languageSelect.selectedIndex].text;
});

// ============ TEXTAREA AUTO RESIZE ============
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

// ============ SUGGESTION CARDS ============
document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
        promptInput.value = card.dataset.prompt;
        promptInput.dispatchEvent(new Event('input'));
        promptInput.focus();
    });
});

// ============ NEW CHAT ============
function startNewChat() {
    messagesEl.innerHTML = '';
    welcomeScreen.classList.remove('hidden');
    chatHistory = [];
    promptInput.value = '';
    promptInput.style.height = 'auto';
    sendBtn.disabled = true;
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
}

newChatBtn.addEventListener('click', startNewChat);
newChatLargeBtn.addEventListener('click', startNewChat);

// ============ PREVIEW CLOSE ============
closePreview.addEventListener('click', () => previewModal.classList.remove('active'));
previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) previewModal.classList.remove('active');
});

// ============ SEND MESSAGE ============
sendBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt || isGenerating) return;

    welcomeScreen.classList.add('hidden');
    addUserMessage(prompt);
    chatHistory.push({ role: 'user', content: prompt });

    promptInput.value = '';
    promptInput.style.height = 'auto';
    sendBtn.disabled = true;
    isGenerating = true;

    const typingEl = addTypingIndicator();

    try {
        const language = languageSelect.value;
        const result = await callAI(prompt, language);
        
        typingEl.remove();
        chatHistory.push({ role: 'assistant', content: result.code });
        addAIMessage(result.code, result.language);
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

// ============ AI API CALL (via Worker Proxy) ============
async function callAI(prompt, language) {
    const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: prompt,
            language: language,
            history: chatHistory.slice(-6)
        })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server Error ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
        throw new Error(data.error);
    }

    let code = data.code || '';
    
    // Clean markdown
    code = code.replace(/```[\w]*\n?/g, '').replace(/```/g, '');

    // Detect language
    let detectedLang = language;
    if (language === 'auto') {
        if (code.includes('<!DOCTYPE html>') || code.includes('<html')) detectedLang = 'html';
        else if (code.includes('def ') || code.includes('import ')) detectedLang = 'python';
        else if (code.includes('<?php')) detectedLang = 'php';
        else if (code.includes('function ') || code.includes('const ')) detectedLang = 'javascript';
        else detectedLang = 'javascript';
    }

    return { code: code.trim(), language: detectedLang };
}

// ============ ADD MESSAGE FUNCTIONS ============
function addUserMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'message user';
    msg.innerHTML = `
        <div class="msg-avatar">U</div>
        <div class="msg-content">
            <div class="msg-bubble">${escapeHtml(text)}</div>
        </div>
    `;
    messagesEl.appendChild(msg);
    scrollToBottom();
}

function addAIMessage(code, language) {
    const msg = document.createElement('div');
    msg.className = 'message ai';
    
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
                        <span class="code-lang">
                            <i class="fas fa-code"></i> ${language.toUpperCase()}
                        </span>
                        <div class="code-actions">
                            <button class="code-action-btn" onclick="copyCode(this, '${codeId}')">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                            ${language === 'html' ? `
                            <button class="code-action-btn" onclick="previewCode('${codeId}')">
                                <i class="fas fa-eye"></i> Preview
                            </button>` : ''}
                            <button class="code-action-btn" onclick="downloadCode('${codeId}', '${langMap[language] || 'txt'}')">
                                <i class="fas fa-download"></i> Download
                            </button>
                        </div>
                    </div>
                    <pre><code id="${codeId}" class="language-${language}">${escapeHtml(code)}</code></pre>
                </div>
            </div>
        </div>
    `;
    
    messagesEl.appendChild(msg);
    
    const codeEl = document.getElementById(codeId);
    if (window.hljs && codeEl) {
        hljs.highlightElement(codeEl);
    }
    
    scrollToBottom();
}

function addErrorMessage(error) {
    const msg = document.createElement('div');
    msg.className = 'message ai';
    msg.innerHTML = `
        <div class="msg-avatar" style="background:#ef4444;color:white"><i class="fas fa-exclamation-triangle"></i></div
