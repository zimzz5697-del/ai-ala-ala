/**
 * ============================================================
 * Cloudflare Worker — Bye Zimzz AI Proxy (Final v6)
 * ============================================================
 * Fitur:
 *   - Mode "chat"  : tanya apa saja bebas
 *   - Mode "code"  : generate code
 *   - Mode "soal"  : jawab soal pelajaran
 *   - Gambar       : analisis foto (butuh model vision)
 *
 * ENV VARS di Cloudflare (Settings → Variables):
 *   WAJIB:
 *     API_KEY   (Secret)
 *     PROVIDER  (Text)  "groq" | "gemini" | "openai"
 *   OPSIONAL:
 *     MODEL           (Text)
 *     VISION_MODEL    (Text)  — model untuk analisis gambar
 *     ALLOWED_ORIGIN  (Text)
 *
 * Rekomendasi provider untuk FOTO:
 *   - Gemini (gemini-2.0-flash)  → gratis, support gambar
 *   - OpenAI (gpt-4o-mini)       → berbayar, support gambar
 *   - Groq  → TIDAK support gambar (hanya teks)
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
    visionModel: null, // Groq tidak support vision di endpoint OpenAI-compat
    supportsVision: false,
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    visionModel: 'gemini-2.0-flash',
    supportsVision: true,
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    visionModel: 'gpt-4o-mini',
    supportsVision: true,
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

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // ---------- HEALTH CHECK ----------
    if (request.method === 'GET') {
      const provider = (env.PROVIDER || 'gemini').toLowerCase();
      const cfg = PROVIDERS[provider];
      return json({
        status: 'ok',
        app: APP_NAME,
        message: `${APP_NAME} Worker aktif`,
        provider,
        model: env.MODEL || cfg?.defaultModel || 'unknown',
        visionModel: env.VISION_MODEL || cfg?.visionModel || null,
        supportsVision: !!cfg?.supportsVision,
        hasApiKey: !!env.API_KEY,
        supportedModes: ['chat', 'code', 'soal'],
        timestamp: new Date().toISOString(),
      }, 200, cors);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Gunakan POST' }, 405, cors);
    }

    // ---------- PARSE BODY ----------
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Body bukan JSON valid' }, 400, cors); }

    const {
      prompt = '',
      language = 'auto',
      history = [],
      mode = 'chat',
      image = null,      // { data: "base64...", mimeType: "image/jpeg" }
    } = body;

    // ---------- VALIDASI ----------
    if ((!prompt || !prompt.trim()) && !image) {
      return json({ error: 'Prompt atau gambar harus ada' }, 400, cors);
    }
    if (prompt && prompt.length > 8000) {
      return json({ error: 'Prompt maks 8000 karakter' }, 400, cors);
    }
    if (!['chat', 'code', 'soal'].includes(mode)) {
      return json({ error: 'Mode harus "chat", "code", atau "soal"' }, 400, cors);
    }

    // ---------- PROVIDER ----------
    const API_KEY = env.API_KEY;
    if (!API_KEY) {
      return json({ error: `[${APP_NAME}] API_KEY belum di-set.` }, 500, cors);
    }

    const providerName = (env.PROVIDER || 'gemini').toLowerCase();
    const provider = PROVIDERS[providerName];
    if (!provider) {
      return json({
        error: `PROVIDER "${providerName}" tidak dikenal. Pilih: groq, gemini, openai`,
      }, 400, cors);
    }

    // Cek apakah ada gambar
    const hasImage = image && image.data && image.mimeType;

    if (hasImage && !provider.supportsVision) {
      return json({
        error: `Provider "${providerName}" tidak mendukung foto. Ganti PROVIDER ke "gemini" atau "openai".`,
      }, 400, cors);
    }

    const BASE_URL = provider.baseUrl.replace(/\/$/, '');
    const MODEL = hasImage
      ? (env.VISION_MODEL || provider.visionModel)
      : (env.MODEL || provider.defaultModel);

    // ---------- SYSTEM PROMPT ----------
    const systemPrompt = buildSystemPrompt(mode, language, hasImage);

    // ---------- BUILD MESSAGES ----------
    const safeHistory = Array.isArray(history)
      ? history
          .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
          .slice(-6)
          .map(m => ({ role: m.role, content: String(m.content) }))
      : [];

    // User message dengan / tanpa gambar
    let userContent;
    if (hasImage) {
      userContent = [
        { type: 'text', text: prompt?.trim() || 'Jelaskan gambar ini.' },
        {
          type: 'image_url',
          image_url: { url: `data:${image.mimeType};base64,${image.data}` },
        },
      ];
    } else {
      userContent = prompt.trim();
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...safeHistory,
      { role: 'user', content: userContent },
    ];

    // ---------- CALL AI ----------
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
          temperature: mode === 'code' ? 0.7 : (mode === 'soal' ? 0.4 : 0.6),
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
          errMsg = `[${APP_NAME}] API Key salah / expired.`;
        } else if (apiResponse.status === 429) {
          errMsg = `[${APP_NAME}] Rate limit. Tunggu sebentar.`;
        } else if (apiResponse.status === 404) {
          errMsg = `[${APP_NAME}] Model "${MODEL}" tidak tersedia di "${providerName}".`;
        }

        return json({ error: errMsg }, apiResponse.status, cors);
      }

      const data = await apiResponse.json();
      const content = data.choices?.[0]?.message?.content || '';
      if (!content) {
        return json({ error: `${APP_NAME} tidak mengembalikan respons.` }, 502, cors);
      }

      return json({ code: content }, 200, cors);

    } catch (err) {
      if (err.name === 'AbortError') {
        return json({ error: `${APP_NAME} timeout: 60 detik` }, 504, cors);
      }
      return json({ error: `[${APP_NAME}] Proxy error: ${err.message}` }, 500, cors);
    }
  },
};

// ============================================================
// SYSTEM PROMPT
// ============================================================
function buildSystemPrompt(mode, language, hasImage) {
  if (hasImage) {
    return `Kamu adalah ${APP_NAME}, asisten AI cerdas yang bisa menganalisis gambar.

ATURAN:
1. Deskripsikan gambar dengan detail dan jelas.
2. Jika gambar berisi soal/tugas → bantu jawab atau selesaikan.
3. Jika gambar berisi code → jelaskan atau perbaiki jika perlu.
4. Jika gambar berisi teks → baca dan rangkum.
5. Jika gambar berisi objek → identifikasi dan jelaskan.
6. Gunakan Bahasa Indonesia yang baik dan benar.
7. JANGAN pakai markdown code block (\`\`\`) kecuali memang perlu untuk code.
8. Format jawaban rapi dan mudah dibaca.`;
  }

  if (mode === 'soal') {
    return `Kamu adalah ${APP_NAME}, guru dan tutor ahli yang membantu menjawab soal pelajaran.

ATURAN:
1. Jawab dengan jelas, ringkas, dan mudah dipahami.
2. Untuk matematika/fisika/kimia → tunjukkan LANGKAH-LANGKAH.
3. Untuk pilihan ganda → sebutkan jawaban benar + alasan.
4. Gunakan Bahasa Indonesia yang baik dan benar.
5. JANGAN gunakan markdown code block (\`\`\`).

Format:
- Jawaban singkat di awal
- Langkah/penjelasan detail
- Kesimpulan`;
  }

  if (mode === 'code') {
    return `Kamu adalah ${APP_NAME}, expert programmer senior.

ATURAN WAJIB:
1. Berikan code LENGKAP dan SIAP PAKAI.
2. HTML/CSS/JS → gabungkan dalam SATU file HTML lengkap.
3. JANGAN pakai markdown code block (\`\`\`). Langsung tulis code-nya.
4. Tambahkan komentar pada bagian penting.
5. Bahasa: ${language === 'auto' ? 'deteksi otomatis' : language}

Balas HANYA dengan code.`;
  }

  // mode chat (bebas)
  return `Kamu adalah ${APP_NAME}, asisten AI ramah dan serba bisa.

ATURAN:
1. Jawab pertanyaan user dengan jelas, akurat, dan menyenangkan.
2. Bisa bahas topik apa saja: sains, sejarah, teknologi, kehidupan sehari-hari, curhat, ide, dll.
3. Jika user bertanya soal matematika/logika → jelaskan langkahnya.
4. Jika user minta code → berikan code (tanpa markdown code block \`\`\`).
5. Gunakan Bahasa Indonesia santai tapi sopan.
6. Jujur kalau tidak tahu, jangan mengarang.
7. Jawaban rapi dan mudah dibaca.`;
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
