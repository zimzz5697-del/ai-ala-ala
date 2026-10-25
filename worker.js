/**
 * Cloudflare Worker — CodeAI Proxy
 * Support: Groq, OpenAI, Gemini (OpenAI-compatible)
 * Mode: "code" (generate code) & "soal" (jawab soal)
 *
 * ENV VARS yang dibutuhkan di Cloudflare:
 *   API_KEY         (Secret) - API key provider
 *   BASE_URL        (Text)   - default: https://api.openai.com/v1
 *   MODEL           (Text)   - default: gpt-3.5-turbo
 *   ALLOWED_ORIGIN  (Text)   - default: *
 */

export default {
  async fetch(request, env) {
    // ============================================================
    // CORS
    // ============================================================
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed. Gunakan POST.' }, 405, corsHeaders);
    }

    // ============================================================
    // PARSE BODY
    // ============================================================
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Body bukan JSON valid' }, 400, corsHeaders);
    }

    const {
      prompt = '',
      language = 'auto',
      history = [],
      mode = 'code', // 'code' | 'soal'
    } = body;

    // Validasi
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return jsonResponse({ error: 'Prompt tidak boleh kosong' }, 400, corsHeaders);
    }

    if (prompt.length > 8000) {
      return jsonResponse({ error: 'Prompt terlalu panjang (maks 8000 karakter)' }, 400, corsHeaders);
    }

    if (!['code', 'soal'].includes(mode)) {
      return jsonResponse({ error: 'Mode tidak valid (harus "code" atau "soal")' }, 400, corsHeaders);
    }

    // ============================================================
    // CONFIG
    // ============================================================
    const API_KEY = env.API_KEY;
    const BASE_URL = (env.BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const MODEL = env.MODEL || 'gpt-3.5-turbo';

    if (!API_KEY) {
      return jsonResponse({
        error: 'Server belum dikonfigurasi. Set API_KEY di Cloudflare Worker Settings.'
      }, 500, corsHeaders);
    }

    // ============================================================
    // SYSTEM PROMPT BERDASARKAN MODE
    // ============================================================
    let systemPrompt;

    if (mode === 'soal') {
      systemPrompt = `Kamu adalah guru dan tutor ahli yang membantu menjawab soal atau pertanyaan pelajaran.

ATURAN:
1. Jawab dengan jelas, ringkas, dan mudah dipahami.
2. Jika soal matematika/fisika/kimia, tunjukkan LANGKAH-LANGKAH penyelesaiannya.
3. Jika soal pilihan ganda, sebutkan jawaban yang benar beserta alasannya.
4. Gunakan Bahasa Indonesia yang baik dan benar.
5. Jika soal berupa gambar/teks panjang, identifikasi inti pertanyaannya dulu.
6. Jika tidak yakin, katakan dengan jujur.
7. JANGAN gunakan markdown code block (\`\`\`), karena jawaban akan ditampilkan sebagai teks biasa.

Format jawaban:
- Jawaban singkat di awal (1-2 kalimat)
- Langkah/penjelasan detail di bawahnya
- Kesimpulan di akhir`;
    } else {
      systemPrompt = `Kamu adalah expert programmer senior. Buatkan CODE LENGKAP berdasarkan permintaan user.

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
    // BUILD MESSAGES
    // ============================================================
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

    // ============================================================
    // CALL AI API
    // ============================================================
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 detik timeout

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
        return jsonResponse({ error: errMsg }, apiResponse.status, corsHeaders);
      }

      const data = await apiResponse.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (!content) {
        return jsonResponse({ error: 'AI tidak mengembalikan respons' }, 502, corsHeaders);
      }

      return jsonResponse({ code: content }, 200, corsHeaders);

    } catch (err) {
      if (err.name === 'AbortError') {
        return jsonResponse({ error: 'Timeout: AI terlalu lama merespons (60s)' }, 504, corsHeaders);
      }
      return jsonResponse({ error: `Proxy error: ${err.message}` }, 500, corsHeaders);
    }
  },
};

// ============================================================
// HELPER
// ============================================================
function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}
