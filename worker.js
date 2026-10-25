/**
 * ============================================================
 * Cloudflare Worker — Bye Zimzz Proxy (v4)
 * ============================================================
 * Frontend TANPA LOGIN — langsung bisa dipakai.
 * 
 * ENV VARS di Cloudflare Dashboard (Settings → Variables):
 * 
 *   WAJIB:
 *     API_KEY   (Secret)  — API key provider kamu
 *     PROVIDER  (Text)    — "groq" | "gemini" | "openai"
 * 
 *   OPSIONAL:
 *     MODEL           (Text) — override model default
 *     ALLOWED_ORIGIN  (Text) — default "*"
 * 
 * ============================================================
 * Contoh setting:
 * 
 *   GROQ (gratis, cepat):
 *     API_KEY  = gsk_xxxxxxxxxxxxxxxx
 *     PROVIDER = groq
 *     → model default: llama-3.3-70b-versatile
 * 
 *   GEMINI (gratis):
 *     API_KEY  = AIzaSyXXXXXXXXXXXXXXXX
 *     PROVIDER = gemini
 *     → model default: gemini-2.0-flash
 * 
 *   OPENAI (berbayar):
 *     API_KEY  = sk-proj-xxxxxxxxxxxxxxxx
 *     PROVIDER = openai
 *     → model default: gpt-4o-mini
 * ============================================================
 */

const APP_NAME = 'Bye Zimzz';

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
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // ========================================================
    // HEALTH CHECK (GET)
    // ========================================================
    if (request.method === 'GET') {
      const provider = (env.PROVIDER || 'groq').toLowerCase();
      const providerCfg = PROVIDERS[provider];

      return json({
        status: 'ok',
        app: APP_NAME,
        message: `${APP_NAME} Worker aktif`,
        provider: provider,
        model: env.MODEL || providerCfg?.defaultModel || 'unknown',
        hasApiKey: !!env.API_KEY,
        supportedModes: ['code', 'soal'],
        timestamp: new Date().toISOString(),
      }, 200, cors);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Gunakan POST untuk generate' }, 405, cors);
    }

    // ========================================================
    // PARSE BODY
    // ========================================================
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

    // ========================================================
    // VALIDASI
    // ========================================================
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return json({ error: 'Prompt tidak boleh kosong' }, 400, cors);
    }

    if (prompt.length > 8000) {
      return json({ error: 'Prompt terlalu panjang (maks 8000 karakter)' }, 400, cors);
    }

    if (!['code', 'soal'].includes(mode)) {
      return json({ error: 'Mode harus "code" atau "soal"' }, 400, cors);
    }

    // ========================================================
    // CONFIG PROVIDER
    // ========================================================
    const API_KEY = env.API_KEY;
    if (!API_KEY) {
      return json({
        error: `[${APP_NAME}] API_KEY belum di-set di Cloudflare Worker Settings.`,
      }, 500, cors);
    }

    const providerName = (env.PROVIDER || 'groq').toLowerCase();
    const provider = PROVIDERS[providerName];

    if (!provider) {
      return json({
        error: `[${APP_NAME}] PROVIDER "${providerName}" tidak dikenal. Pilih: groq, gemini, openai`,
      }, 400, cors);
    }

    const BASE_URL = provider.baseUrl.replace(/\/$/, '');
    const MODEL = env.MODEL || provider.defaultModel;

    // ========================================================
    // SYSTEM PROMPT
    // ========================================================
    const systemPrompt = buildSystemPrompt(mode, language);

    // ========================================================
    // MESSAGES
    // ========================================================
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

    // ========================================================
    // CALL AI
    // ========================================================
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

        if (apiResponse.status === 401) {
          errMsg = `[${APP_NAME}] API Key salah atau expired. Periksa di Cloudflare Settings.`;
        } else if (apiResponse.status === 429) {
          errMsg = `[${APP_NAME}] Rate limit tercapai. Tunggu sebentar atau ganti provider.`;
        } else if (apiResponse.status === 404) {
          errMsg = `[${APP_NAME}] Model "${MODEL}" tidak ditemukan di provider "${providerName}".`;
        }

        return json({ error: errMsg }, apiResponse.status, cors);
      }

      const data = await apiResponse.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (!content) {
        return json({ error: `${APP_NAME} tidak mengembalikan respons. Coba prompt lain.` }, 502, cors);
      }

      return json({ code: content }, 200, cors);

    } catch (err) {
      if (err.name === 'AbortError') {
        return json({ error: `${APP_NAME} timeout: AI terlalu lama merespons (60 detik)` }, 504, cors);
      }
      return json({ error: `[${APP_NAME}] Proxy error: ${err.message}` }, 500, cors);
    }
  },
};

// ============================================================
// SYSTEM PROMPT BUILDER
// ============================================================
function buildSystemPrompt(mode, language) {
  if (mode === 'soal') {
    return `Kamu adalah ${APP_NAME}, guru dan tutor ahli yang membantu menjawab soal atau pertanyaan pelajaran.

ATURAN:
1. Jawab dengan jelas, ringkas, dan mudah dipahami.
2. Jika soal matematika/fisika/kimia, tunjukkan LANGKAH-LANGKAH penyelesaiannya.
3. Jika soal pilihan ganda, sebutkan jawaban benar beserta alasannya.
4. Gunakan Bahasa Indonesia yang baik dan benar.
5. Jika tidak yakin, katakan dengan jujur.
6. JANGAN gunakan markdown code block (\`\`\`), karena jawaban akan ditampilkan sebagai teks biasa.

Format jawaban yang baik:
- Jawaban singkat di awal (1-2 kalimat)
- Langkah/penjelasan detail di bawahnya
- Kesimpulan di akhir`;
  }

  return `Kamu adalah ${APP_NAME}, expert programmer senior. Buatkan CODE LENGKAP berdasarkan permintaan user.

ATURAN WAJIB:
1. Berikan code LENGKAP dan SIAP PAKAI (bisa langsung dijalankan).
2. Untuk HTML/CSS/JS, gabungkan dalam SATU file HTML lengkap dengan <style> dan <script> di dalamnya agar bisa langsung di-preview.
3. JANGAN pakai markdown code block (\`\`\`). Langsung tulis code-nya saja.
4. Tambahkan komentar pada bagian penting.
5. Bahasa yang diminta: ${language === 'auto' ? 'deteksi otomatis dari prompt' : language}
6. Berikan code terbaik meskipun prompt singkat.

Balas HANYA dengan code, tanpa penjelasan di luar code.`;
}

// ============================================================
// HELPER
// ============================================================
function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}
