/**
 * Cloudflare Worker — CodeAI Proxy (v2)
 * 
 * ENV VARS di Cloudflare Dashboard:
 *   API_KEY    (Secret)  — WAJIB. API key provider kamu
 *   PROVIDER   (Text)    — "groq" | "gemini" | "openai"  (default: groq)
 *   MODEL      (Text)    — opsional. Override model default
 *   ALLOWED_ORIGIN (Text) — opsional. Default "*"
 * 
 * Contoh:
 *   PROVIDER = "groq"    → otomatis pakai https://api.groq.com/openai/v1
 *                          model: llama-3.3-70b-versatile
 *   PROVIDER = "gemini"  → otomatis pakai https://generativelanguage.googleapis.com/v1beta/openai
 *                          model: gemini-2.0-flash
 *   PROVIDER = "openai"  → otomatis pakai https://api.openai.com/v1
 *                          model: gpt-4o-mini
 */

// ============================================================
// PROVIDER CONFIG
// ============================================================
const PROVIDERS = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
};

// ============================================================
// MAIN HANDLER
// ============================================================
export default {
  async fetch(request, env) {
    // CORS
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // Health check (GET) — untuk test Worker aktif
    if (request.method === 'GET') {
      return json({
        status: 'ok',
        message: 'CodeAI Worker aktif',
        provider: env.PROVIDER || 'groq',
        hasApiKey: !!env.API_KEY,
      }, 200, cors);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Gunakan POST' }, 405, cors);
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body bukan JSON valid' }, 400, cors);
    }

    const {
      prompt = '',
      language = 'auto',
      history = [],
      mode = 'code',
    } = body;

    // Validasi
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return json({ error: 'Prompt tidak boleh kosong' }, 400, cors);
    }
    if (prompt.length > 8000) {
      return json({ error: 'Prompt terlalu panjang (maks 8000 karakter)' }, 400, cors);
    }
    if (!['code', 'soal'].includes(mode)) {
      return json({ error: 'Mode harus "code" atau "soal"' }, 400, cors);
    }

    // Config
    const API_KEY = env.API_KEY;
    if (!API_KEY) {
      return json({
        error: 'API_KEY belum di-set di Cloudflare Worker Settings',
      }, 500, cors);
    }

    const providerName = (env.PROVIDER || 'groq').toLowerCase();
    const provider = PROVIDERS[providerName];
    if (!provider) {
      return json({
        error: `Provider "${providerName}" tidak dikenal. Pilih: groq, gemini, openai`,
      }, 400, cors);
    }

    const BASE_URL = provider.baseUrl.replace(/\/$/, '');
    const MODEL = env.MODEL || provider.defaultModel;

    // System prompt
    const systemPrompt = buildSystemPrompt(mode, language);

    // Messages
    const safeHistory = Array.isArray(history)
      ? history
          .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
          .slice(-6)
          .map(m => ({ role: m.role, content: String(m.content) }))
      : [];

    const messages = [
      { role: 'system', content: systemPrompt },
      ...safeHistory,
      { role: 'user', content: prompt.trim() },
    ];

    // Call AI
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const apiResponse = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: mode === 'soal' ? 0.4 : 0.7,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!apiResponse.ok) {
        const errText = await apiResponse.text();
        let errMsg = `AI API Error ${apiResponse.status}`;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error?.message || errJson.message || errMsg;
        } catch {}
        return json({ error: errMsg }, apiResponse.status, cors);
      }

      const data = await apiResponse.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (!content) {
        return json({ error: 'AI tidak mengembalikan respons' }, 502, cors);
      }

      return json({ code: content }, 200, cors);

    } catch (err) {
      if (err.name === 'AbortError') {
        return json({ error: 'Timeout: AI terlalu lama merespons (60 detik)' }, 504, cors);
      }
      return json({ error: `Proxy error: ${err.message}` }, 500, cors);
    }
  },
};

// ============================================================
// SYSTEM PROMPT
// ============================================================
function buildSystemPrompt(mode, language) {
  if (mode === 'soal') {
    return `Kamu adalah guru dan tutor ahli yang membantu menjawab soal atau pertanyaan pelajaran.

ATURAN:
1. Jawab dengan jelas, ringkas, dan mudah dipahami.
2. Jika soal matematika/fisika/kimia, tunjukkan LANGKAH-LANGKAH penyelesaiannya.
3. Jika soal pilihan ganda, sebutkan jawaban benar beserta alasannya.
4. Gunakan Bahasa Indonesia yang baik dan benar.
5. Jika tidak yakin, katakan dengan jujur.
6. JANGAN gunakan markdown code block (\`\`\`), karena jawaban ditampilkan sebagai teks biasa.

Format:
- Jawaban singkat di awal
- Langkah/penjelasan detail
- Kesimpulan`;
  }

  return `Kamu adalah expert programmer senior. Buatkan CODE LENGKAP berdasarkan permintaan user.

ATURAN WAJIB:
1. Berikan code LENGKAP dan SIAP PAKAI.
2. Untuk HTML/CSS/JS, gabungkan dalam SATU file HTML lengkap dengan <style> dan <script> agar bisa langsung di-preview.
3. JANGAN pakai markdown code block (\`\`\`). Langsung tulis code-nya.
4. Tambahkan komentar pada bagian penting.
5. Bahasa: ${language === 'auto' ? 'deteksi otomatis' : language}

Balas HANYA dengan code, tanpa penjelasan di luar code.`;
}

// ============================================================
// HELPER
// ============================================================
function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
