/**
 * Cloudflare Worker — Proxy untuk CodeAI
 * Menyimpan API Key di server, frontend tidak perlu key.
 * 
 * Deploy:
 * 1. Buka https://dash.cloudflare.com → Workers & Pages → Create Worker
 * 2. Paste kode ini
 * 3. Settings → Variables → tambahkan API_KEY (encrypted secret)
 * 4. (Opsional) tambahkan MODEL, BASE_URL, ALLOWED_ORIGIN
 * 5. Deploy → copy URL-nya ke script.js (const WORKER_URL)
 */

export default {
  async fetch(request, env, ctx) {
    // === CORS Headers ===
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // === Handle preflight OPTIONS ===
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // === Hanya izinkan POST ===
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    // === Parse body ===
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, corsHeaders);
    }

    const { prompt, language = 'auto', history = [] } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return jsonResponse({ error: 'Prompt tidak boleh kosong' }, 400, corsHeaders);
    }

    if (prompt.length > 5000) {
      return jsonResponse({ error: 'Prompt terlalu panjang (maks 5000 karakter)' }, 400, corsHeaders);
    }

    // === Ambil config dari env ===
    const API_KEY = env.API_KEY;
    const BASE_URL = (env.BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const MODEL = env.MODEL || 'gpt-3.5-turbo';

    if (!API_KEY) {
      return jsonResponse({ error: 'Server belum dikonfigurasi (API_KEY kosong)' }, 500, corsHeaders);
    }

    // === System prompt ===
    const systemPrompt = `Kamu adalah expert programmer senior. Buatkan CODE LENGKAP berdasarkan permintaan user.

ATURAN WAJIB:
1. Berikan code LENGKAP dan SIAP PAKAI (bisa langsung dijalankan).
2. Untuk HTML/CSS/JS, gabungkan dalam SATU file HTML lengkap dengan <style> dan <script> di dalamnya agar bisa langsung di-preview.
3. JANGAN pakai markdown code block (\`\`\`). Langsung tulis code-nya saja.
4. Tambahkan komentar pada bagian penting.
5. Bahasa yang diminta user: ${language === 'auto' ? 'deteksi otomatis dari prompt' : language}
6. Jika tidak yakin, tetap berikan code terbaik.

Balas HANYA dengan code, tanpa penjelasan tambahan di luar code.`;

    // === Build messages ===
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
        .slice(-6)
        .map(m => ({ role: m.role, content: String(m.content) })),
      { role: 'user', content: prompt.trim() },
    ];

    // === Call AI API ===
    try {
      const apiResponse = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!apiResponse.ok) {
        const errText = await apiResponse.text();
        let errMsg = `AI API Error ${apiResponse.status}`;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error?.message || errMsg;
        } catch {}

        return jsonResponse({ error: errMsg }, apiResponse.status, corsHeaders);
      }

      const data = await apiResponse.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (!content) {
        return jsonResponse({ error: 'AI tidak mengembalikan code' }, 502, corsHeaders);
      }

      return jsonResponse({ code: content }, 200, corsHeaders);

    } catch (err) {
      return jsonResponse({ error: `Proxy error: ${err.message}` }, 500, corsHeaders);
    }
  },
};

// ============ Helper ============
function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}
