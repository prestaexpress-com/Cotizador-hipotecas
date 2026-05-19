(function () {
  if (!window.APP_CONFIG || !window.APP_CONFIG.SUPABASE_URL || !window.APP_CONFIG.SUPABASE_KEY) {
    console.error('APP_CONFIG no está definido. Crea un archivo config.js basado en config.example.js');
    return;
  }

  const { SUPABASE_URL, SUPABASE_KEY } = window.APP_CONFIG;

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  async function supabaseFetch(path, method = 'GET', body = null, extraHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      ...extraHeaders
    };

    if (method === 'POST') headers['Prefer'] = 'return=representation';
    if (method === 'PATCH' && !headers['Prefer']) headers['Prefer'] = 'return=representation';

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
    } catch (networkErr) {
      throw new Error('Sin conexión. Verifica tu internet e intenta de nuevo.');
    }

    if (!res.ok) {
      let errMsg = 'Error en la operación';
      try {
        const err = await res.json();
        errMsg = err.message || err.error_description || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    if (method === 'DELETE' || res.status === 204) return null;
    return res.json();
  }

  async function authFetch(path, sessionToken, opts = {}) {
    const headers = {
      ...opts.headers,
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {})
    };

    const url = path.startsWith('http') ? path : `${SUPABASE_URL}/${path}`;

    try {
      return await fetch(url, { ...opts, headers });
    } catch {
      throw new Error('Sin conexión. Verifica tu internet e intenta de nuevo.');
    }
  }

  async function authLogin(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      throw new Error('Credenciales incorrectas');
    }
    return data;
  }

  async function authVerify(token) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
    });
    return res.ok;
  }

  function fmt(n, decimales = 2) {
    if (n === null || n === undefined || n === '') return '0.00';
    return parseFloat(n).toLocaleString('es-GT', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales
    });
  }

  function fmtFecha(iso, opts) {
    if (!iso) return '—';
    const defaults = { day: '2-digit', month: 'short', year: 'numeric' };
    return new Date(iso).toLocaleDateString('es-GT', opts || defaults);
  }

  function copiarTexto(texto) {
    return navigator.clipboard.writeText(texto);
  }

  window.SupabaseClient = {
    SUPABASE_URL,
    supabaseFetch,
    authFetch,
    authLogin,
    authVerify,
    escapeHtml,
    escapeAttr,
    fmt,
    fmtFecha,
    copiarTexto
  };
})();
