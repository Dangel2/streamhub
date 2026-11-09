document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = 'https://plain-lab-68c3.tvs12202.workers.dev';
  const TIMEOUT = 20000;
  let adminToken = sessionStorage.getItem('sh_admin_token') || '';
  let todasPlataformas = [];

  const loginBox = document.getElementById('loginBox');
  const panel = document.getElementById('panel');
  const pwInput = document.getElementById('pw');
  const goBtn = document.getElementById('go');
  const loginMsg = document.getElementById('loginMsg');
  const outBtn = document.getElementById('out');

  function setAuthenticated(isAuth) {
    if (isAuth) {
      loginBox.hidden = true; panel.hidden = false; outBtn.hidden = false;
      loadSystemStats(); loadPlatforms();
    } else {
      sessionStorage.removeItem('sh_admin_token'); adminToken = '';
      loginBox.hidden = false; panel.hidden = true; outBtn.hidden = true;
    }
  }

  if (adminToken) setAuthenticated(true);

  async function apiAdmin(endpoint, body = {}, method = 'POST') {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const res = await fetch(API_BASE + endpoint, {
        method,
        headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + adminToken },
        body: method === 'GET' ? undefined : JSON.stringify(body),
        signal: ctrl.signal
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && !endpoint.includes('login')) setAuthenticated(false);
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Error de autorización');
      return data;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('El servidor tardó demasiado');
      if (e instanceof TypeError) throw new Error('Sin conexión con el servidor (revisá ALLOWED_ORIGIN)');
      throw e;
    } finally { clearTimeout(t); }
  }

  function showMsg(el, text, isErr = false) {
    if (!el) return;
    el.textContent = text; el.className = 'msg show';
    el.style.background = isErr ? '#331216' : '#0d2f21';
    el.style.color = isErr ? '#ff9ea1' : '#17b26a';
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 5000);
  }

  goBtn.addEventListener('click', async () => {
    const password = pwInput.value.trim();
    if (!password) return showMsg(loginMsg, 'Ingresá la contraseña', true);
    goBtn.disabled = true; goBtn.textContent = 'Verificando...';
    try {
      const res = await fetch(API_BASE + '/api/admin/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }), signal: AbortSignal.timeout(TIMEOUT)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Contraseña incorrecta');
      adminToken = data.token;
      sessionStorage.setItem('sh_admin_token', adminToken);
      pwInput.value = '';
      setAuthenticated(true);
    } catch (e) {
      showMsg(loginMsg, e.message || 'Contraseña incorrecta', true);
      adminToken = '';
    } finally { goBtn.disabled = false; goBtn.textContent = 'Entrar'; }
  });

  pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') goBtn.click(); });
  outBtn.addEventListener('click', () => setAuthenticated(false));

  /* ---------- métricas ---------- */

  async function loadSystemStats() {
    try {
      const data = await apiAdmin('/api/admin/stats');
      document.getElementById('sCookies').textContent = data.cookies ?? 0;
      document.getElementById('sAct').textContent = data.actHoy ?? 0;
      document.getElementById('sOk').textContent = data.total ?? 0;
      document.getElementById('sErr').textContent = data.nuevosHoy ?? 0;
      document.getElementById('checks').innerHTML =
        '<span class="chk">Worker conectado</span><span class="chk">Sesión válida</span>';
      renderUsers(data.users || []);
    } catch (e) {
      document.getElementById('checks').innerHTML = '<span class="chk bad">Sin conexión</span>';
      showMsg(document.getElementById('statsMsg'), e.message, true);
    }
  }

  /* ---------- usuarios ---------- */

  function renderUsers(users) {
    const box = document.getElementById('users');
    if (!users.length) { box.innerHTML = '<div class="empty">Sin usuarios registrados</div>'; return; }

    box.innerHTML = `<table>
      <tr><th>ID</th><th>Usuario</th><th>Nombre</th><th>Estado</th><th>Consumo</th><th>Acciones</th></tr>
      ${users.map(u => {
        const uso = Object.entries(u.usage || {}).filter(([, v]) => v > 0)
          .map(([p, v]) => `${p}: ${v}`).join(' · ') || '—';
        return `<tr>
          <td><code>${u.tg}</code></td>
          <td>${u.username ? '@' + u.username : '—'}</td>
          <td>${u.first_name || '—'}</td>
          <td><span class="pill ${u.status === 'active' ? 'ok' : 'err'}">${
            u.status === 'active' ? 'Activo' : u.status === 'blocked' ? 'Bloqueado' : 'Pendiente'}</span></td>
          <td>${uso}</td>
          <td>
            <button class="ghost" data-act="active" data-tg="${u.tg}">Activar</button>
            <button class="del" data-act="blocked" data-tg="${u.tg}">Bloquear</button>
            <button class="del" data-act="reset" data-tg="${u.tg}">Reset</button>
          </td>
        </tr>`;
      }).join('')}</table>`;

    box.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tg = btn.dataset.tg, act = btn.dataset.act;
        try {
          if (act === 'reset') await apiAdmin('/api/admin/reset-usage', { tg });
          else await apiAdmin('/api/admin/set-status', { tg, status: act });
          loadSystemStats();
        } catch (e) { showMsg(document.getElementById('usersMsg'), e.message, true); }
      });
    });
  }

  document.getElementById('usersBtn').addEventListener('click', loadSystemStats);
  document.getElementById('reload').addEventListener('click', loadSystemStats);

  /* ---------- plataformas ---------- */

  async function loadPlatforms() {
    try {
      const r = await apiAdmin('/api/admin/platforms', {}, 'GET');
      todasPlataformas = r.platforms || [];
      renderToggles();
      fillDropdowns();
    } catch (e) { showMsg(document.getElementById('platsMsg'), e.message, true); }
  }

  function renderToggles() {
    const box = document.getElementById('plats');
    box.innerHTML = todasPlataformas.map(p => `
      <div class="ptog">
        <div class="nm">
          <span class="dot" style="background:${p.color}">${p.short}</span>
          <span>${p.name}</span>
        </div>
        <label class="sw">
          <input type="checkbox" data-id="${p.id}" ${p.enabled ? 'checked' : ''}>
          <span></span>
        </label>
      </div>`).join('');
  }

  function fillDropdowns() {
    ['plat', 'tplat'].forEach(id => {
      const sel = document.getElementById(id);
      sel.innerHTML = '';
      todasPlataformas.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id; opt.textContent = p.name;
        sel.appendChild(opt);
      });
    });
  }

  document.getElementById('platsSave').addEventListener('click', async () => {
    const ids = [...document.querySelectorAll('#plats input:checked')].map(i => i.dataset.id);
    try {
      await apiAdmin('/api/admin/platforms', { ids });
      showMsg(document.getElementById('platsMsg'), `Guardado: ${ids.length} plataforma(s) visibles`);
      loadPlatforms();
    } catch (e) { showMsg(document.getElementById('platsMsg'), e.message, true); }
  });

  document.getElementById('platsAll').addEventListener('click', async () => {
    const ids = todasPlataformas.map(p => p.id);
    try {
      await apiAdmin('/api/admin/platforms', { ids });
      showMsg(document.getElementById('platsMsg'), 'Todas las plataformas encendidas');
      loadPlatforms();
    } catch (e) { showMsg(document.getElementById('platsMsg'), e.message, true); }
  });

  /* ---------- cookies ---------- */

  document.getElementById('save').addEventListener('click', async () => {
    const platform = document.getElementById('plat').value;
    const cookieData = document.getElementById('raw').value.trim();
    const ckMsg = document.getElementById('ckMsg');
    const saveBtn = document.getElementById('save');
    if (!platform) return showMsg(ckMsg, 'Elegí una plataforma', true);
    if (!cookieData) return showMsg(ckMsg, 'La cookie está vacía', true);
    saveBtn.disabled = true; saveBtn.textContent = 'Guardando...';
    try {
      const r = await apiAdmin('/api/admin/save-cookie', { platform, cookieData });
      showMsg(ckMsg, r.message || 'Cookie guardada');
      document.getElementById('raw').value = '';
      loadSystemStats(); loadCookieList();
    } catch (e) { showMsg(ckMsg, e.message, true); }
    finally { saveBtn.disabled = false; saveBtn.textContent = 'Guardar cookie'; }
  });

  async function loadCookieList() {
    const platform = document.getElementById('plat').value;
    const box = document.getElementById('ckList');
    if (!platform) return;
    box.innerHTML = '<div class="empty">Cargando…</div>';
    try {
      const r = await apiAdmin('/api/admin/get-cookies?platform=' + encodeURIComponent(platform), {}, 'GET');
      if (!r.cookies.length) { box.innerHTML = '<div class="empty">Sin cookies cargadas</div>'; return; }
      box.innerHTML = `<table><tr><th>Archivo</th><th>Estado</th><th></th></tr>${
        r.cookies.map(c => `<tr>
          <td><code>${c.file}</code></td>
          <td><span class="pill ${c.dead ? 'err' : 'ok'}">${
            c.dead ? 'Muerta ' + (c.deadAt ? new Date(c.deadAt).toLocaleDateString('es-AR') : '') : 'Activa'}</span></td>
          <td><button class="del" data-file="${c.file}">Borrar</button></td>
        </tr>`).join('')}</table>`;
      box.querySelectorAll('.del').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('¿Borrar ' + btn.dataset.file + '?')) return;
          try {
            await apiAdmin('/api/admin/del-cookie', { platform, file: btn.dataset.file });
            loadCookieList(); loadSystemStats();
          } catch (e) { showMsg(document.getElementById('ckMsg'), e.message, true); }
        });
      });
    } catch (e) { box.innerHTML = `<div class="empty">Error: ${e.message}</div>`; }
  }

  document.getElementById('listBtn').addEventListener('click', loadCookieList);

  document.getElementById('purgeBtn').addEventListener('click', async () => {
    if (!confirm('¿Borrar definitivamente todas las cookies muertas y vencidas?')) return;
    const ckMsg = document.getElementById('ckMsg');
    try {
      const r = await apiAdmin('/api/admin/purge');
      showMsg(ckMsg, `Se borraron ${r.borradas} cookies`);
      loadCookieList(); loadSystemStats();
    } catch (e) { showMsg(ckMsg, e.message, true); }
  });

  document.getElementById('scanBtn').addEventListener('click', async () => {
    const btn = document.getElementById('scanBtn');
    const ckMsg = document.getElementById('ckMsg');
    btn.disabled = true; btn.textContent = 'Escaneando...';
    try {
      const r = await apiAdmin('/api/admin/scan');
      showMsg(ckMsg, `Resultado: ${r.vivas} vivas, ${r.muertas} marcadas como muertas`, r.muertas > 0);
      loadCookieList(); loadSystemStats();
    } catch (e) { showMsg(ckMsg, e.message, true); }
    finally { btn.disabled = false; btn.textContent = 'Escanear todas'; }
  });

  /* ---------- prueba ---------- */

  document.getElementById('test').addEventListener('click', async () => {
    const platform = document.getElementById('tplat').value;
    const code = document.getElementById('tcode').value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const tMsg = document.getElementById('tMsg');
    const tLog = document.getElementById('tLog');
    const testBtn = document.getElementById('test');
    if (!platform) return showMsg(tMsg, 'Elegí una plataforma', true);
    if (!code) return showMsg(tMsg, 'Ingresá el código', true);
    testBtn.disabled = true; testBtn.textContent = 'Probando...';
    try {
      showMsg(tMsg, 'Probando…', false);
      const list = await apiAdmin('/api/admin/get-cookies?platform=' + encodeURIComponent(platform), {}, 'GET');
      const pool = list.cookies.filter(c => !c.dead);
      if (!pool.length) throw new Error('No hay cookies activas');
      const sample = pool[Math.floor(Math.random() * pool.length)].content;
      const r = await apiAdmin('/api/admin/test', { platform, cookie: sample, code });
      tLog.innerHTML = `<pre class="log">${JSON.stringify(r, null, 2)}</pre>`;
      showMsg(tMsg, r.ok ? '¡Prueba exitosa!' : 'Falló', !r.ok);
    } catch (e) { showMsg(tMsg, e.message, true); }
    finally { testBtn.disabled = false; testBtn.textContent = 'Probar'; }
  });

  /* ---------- logs ---------- */

  document.getElementById('logsBtn').addEventListener('click', async () => {
    const el = document.getElementById('logs');
    const msg = document.getElementById('logMsg');
    el.innerHTML = '<div class="empty">Cargando…</div>';
    try {
      const r = await apiAdmin('/api/admin/logs');
      el.innerHTML = r.logs.length
        ? `<table><tr><th>Fecha</th><th>Usuario</th><th>Plataforma</th><th>Estado</th></tr>${
            r.logs.map(l => `<tr>
              <td>${new Date(l.ts).toLocaleString('es-AR')}</td>
              <td><code>${l.tg}</code></td>
              <td>${l.platform}</td>
              <td><span class="pill ${l.ok ? 'ok' : 'err'}">${l.ok ? 'OK' : 'Falló'}</span></td>
            </tr>`).join('')}</table>`
        : '<div class="empty">Sin registros</div>';
    } catch (e) { el.innerHTML = ''; showMsg(msg, e.message, true); }
  });
});
