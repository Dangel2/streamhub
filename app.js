(() => {
  const API_BASE = 'https://plain-lab-68c3.tvs12202.workers.dev';
  const TIMEOUT = 25000;

  const $ = s => document.querySelector(s);
  const toastEl = $('#toast');

  if (!localStorage.getItem('dg_session') && sessionStorage.getItem('dg_session')) {
    localStorage.setItem('dg_session', sessionStorage.getItem('dg_session'));
    sessionStorage.removeItem('dg_session');
  }

  let session = localStorage.getItem('dg_session') || '';
  let me = null;
  let otpToken = '';
  let tgId = '';
  let platforms = [];
  let lastUrl = '';
  let selected = null;
  let volverA = 3;

  function toast(msg, isErr = true) {
    toastEl.textContent = msg;
    toastEl.className = 'toast' + (isErr ? ' err' : '');
    toastEl.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toastEl.hidden = true; }, 4200);
  }

  function show(n) {
    document.querySelectorAll('.screen').forEach(s => {
      s.hidden = s.dataset.screen !== String(n);
    });
    $('#topbar').hidden = ![3, 4, 5, 6, 8, 9].includes(Number(n));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function api(path, body, opt = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opt.timeout || TIMEOUT);
    try {
      const headers = { 'content-type': 'application/json' };
      if (opt.auth !== false && session) headers.authorization = 'Bearer ' + session;
      const res = await fetch(API_BASE + path, {
        method: opt.method || 'POST',
        headers,
        body: opt.method === 'GET' ? undefined : JSON.stringify(body || {}),
        signal: ctrl.signal
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { logout(); throw new Error('Sesión vencida'); }
      if (!res.ok || data.ok === false) {
        const err = new Error(data.error || 'Error del servidor');
        err.code = data.code;
        throw err;
      }
      return data;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('El servidor tardó demasiado.');
      if (e instanceof TypeError) throw new Error('Sin conexión con el servidor.');
      throw e;
    } finally { clearTimeout(t); }
  }

  async function withBtn(btn, label, fn) {
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = label;
    try { return await fn(); }
    finally { btn.textContent = old; btn.disabled = false; }
  }

  function logout() {
    session = '';
    me = null;
    localStorage.removeItem('dg_session');
    closeDrawer();
    show(1);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- OTP ---------- */

  function wireOtp(container, onChange) {
    const inputs = [...container.querySelectorAll('input')];
    const val = () => inputs.map(i => i.value).join('');
    inputs.forEach((inp, i) => {
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
        if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
        onChange(val());
      });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !inp.value && i > 0) {
          e.preventDefault();
          inputs[i - 1].focus(); inputs[i - 1].value = '';
          onChange(val());
        }
      });
      inp.addEventListener('paste', e => {
        const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
        if (!d) return;
        e.preventDefault();
        inputs.forEach((x, j) => { x.value = d[j] || ''; });
        onChange(val());
        inputs[Math.min(d.length, inputs.length - 1)].focus();
      });
    });
    return { val, clear: () => { inputs.forEach(i => i.value = ''); inputs[0].focus(); } };
  }

  const otpLogin = wireOtp($('#otpLogin'), v => { $('#btnLogin').disabled = v.length !== 6; });

  $('#tgId').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);
  });

  $('#btnSend').addEventListener('click', () => {
    const id = $('#tgId').value.trim();
    if (!/^\d{5,12}$/.test(id)) return toast('Ingresá un ID de Telegram válido');
    withBtn($('#btnSend'), '…', async () => {
      try {
        const r = await api('/api/otp', { tg: id }, { auth: false });
        otpToken = r.token; tgId = id;
        $('#tgIdShow').value = id;
        otpLogin.clear();
        $('#btnLogin').disabled = true;
        show(2);
        toast('Código enviado a tu Telegram', false);
      } catch (e) { toast(e.message); }
    });
  });

  $('#btnResend').addEventListener('click', () => {
    if (!tgId) return show(1);
    withBtn($('#btnResend'), 'Enviando…', async () => {
      try {
        const r = await api('/api/otp', { tg: tgId }, { auth: false });
        otpToken = r.token; otpLogin.clear();
        $('#btnLogin').disabled = true;
        toast('Código reenviado', false);
      } catch (e) { toast(e.message); }
    });
  });

  $('#btnLogin').addEventListener('click', async () => {
    const code = otpLogin.val();
    if (code.length !== 6) return toast('El código tiene 6 dígitos');
    try {
      const r = await api('/api/verify', { token: otpToken, code }, { auth: false });
      session = r.session;
      localStorage.setItem('dg_session', session);
      otpLogin.clear();
      me = r.user;
      await loadPlatforms();
      renderDashboard();
      show(3);
    } catch (e) {
      toast(e.message);
      otpLogin.clear();
      $('#btnLogin').disabled = true;
    }
  });

  /* ---------- dashboard ---------- */

  async function loadMe() {
    const r = await api('/api/me', {}, { method: 'GET' });
    me = r.user;
    renderDashboard();
  }

  function renderDashboard() {
    if (!me) return;
    const nombre = me.first_name || me.username || 'Usuario';
    const av = $('#meAvatar');

    if (me.photo_url) {
      av.innerHTML = `<img src="${esc(me.photo_url)}" alt="">`;
    } else {
      av.textContent = nombre.trim().charAt(0).toUpperCase() || '?';
    }

    $('#meName').textContent = nombre;
    $('#meUser').textContent = me.username ? '@' + me.username : 'ID ' + me.tg;
    $('#dwName').textContent = nombre;
    $('#dwStatus').textContent = me.status === 'active' ? '🟢 Activo' : '🔴 Sin permiso';

    const st = $('#meStatus');
    st.className = 'pill ' + (me.status === 'active' ? 'ok' : 'bad');
    st.textContent = me.status === 'active' ? '🟢 Activo' : '🔴 Inactivo';

    const alerta = $('#meAlert');
    if (me.status === 'active') alerta.hidden = true;
    else {
      alerta.hidden = false;
      alerta.textContent = '⏳ Tu cuenta espera aprobación del administrador. Hasta entonces no podés usar las plataformas.';
    }

    const entradas = Object.entries(me.usage || {})
      .filter(([p, v]) => v > 0 && platforms.some(x => x.id === p));

    $('#meUsage').innerHTML = entradas.length
      ? entradas.map(([p, v]) => `<div class="usage-item"><b>${esc(platformName(p))}</b><span>${v}</span></div>`).join('')
      : '<div class="muted">Sin consumos registrados</div>';
  }

  function platformName(id) {
    const p = platforms.find(x => x.id === id);
    return p ? p.name : id;
  }

  $('#btnRefresh').addEventListener('click', () => withBtn($('#btnRefresh'), '…', async () => {
    try { await loadPlatforms(); await loadMe(); toast('Datos actualizados', false); }
    catch (e) { toast(e.message); }
  }));

  $('#btnGoPlats').addEventListener('click', async () => {
    if (!me) return;
    if (me.status !== 'active') return toast('Tu cuenta espera aprobación del administrador');
    await renderPlatforms();
    show(4);
  });

  /* ---------- plataformas ---------- */

  async function loadPlatforms() {
    try {
      const r = await api('/api/platforms', {}, { method: 'GET' });
      platforms = Array.isArray(r.platforms) ? r.platforms : [];
    } catch {
      try {
        const res = await fetch('platforms.json', { cache: 'no-store' });
        const d = await res.json();
        platforms = Array.isArray(d.platforms) ? d.platforms : [];
      } catch { platforms = []; }
    }
  }

  async function renderPlatforms() {
    const box = $('#plats');
    box.innerHTML = '<span class="muted">Cargando…</span>';
    await loadPlatforms();

    if (!platforms.length) {
      box.innerHTML = '<div class="muted">El administrador no tiene plataformas habilitadas.</div>';
      return;
    }

    box.innerHTML = '';
    platforms.forEach(p => {
      const el = document.createElement('div');
      el.className = 'plat';
      el.innerHTML = `<div class="ic" style="background:${esc(p.color)}">
          <span>${esc(p.short)}</span>
          <img src="${esc(p.id)}.png" alt="" onerror="this.remove()">
        </div>
        <div class="txt"><b></b><small>⚡ Acceso directo</small></div>
        <div class="radio">›</div>`;
      el.querySelector('b').textContent = p.name;
      el.addEventListener('click', () => {
        if (me.status !== 'active') return toast('Tu cuenta espera aprobación del administrador');
        quickAccess(p);
      });
      box.appendChild(el);
    });
  }

  /* ---------- acceso rápido ---------- */

  function quickAccess(p) {
    if (p.id === 'netflix') return directNetflix();
    openTvPanel(p, true);
  }

  function go(url) {
    const bridge = window.AndroidBridge || window.webkit?.messageHandlers?.dgflix;
    if (bridge && typeof bridge.openUrl === 'function') bridge.openUrl(url);
    else if (bridge && typeof bridge.postMessage === 'function') bridge.postMessage(JSON.stringify({ action: 'open', url }));
    else window.location.href = url;
  }

  async function directNetflix() {
    show(5);
    $('#directLog').hidden = true;
    $('#btnDirectOpen').disabled = true;
    $('#btnDirectCopy').hidden = true;
    $('#directBox').textContent = 'Solicitando cookie activa y generando token…';

    try {
      const r = await api('/api/nftoken', {});
      lastUrl = r.url_tv;
      $('#directBox').innerHTML =
        `✅ Sesión generada<br><small class="muted">Caduca: ${esc(r.caduca)} · archivo ${esc(r.file)}</small>`;
      $('#directLog').textContent = `tv:    ${r.url_tv}\nweb:   ${r.url_web}\nmóvil: ${r.url_app}`;
      $('#directLog').hidden = false;
      $('#btnDirectOpen').disabled = false;
      $('#btnDirectCopy').hidden = false;

      setTimeout(() => {
        if (!$('#btnDirectOpen').disabled) go(r.url_tv);
      }, 1000);

      registrarToken('netflix', r.url_tv);
      await loadMe();
    } catch (e) {
      $('#directBox').textContent = '⚠️ ' + e.message;
      if (e.code === 'INACTIVE') setTimeout(() => { renderDashboard(); show(3); }, 1600);
    }
  }

  $('#btnDirectOpen').addEventListener('click', () => lastUrl && go(lastUrl));
  $('#btnDirectCopy').addEventListener('click', async () => {
    if (!lastUrl) return;
    try { await navigator.clipboard.writeText(lastUrl); toast('Enlace copiado', false); }
    catch { toast('No se pudo copiar'); }
  });
  $('#btnDirectBack').addEventListener('click', () => { renderDashboard(); show(3); });

  /* ---------- panel TV ---------- */

  function openTvPanel(p, autoOpen = false) {
    selected = p;
    const tv = $('#tvCode');
    tv.value = '';
    tv.maxLength = p.codeLength || 8;
    tv.placeholder = `Código de ${p.codeLength || 8} caracteres`;
    $('#btnActivate').disabled = true;
    $('#tvTitle').textContent = p.name;
    $('#tvLogo').innerHTML = `<img src="${esc(p.id)}.png" alt="🔑">`;
    show(6);
    tv.focus();

    if (autoOpen && p.tvUrl) {
      registrarToken(p.id, p.tvUrl);
      setTimeout(() => go(p.tvUrl), 900);
    }
  }

  $('#btnReopen').addEventListener('click', () => {
    if (selected?.tvUrl) go(selected.tvUrl);
  });

  $('#tvCode').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    $('#btnActivate').disabled = e.target.value.length < 4;
  });

  $('#btnTvBack').addEventListener('click', () => { renderPlatforms(); show(4); });

  $('#btnActivate').addEventListener('click', async () => {
    const code = $('#tvCode').value.trim();
    if (!selected || code.length < 4) return toast('Código incompleto');
    await withBtn($('#btnActivate'), 'Activando…', async () => {
      try {
        const r = await api('/api/activate', { platform: selected.id, code }, { timeout: 45000 });
        $('#resIcon').textContent = '✅';
        $('#resTitle').textContent = 'Listo';
        $('#resSub').textContent = 'Activación enviada';
        $('#resLog').textContent = (r.steps || []).join('\n');
        await loadMe();
        show(7);
      } catch (e) { toast(e.message); }
    });
  });

  $('#btnAgain').addEventListener('click', () => { renderDashboard(); show(3); });

  /* ---------- NFtoken (pantalla) ---------- */

  $('#nfGo').addEventListener('click', () => withBtn($('#nfGo'), 'Generando…', async () => {
    const raw = $('#nfRaw').value.trim();
    if (!raw) return toast('Pegá una cookie');
    try {
      const r = await api('/api/nftoken', { cookie: raw });
      $('#nfOut').innerHTML = `
        <div class="alert ok">Caduca: ${esc(r.caduca)}</div>
        <a class="lnk" href="${esc(r.url_tv)}" target="_blank" rel="noopener">📺 Activación TV</a>
        <a class="lnk" href="${esc(r.url_web)}" target="_blank" rel="noopener">🌐 Web</a>
        <a class="lnk" href="${esc(r.url_app)}" target="_blank" rel="noopener">📱 Móvil</a>`;
      registrarToken('netflix-manual', r.url_tv);
    } catch (e) { $('#nfOut').innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
  }));

  $('#nfBack').addEventListener('click', () => show(volverA));

  /* ---------- BIN (pantalla) ---------- */

  $('#binIn').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
  });

  function fila(etiqueta, valor) {
    return `<tr><th>${esc(etiqueta)}</th><td>${valor || '—'}</td></tr>`;
  }

  $('#binGo').addEventListener('click', () => withBtn($('#binGo'), '…', async () => {
    const bin = $('#binIn').value.trim();
    if (bin.length < 6) return toast('El BIN necesita al menos 6 dígitos');

    $('#binOut').innerHTML = '<div class="muted">Consultando…</div>';
    let d = null;
    try {
      const r = await fetch('https://lookup.binlist.net/' + bin, { headers: { 'Accept-Version': '3' } });
      if (r.ok) d = await r.json();
    } catch {}

    if (!d) {
      try {
        const r = await api('/api/bin?bin=' + bin, {}, { method: 'GET' });
        d = r.data;
      } catch (e) {
        $('#binOut').innerHTML = `<div class="alert bad">${esc(e.message)}</div>`;
        return;
      }
    }

    const c = d.country || {};
    const b = d.bank || {};
    const bandera = c.alpha2
      ? `<img class="flag" src="https://flagcdn.com/w40/${esc(c.alpha2.toLowerCase())}.png" alt="${esc(c.emoji || '')}" onerror="this.remove()"> ${esc(c.emoji || '')}`
      : (esc(c.emoji || '—'));

    $('#binOut').innerHTML = `
      <table class="mini">
        ${fila('BIN', esc(bin))}
        ${fila('Marca', esc(d.scheme))}
        ${fila('Red / nivel', esc(d.brand))}
        ${fila('Tipo', esc(d.type))}
        ${fila('Prepaga', d.prepaid === true ? 'Sí' : d.prepaid === false ? 'No' : '—')}
        ${fila('País', `${bandera} ${esc(c.name || '')}`)}
        ${fila('Código país', esc(c.alpha2))}
        ${fila('Numérico', esc(c.numeric))}
        ${fila('Moneda', esc(c.currency))}
        ${fila('Latitud', esc(c.latitude))}
        ${fila('Longitud', esc(c.longitude))}
        ${fila('Banco', esc(b.name))}
        ${fila('Web del banco', b.url ? `<a class="lnk-in" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.url)}</a>` : '—')}
        ${fila('Teléfono', esc(b.phone))}
        ${fila('Ciudad', esc(b.city))}
      </table>
      <h4 class="sec" style="margin-top:16px">Respuesta completa</h4>
      <pre class="log">${esc(JSON.stringify(d, null, 2))}</pre>`;
  }));

  $('#binBack').addEventListener('click', () => show(volverA));

  /* ---------- drawer ---------- */

  function openDrawer() {
    $('#drawer').hidden = false;
    $('#scrim').hidden = false;
    requestAnimationFrame(() => $('#drawer').classList.add('open'));
  }
  function closeDrawer() {
    $('#drawer').classList.remove('open');
    setTimeout(() => { $('#drawer').hidden = true; $('#scrim').hidden = true; }, 180);
  }

  $('#btnMenu').addEventListener('click', openDrawer);
  $('#dwClose').addEventListener('click', closeDrawer);
  $('#scrim').addEventListener('click', closeDrawer);
  $('#btnHome').addEventListener('click', () => { renderDashboard(); show(3); });
  $('#dwLogout').addEventListener('click', async () => {
    try { await api('/api/logout', {}); } catch {}
    logout();
  });

  document.querySelectorAll('.drawer-nav button').forEach(b => {
    b.addEventListener('click', () => {
      const destino = b.dataset.panel;
      document.querySelectorAll('.drawer-nav button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');

      if (destino === 'nftoken' || destino === 'bin') {
        volverA = document.querySelector('[data-screen="3"]').hidden ? 4 : 3;
        closeDrawer();
        show(destino === 'nftoken' ? 8 : 9);
        return;
      }
      panels[destino]();
    });
  });

  /* ---------- paneles del drawer ---------- */

  const panels = {
    async cookies() {
      const box = $('#dwPanel');
      box.innerHTML = '<div class="muted">Cargando…</div>';
      const filas = [];
      for (const p of platforms) {
        try {
          const r = await api('/api/cookies?platform=' + encodeURIComponent(p.id), {}, { method: 'GET' });
          filas.push(`<tr><td>${esc(p.name)}</td><td><span class="pill ok">${r.vivas}</span></td>
            <td><span class="pill bad">${r.muertas}</span></td></tr>`);
        } catch {}
      }
      const usadas = Object.entries(me?.usage || {}).filter(([p, v]) => v > 0 && platforms.some(x => x.id === p));
      box.innerHTML = `
        <h4>Pool de cookies</h4>
        ${filas.length ? `<table class="mini"><tr><th>Plataforma</th><th>Activas</th><th>Muertas</th></tr>${filas.join('')}</table>`
                       : '<div class="muted">Sin plataformas habilitadas</div>'}
        <h4>Tu consumo</h4>
        ${usadas.length
          ? `<table class="mini">${usadas.map(([p, v]) => `<tr><td>${esc(platformName(p))}</td><td>${v}</td></tr>`).join('')}</table>`
          : '<div class="muted">Sin consumos</div>'}`;
    },

    tokens() {
      const box = $('#dwPanel');
      const lista = JSON.parse(localStorage.getItem('dg_tokens') || '[]').slice(-25).reverse();
      box.innerHTML = `
        <h4>Tokens generados</h4>
        ${lista.length ? lista.map(t => `
          <div class="tk">
            <div class="tk-top"><b>${esc(t.platform)}</b><small>${new Date(t.ts).toLocaleString('es-AR')}</small></div>
            <code>${esc(t.url)}</code>
            <div class="row" style="margin-top:6px">
              <button class="btn btn-ghost sm" data-copy="${esc(t.url)}">Copiar</button>
              <button class="btn btn-ghost sm" data-open="${esc(t.url)}">Abrir</button>
            </div>
          </div>`).join('')
          : '<div class="muted">Todavía no generaste tokens</div>'}
        <button id="tkClear" class="btn btn-ghost wide" style="margin-top:12px">Vaciar historial</button>`;

      box.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(b.dataset.copy); toast('Copiado', false); } catch { toast('No se pudo copiar'); }
      }));
      box.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => go(b.dataset.open)));
      $('#tkClear').addEventListener('click', () => { localStorage.removeItem('dg_tokens'); panels.tokens(); });
    }
  };

  function registrarToken(platform, url) {
    const lista = JSON.parse(localStorage.getItem('dg_tokens') || '[]');
    lista.push({ platform, url, ts: Date.now() });
    localStorage.setItem('dg_tokens', JSON.stringify(lista.slice(-60)));
  }

  (async () => {
    if (!session) return show(1);
    try {
      await loadPlatforms();
      await loadMe();
      show(3);
    } catch {
      show(1);
    }
  })();
})();
