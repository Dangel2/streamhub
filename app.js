(() => {
  const API_BASE = 'https://plain-lab-68c3.tvs12202.workers.dev';
  const TIMEOUT = 25000;
  const FALLBACK_AVATAR = 'logo.png';
  const FALLBACK_LOGO = 'logo.png';

  const $ = s => document.querySelector(s);

  function on(sel, ev, fn, opt) {
    const el = document.querySelector(sel);
    if (el) el.addEventListener(ev, fn, opt);
    return el;
  }

  const LOGO_ALIAS = {
    nf: 'netflix', hbo: 'max', hbomax: 'max', hbomaxbr: 'max',
    disney: 'disneyplus', disneypluspremium: 'disneyplus',
    paramountplus: 'paramount', paramountplusessential: 'paramount',
    crunchy: 'crunchyroll', prime: 'primevideo', amazon: 'primevideo', appletv: 'primevideo'
  };

  const FALLBACK_ACT = {
    netflix: 'https://www.netflix.com/tv2',
    disneyplus: 'https://www.disneyplus.com/begin',
    max: 'https://auth.max.com/',
    primevideo: 'https://www.primevideo.com/activate',
    paramount: 'https://www.paramountplus.com/activate/',
    crunchyroll: 'https://www.crunchyroll.com/activate',
    spotify: 'https://www.spotify.com/pair'
  };

  function slug(p) {
    return String(p.id || p.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  }

  function logoCandidatos(p) {
    const k = slug(p);
    const lista = [];
    if (p.logo) lista.push(p.logo);
    if (k) lista.push(k + '.png');
    const alias = LOGO_ALIAS[k];
    if (alias && alias !== k) lista.push(alias + '.png');
    lista.push(FALLBACK_LOGO);
    return [...new Set(lista)];
  }

  function logoImg(p, cls) {
    const img = document.createElement('img');
    if (cls) img.className = cls;
    img.alt = '';
    img.decoding = 'async';
    const lista = logoCandidatos(p);
    let i = 0;
    img.src = lista[0];
    img.addEventListener('error', () => {
      i += 1;
      if (i < lista.length) img.src = lista[i];
      else img.remove();
    });
    return img;
  }

  function pintarLogo(cont, p) {
    if (!cont) return;
    cont.innerHTML = '';
    const fb = document.createElement('span');
    fb.className = 'fb';
    fb.textContent = p.short || (p.name || '?').slice(0, 2).toUpperCase();
    cont.appendChild(fb);
    cont.appendChild(logoImg(p));
  }

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
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className = 'toast' + (isErr ? ' err' : '');
    toastEl.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toastEl.hidden = true; }, 4200);
  }

  function show(n) {
    const target = document.querySelector('.screen[data-screen="' + n + '"]');
    if (!target) { toast('Pantalla ' + n + ' no disponible'); return; }
    document.querySelectorAll('.screen').forEach(s => { s.hidden = s !== target; });
    const tb = $('#topbar');
    if (tb) tb.hidden = ![3, 4, 5, 8, 9, 10].includes(Number(n));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function pantallaActual() {
    const v = [...document.querySelectorAll('.screen')].find(s => !s.hidden);
    return v ? Number(v.dataset.screen) : 0;
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
        err.status = res.status;
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
    if (!btn) return fn();
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
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- OTP ---------- */

  function wireOtp(container, onChange) {
    if (!container) return { val: () => '', clear: () => {} };
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
    return { val, clear: () => { inputs.forEach(i => i.value = ''); inputs[0] && inputs[0].focus(); } };
  }

  const otpLogin = wireOtp($('#otpLogin'), v => {
    const b = $('#btnLogin');
    if (b) b.disabled = v.length !== 6;
  });

  on('#tgId', 'input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);
  });

  on('#btnSend', 'click', () => {
    const id = ($('#tgId')?.value || '').trim();
    if (!/^\d{5,12}$/.test(id)) return toast('Ingresá un ID de Telegram válido');
    withBtn($('#btnSend'), '…', async () => {
      try {
        const r = await api('/api/otp', { tg: id }, { auth: false });
        otpToken = r.token; tgId = id;
        if ($('#tgIdShow')) $('#tgIdShow').value = id;
        otpLogin.clear();
        if ($('#btnLogin')) $('#btnLogin').disabled = true;
        show(2);
        toast('Código enviado a tu Telegram', false);
      } catch (e) { toast(e.message); }
    });
  });

  on('#btnResend', 'click', () => {
    if (!tgId) return show(1);
    withBtn($('#btnResend'), 'Enviando…', async () => {
      try {
        const r = await api('/api/otp', { tg: tgId }, { auth: false });
        otpToken = r.token; otpLogin.clear();
        if ($('#btnLogin')) $('#btnLogin').disabled = true;
        toast('Código reenviado', false);
      } catch (e) { toast(e.message); }
    });
  });

  on('#btnLogin', 'click', async () => {
    const code = otpLogin.val();
    if (code.length !== 6) return toast('El código tiene 6 dígitos');
    try {
      const r = await api('/api/verify', { token: otpToken, code }, { auth: false });
      session = r.session;
      localStorage.setItem('dg_session', session);
      otpLogin.clear();
      me = r.user;
      await cargarPlataformas();
      renderDashboard();
      show(3);
    } catch (e) {
      toast(e.message);
      otpLogin.clear();
      if ($('#btnLogin')) $('#btnLogin').disabled = true;
    }
  });

  /* ---------- avatar ---------- */

  function setAvatar(url) {
    const av = $('#meAvatar');
    if (!av) return;
    av.innerHTML = '';
    const img = document.createElement('img');
    img.className = 'avatar-img';
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'lazy';
    img.src = url || FALLBACK_AVATAR;
    img.addEventListener('error', () => {
      if (!img.src.endsWith(FALLBACK_AVATAR)) img.src = FALLBACK_AVATAR;
    }, { once: true });
    av.appendChild(img);
  }

  /* ---------- dashboard ---------- */

  async function loadMe() {
    const r = await api('/api/me', {}, { method: 'GET' });
    me = r.user;
    renderDashboard();
  }

  function renderDashboard() {
    if (!me) return;
    const nombre = me.first_name || me.username || 'Usuario';

    setAvatar(me.photo_url);

    if ($('#meName')) $('#meName').textContent = nombre;
    if ($('#meUser')) $('#meUser').textContent = me.username ? '@' + me.username : 'ID ' + me.tg;
    if ($('#dwName')) $('#dwName').textContent = nombre;
    if ($('#dwStatus')) $('#dwStatus').textContent = me.status === 'active' ? '🟢 Activo' : '🔴 Sin permiso';

    const st = $('#meStatus');
    if (st) {
      st.className = 'pill ' + (me.status === 'active' ? 'ok' : 'bad');
      st.textContent = me.status === 'active' ? '🟢 Activo' : '🔴 Inactivo';
    }

    const alerta = $('#meAlert');
    if (alerta) {
      if (me.status === 'active') alerta.hidden = true;
      else {
        alerta.hidden = false;
        alerta.textContent = '⏳ Tu cuenta espera aprobación del administrador. Hasta entonces no podés usar las plataformas.';
      }
    }

    const entradas = Object.entries(me.usage || {})
      .filter(([p, v]) => v > 0 && platforms.some(x => x.id === p));

    if ($('#meUsage')) {
      $('#meUsage').innerHTML = entradas.length
        ? entradas.map(([p, v]) => `<div class="usage-item"><b>${esc(platformName(p))}</b><span>${v}</span></div>`).join('')
        : '<div class="muted">Sin consumos registrados</div>';
    }
  }

  function platformName(id) {
    const p = platforms.find(x => x.id === id);
    return p ? p.name : id;
  }

  on('#btnRefresh', 'click', () => withBtn($('#btnRefresh'), '…', async () => {
    try { await cargarPlataformas(); await loadMe(); toast('Datos actualizados', false); }
    catch (e) { toast(e.message); }
  }));

  on('#btnGoPlats', 'click', async () => {
    if (!me) return;
    if (me.status !== 'active') return toast('Tu cuenta espera aprobación del administrador');
    await renderPlatforms();
    show(4);
  });

  /* ---------- plataformas ---------- */

  function parsearPlataformas(texto) {
    const t = String(texto || '').trim();
    if (!t) return [];
    try {
      const d = JSON.parse(t);
      return Array.isArray(d) ? d : (Array.isArray(d.platforms) ? d.platforms : []);
    } catch {}
    try {
      const fn = new Function(t + '; return typeof PLATFORMS !== "undefined" ? PLATFORMS : null;');
      const d = fn();
      return Array.isArray(d) ? d : [];
    } catch {}
    return [];
  }

  async function cargarPlataformas() {
    try {
      const r = await api('/api/platforms', {}, { method: 'GET' });
      if (Array.isArray(r.platforms) && r.platforms.length) {
        platforms = r.platforms;
        return;
      }
    } catch {}

    try {
      const res = await fetch('platforms.json', { cache: 'no-store' });
      platforms = parsearPlataformas(await res.text());
    } catch { platforms = []; }
  }

  async function renderPlatforms() {
    const box = $('#plats');
    if (!box) return;
    box.innerHTML = '<span class="muted">Cargando…</span>';
    await cargarPlataformas();

    if (!platforms.length) {
      box.innerHTML = '<div class="muted">El administrador no tiene plataformas habilitadas.</div>';
      return;
    }

    box.innerHTML = '';
    platforms.forEach(p => {
      const el = document.createElement('div');
      el.className = 'plat';

      const ic = document.createElement('div');
      ic.className = 'ic';
      ic.style.background = p.color || '#7c3aed';
      pintarLogo(ic, p);

      const txt = document.createElement('div');
      txt.className = 'txt';
      const b = document.createElement('b');
      b.textContent = p.name;
      const small = document.createElement('small');
      small.textContent = '⚡ Acceso directo';
      txt.append(b, small);

      const radio = document.createElement('div');
      radio.className = 'radio';
      radio.textContent = '›';

      el.append(ic, txt, radio);
      el.addEventListener('click', () => {
        if (me && me.status !== 'active') return toast('Tu cuenta espera aprobación del administrador');
        directAccess(p);
      });
      box.appendChild(el);
    });
  }

  /* ---------- acceso directo ---------- */

  function go(url) {
    if (!url) return toast('No hay enlace de activación');
    const bridge = window.AndroidBridge || window.webkit?.messageHandlers?.dgflix;
    if (bridge && typeof bridge.openUrl === 'function') bridge.openUrl(url);
    else if (bridge && typeof bridge.postMessage === 'function') bridge.postMessage(JSON.stringify({ action: 'open', url }));
    else window.location.href = url;
  }

  function normalizar(r) {
    return {
      url: r.url_tv || r.urlTv || r.tv || r.activation_url || r.link || r.url || '',
      caduca: r.caduca || r.expira || r.expires || r.expiry || '',
      file: r.file || r.archivo || r.session_file || ''
    };
  }

  async function directAccess(p) {
    selected = p;
    lastUrl = '';

    pintarLogo($('#directLogo'), p);
    if ($('#directTitle')) $('#directTitle').textContent = 'Abriendo ' + p.name;
    if ($('#directSub')) $('#directSub').textContent = 'Activación oficial por TV';

    const box = $('#directBox');
    if (box) {
      box.className = 'muted';
      box.textContent = 'Tomando una cookie del pool y generando sesión…';
    }
    show(5);

    try {
      const r = await api('/api/nftoken', {
        platform: p.id,
        id: p.id,
        slug: slug(p),
        name: p.name
      });

      const d = normalizar(r);
      lastUrl = d.url || FALLBACK_ACT[slug(p)] || '';

      if (!lastUrl) throw new Error('El administrador no configuró la URL de activación de esta plataforma');

      pintarResultado(p, d, !d.url);
      registrarToken(p.id, lastUrl);
      loadMe().catch(() => {});

      setTimeout(() => { if (lastUrl) go(lastUrl); }, 1100);
    } catch (e) {
      if (box) {
        box.className = '';
        box.innerHTML = `<div class="alert bad">⚠️ ${esc(e.message)}</div>`;
      }
      if (e.code === 'INACTIVE') setTimeout(() => { renderDashboard(); show(3); }, 1800);
    }
  }

  function pintarResultado(p, d, esRespaldo) {
    const card = $('#resCard');
    if (card) card.style.setProperty('--accent', p.color || '#22c55e');

    pintarLogo($('#resLogo'), p);

    if ($('#resPlat')) $('#resPlat').textContent = p.name;
    if ($('#resEstado')) $('#resEstado').textContent = '✅ Sesión iniciada correctamente';
    if ($('#resCaduca')) $('#resCaduca').textContent = d.caduca || 'Sin fecha de caducidad';
    if ($('#resFile')) $('#resFile').textContent = d.file || 'archivo de sesión';
    if ($('#resDestino')) {
      $('#resDestino').textContent = esRespaldo
        ? 'Te llevamos a la página oficial de activación.'
        : 'Te estamos llevando a la activación oficial…';
    }

    show(10);
  }

  on('#btnDirectBack', 'click', () => { renderDashboard(); show(3); });
  on('#btnResOpen', 'click', () => go(lastUrl));
  on('#btnResCopy', 'click', async () => {
    if (!lastUrl) return;
    try { await navigator.clipboard.writeText(lastUrl); toast('Enlace copiado', false); }
    catch { toast('No se pudo copiar'); }
  });
  on('#btnResRetry', 'click', () => { if (selected) directAccess(selected); });
  on('#btnResBack', 'click', () => { renderDashboard(); show(3); });

  /* ---------- NFtoken manual ---------- */

  on('#nfGo', 'click', () => withBtn($('#nfGo'), 'Generando…', async () => {
    const raw = ($('#nfRaw')?.value || '').trim();
    if (!raw) return toast('Pegá una cookie');
    try {
      const r = await api('/api/nftoken', { cookie: raw });
      const d = normalizar(r);
      if ($('#nfOut')) {
        $('#nfOut').innerHTML = `
          <div class="alert ok">Caduca: ${esc(d.caduca || '—')}</div>
          ${d.url ? `<a class="lnk" href="${esc(d.url)}" target="_blank" rel="noopener">📺 Activación TV</a>` : ''}
          ${r.url_web ? `<a class="lnk" href="${esc(r.url_web)}" target="_blank" rel="noopener">🌐 Web</a>` : ''}
          ${r.url_app ? `<a class="lnk" href="${esc(r.url_app)}" target="_blank" rel="noopener">📱 Móvil</a>` : ''}`;
      }
      if (d.url) registrarToken('manual', d.url);
    } catch (e) {
      if ($('#nfOut')) $('#nfOut').innerHTML = `<div class="alert bad">${esc(e.message)}</div>`;
    }
  }));

  on('#nfBack', 'click', () => show(volverA));

  /* ---------- BIN ---------- */

  on('#binIn', 'input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
  });

  function fila(etiqueta, valor) {
    return `<tr><th>${esc(etiqueta)}</th><td>${valor || '—'}</td></tr>`;
  }

  on('#binGo', 'click', () => withBtn($('#binGo'), '…', async () => {
    const bin = ($('#binIn')?.value || '').trim();
    if (bin.length < 6) return toast('El BIN necesita al menos 6 dígitos');

    if ($('#binOut')) $('#binOut').innerHTML = '<div class="muted">Consultando…</div>';

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
        if ($('#binOut')) $('#binOut').innerHTML = `<div class="alert bad">${esc(e.message)}</div>`;
        return;
      }
    }

    const c = d.country || {};
    const b = d.bank || {};
    const bandera = c.alpha2
      ? `<img class="flag" src="https://flagcdn.com/w40/${esc(String(c.alpha2).toLowerCase())}.png" alt="" onerror="this.remove()"> ${esc(c.emoji || '')}`
      : (esc(c.emoji || '—'));

    if ($('#binOut')) {
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
    }
  }));

  on('#binBack', 'click', () => show(volverA));

  /* ---------- drawer ---------- */

  function openDrawer() {
    const dr = $('#drawer'), sc = $('#scrim');
    if (!dr) return;
    dr.hidden = false;
    if (sc) sc.hidden = false;
    requestAnimationFrame(() => dr.classList.add('open'));
  }
  function closeDrawer() {
    const dr = $('#drawer'), sc = $('#scrim');
    if (!dr) return;
    dr.classList.remove('open');
    setTimeout(() => { dr.hidden = true; if (sc) sc.hidden = true; }, 180);
  }

  on('#btnMenu', 'click', openDrawer);
  on('#dwClose', 'click', closeDrawer);
  on('#scrim', 'click', closeDrawer);
  on('#btnHome', 'click', () => { renderDashboard(); show(3); });
  on('#dwLogout', 'click', async () => {
    try { await api('/api/logout', {}); } catch {}
    logout();
  });

  document.querySelectorAll('.drawer-nav button').forEach(b => {
    b.addEventListener('click', () => {
      const destino = b.dataset.panel;
      if (!destino) return;

      document.querySelectorAll('.drawer-nav button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');

      const actual = pantallaActual();
      volverA = (actual === 3 || actual === 4) ? actual : 3;

      closeDrawer();

      if (destino === 'nftoken') return show(8);
      if (destino === 'bin') return show(9);

      const panel = panels[destino];
      if (typeof panel === 'function') panel();
      else toast('Panel no disponible');
    });
  });

  /* ---------- paneles del drawer ---------- */

  const panels = {
    async cookies() {
      const box = $('#dwPanel');
      if (!box) return;
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
      if (!box) return;
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
      const cl = $('#tkClear');
      if (cl) cl.addEventListener('click', () => { localStorage.removeItem('dg_tokens'); panels.tokens(); });
    }
  };

  function registrarToken(platform, url) {
    try {
      const lista = JSON.parse(localStorage.getItem('dg_tokens') || '[]');
      lista.push({ platform, url, ts: Date.now() });
      localStorage.setItem('dg_tokens', JSON.stringify(lista.slice(-60)));
    } catch {}
  }

  (async () => {
    if (!session) return show(1);
    try {
      await cargarPlataformas();
      await loadMe();
      show(3);
    } catch {
      show(1);
    }
  })();
})();
