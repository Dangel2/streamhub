document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = 'https://plain-lab-68c3.tvs12202.workers.dev'; // Misma URL base del Worker
  let adminToken = sessionStorage.getItem('sh_admin_token') || '';

  const loginBox = document.getElementById('loginBox');
  const panel = document.getElementById('panel');
  const pwInput = document.getElementById('pw');
  const goBtn = document.getElementById('go');
  const loginMsg = document.getElementById('loginMsg');
  const outBtn = document.getElementById('out');

  function setAuthenticated(isAuth) {
    if (isAuth) {
      loginBox.hidden = true;
      panel.hidden = false;
      outBtn.hidden = false;
      loadSystemStats();
      loadPlatformsDropdown();
    } else {
      sessionStorage.removeItem('sh_admin_token');
      adminToken = '';
      loginBox.hidden = false;
      panel.hidden = true;
      outBtn.hidden = true;
    }
  }

  if (adminToken) setAuthenticated(true);

  async function apiAdmin(endpoint, body = {}, method = 'POST') {
    const res = await fetch(API_BASE + endpoint, {
      method,
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + adminToken
      },
      body: method !== 'GET' ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || 'Error de autenticación o servidor');
    }
    return data;
  }

  goBtn.addEventListener('click', async () => {
    const password = pwInput.value.trim();
    if (!password) return showMsg(loginMsg, 'Ingresá la contraseña', true);
    goBtn.disabled = true;
    goBtn.textContent = 'Verificando...';
    try {
      // Intentamos autenticar guardando temporalmente el token o probando endpoint admin
      adminToken = password; 
      const stats = await apiAdmin('/api/admin/stats', {});
      sessionStorage.setItem('sh_admin_token', adminToken);
      setAuthenticated(true);
      pwInput.value = '';
    } catch (e) {
      showMsg(loginMsg, 'Contraseña incorrecta o sin permisos', true);
      adminToken = '';
    } finally {
      goBtn.disabled = false;
      goBtn.textContent = 'Entrar';
    }
  });

  outBtn.addEventListener('click', () => setAuthenticated(false));

  function showMsg(el, text, isErr = false) {
    el.textContent = text;
    el.className = 'msg show' + (isErr ? '' : '');
    if (!isErr) {
      el.style.background = '#0d2f21';
      el.style.color = '#17b26a';
    } else {
      el.style.background = '#331216';
      el.style.color = '#ff9ea1';
    }
    setTimeout(() => el.classList.remove('show'), 5000);
  }

  // Cargar estadísticas y estado
  async function loadSystemStats() {
    try {
      const data = await apiAdmin('/api/admin/stats', {});
      document.getElementById('sCookies').textContent = data.cookiesCount ?? 0;
      document.getElementById('sAct').textContent = data.totalActivations ?? 0;
      document.getElementById('sOk').textContent = data.successCount ?? 0;
      document.getElementById('sErr').textContent = data.errorCount ?? 0;
      
      const checksEl = document.getElementById('checks');
      checksEl.innerHTML = '<span class="chk">Cloudflare Worker Conectado</span><span class="chk">Sistema Operativo</span>';
    } catch (e) {
      document.getElementById('statsMsg').textContent = 'Error al cargar métricas: ' + e.message;
    }
  }

  document.getElementById('reload').addEventListener('click', loadSystemStats);

  // Selector de plataformas en Admin
  async function loadPlatformsDropdown() {
    try {
      const res = await fetch('platforms.json');
      const data = await res.json();
      const selects = [document.getElementById('plat'), document.getElementById('tplat')];
      
      selects.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '';
        data.platforms.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name;
          sel.appendChild(opt);
        });
      });
    } catch (e) {
      console.error('No se pudieron cargar las plataformas', e);
    }
  }

  // Guardar Cookie
  document.getElementById('save').addEventListener('click', async () => {
    const platform = document.getElementById('plat').value;
    const raw = document.getElementById('raw').value.trim();
    const ckMsg = document.getElementById('ckMsg');

    if (!raw) return showMsg(ckMsg, 'El contenido de la cookie está vacío', true);

    try {
      await apiAdmin('/api/admin/cookie', { platform, raw });
      showMsg(ckMsg, '¡Cookie guardada y sincronizada correctamente!');
      document.getElementById('raw').value = '';
      loadSystemStats();
    } catch (e) {
      showMsg(ckMsg, e.message, true);
    }
  });

  // Prueba de activación desde admin
  document.getElementById('test').addEventListener('click', async () => {
    const platform = document.getElementById('tplat').value;
    const code = document.getElementById('tcode').value.trim();
    const tMsg = document.getElementById('tMsg');
    const tLog = document.getElementById('tLog');

    if (!code) return showMsg(tMsg, 'Ingresá el código de la TV para probar', true);

    try {
      tMsg.textContent = 'Probando activación...';
      tMsg.className = 'msg show';
      const r = await apiAdmin('/api/admin/test-activate', { platform, code });
      tLog.innerHTML = `<pre class="log">${JSON.stringify(r, null, 2)}</pre>`;
      showMsg(tMsg, r.ok ? '¡Prueba de activación exitosa!' : 'La activación falló, revisá los logs.');
    } catch (e) {
      showMsg(tMsg, e.message, true);
    }
  });
});
