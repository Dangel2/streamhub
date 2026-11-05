/* ============================================================
   Configuración
   ============================================================ */
const API = 'https://plain-lab-68c3.tvs12202.workers.dev';

// Si alguna tarjeta dice "Ruta inexistente", corregí la ruta acá.
const EP = {
  login:   '/api/admin/login',
  stats:   '/api/admin/stats',
  logs:    '/api/admin/logs',
  cookies: '/api/admin/cookies',
  test:    '/api/admin/test'
};

const $ = s => document.querySelector(s);
const KEY = 'sh_admin_token';

const el = {
  pw: $('#pw'), go: $('#go'), out: $('#out'), loginBox: $('#loginBox'), panel: $('#panel'),
  loginMsg: $('#loginMsg'), checkMsg: $('#checkMsg'), statsMsg: $('#statsMsg'),
  ckMsg: $('#ckMsg'), tMsg: $('#tMsg'), logMsg: $('#logMsg')
};

/* ============================================================
   Helpers
   ============================================================ */
const token = () => sessionStorage.getItem(KEY) || '';
const auth = () => (token() ? { authorization: 'Bearer ' + token() } : {});

function msg(box, text) {
  box.textContent = text || '';
  box.classList.toggle('show', !!text);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function call(path, opts = {}) {
  const r = await fetch(API + path, {
    method: opts.method || 'GET',
    headers: { ...(opts.body ? { 'content-type': 'application/json' } : {}), ...auth() },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== EP.login) { logout(); throw new Error('Sesión vencida'); }
  if (!r.ok || j.ok === false) {
    const err = new Error(j.error || `HTTP ${r.status}`);
    err.path = path;
    err.status = r.status;
    throw err;
  }
  return j;
}

function fail(box, e) {
  const hint = e.status === 404 ? ` · ruta ${e.path} no existe, revisá EP` : '';
  msg(box, e.message + hint);
}

/* ============================================================
   Sesión
   ============================================================ */
async function login() {
  const pw = el.pw.value;
  if (!pw) return msg(el.loginMsg, 'Escribí la contraseña');
  el.go.disabled = true; el.go.textContent = 'Entrando…';
  msg(el.loginMsg, '');
  try {
    const r = await call(EP.login, { method: 'POST', body: { password: pw } });
    sessionStorage.setItem(KEY, r.token);
    el.pw.value = '';
    enter();
  } catch (e) {
    fail(el.loginMsg, e);
  } finally {
    el.go.disabled = false; el.go.textContent = 'Entrar';
  }
}

function enter() {
  el.loginBox.hidden = true;
  el.panel.hidden = false;
  el.out.hidden = false;
  runChecks();
  loadStats();
  loadPlatforms();
}

function logout() {
  sessionStorage.removeItem(KEY);
  el.panel.hidden = true;
  el.out.hidden = true;
  el.loginBox.hidden = false;
}

/* ============================================================
   Estado
   ============================================================ */
async function runChecks() {
  const host = $('#checks');
  try {
    const j = await fetch(API + '/api/selftest', { cache: 'no-store' }).then(r => r.json());
    const items = [
      ['base de datos', j.db],
      ['firma HMAC', j.hmac],
      ['contraseña admin', j.adminPassword],
      ['token del bot', j.botToken],
      ['chat admin', j.adminChatId]
    ];
    host.innerHTML = items
      .map(([n, ok]) => `<span class="chk${ok ? '' : ' bad'}">${ok ? '✓' : '✗'} ${esc(n)}</span>`)
      .join('');
    const origin = j.allowedOrigin || '';
    const want = location.origin;
    msg(el.checkMsg, origin !== want ? `allowedOrigin es "${origin}" y debería ser "${want}"` : '');
  } catch {
    host.innerHTML = '<span class="chk bad">✗ selftest inaccesible</span>';
  }
}

async function loadStats() {
  msg(el.statsMsg, '');
  try {
    const j = await call(EP.stats);
    $('#sCookies').textContent = j.cookies ?? 0;
    $('#sAct').textContent = j.activaciones ?? 0;
    $('#sOk').textContent = j.exitosas ?? 0;
    $('#sErr').textContent = j.fallidas ?? 0;
  } catch (e) {
    fail(el.statsMsg, e);
  }
}

async function loadPlatforms() {
  try {
    const { platforms } = await fetch('platforms.json', { cache: 'no-store' }).then(r => r.json());
    const opts = platforms.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    $('#plat').innerHTML = opts;
    $('#tplat').innerHTML = opts;
  } catch {
    msg(el.ckMsg, 'No se pudo leer platforms.json');
  }
}

/* ============================================================
   Cookies
   ============================================================ */
async function saveCookie() {
  const platform = $('#plat').value;
  const raw = $('#raw').value.trim();
  if (!platform || !raw) return msg(el.ckMsg, 'Elegí plataforma y pegá la cookie');
  $('#save').disabled = true;
  msg(el.ckMsg, '');
  try {
    const r = await call(EP.cookies, { method: 'POST', body: { platform, raw } });
    msg(el.ckMsg, '');
    el.ckMsg.classList.remove('show');
    $('#raw').value = '';
    listCookies();
    loadStats();
    if (r.file) alert('Guardada como ' + r.file);
  } catch (e) {
    fail(el.ckMsg, e);
  } finally {
    $('#save').disabled = false;
  }
}

async function listCookies() {
  const host = $('#ckList');
  msg(el.ckMsg, '');
  try {
    const j = await call(EP.cookies + '?platform=' + encodeURIComponent($('#plat').value));
    const rows = j.cookies || j.files || [];
    if (!rows.length) { host.innerHTML = '<div class="empty">Sin cookies para esta plataforma.</div>'; return; }
    host.innerHTML = `<table><thead><tr><th>Archivo</th><th>Cuenta</th><th>Alta</th><th></th></tr></thead><tbody>${
      rows.map(c => `<tr>
        <td>${esc(c.file || c.id)}</td>
        <td>${esc(c.label || c.email || '—')}</td>
        <td>${esc(c.createdAt || c.ts || '—')}</td>
        <td><button class="del" data-del="${esc(c.file || c.id)}">Borrar</button></td>
      </tr>`).join('')}</tbody></table>`;
  } catch (e) {
    fail(el.ckMsg, e);
  }
}

async function delCookie(file) {
  if (!confirm('¿Borrar ' + file + '?')) return;
  try {
    await call(EP.cookies + '?platform=' + encodeURIComponent($('#plat').value) + '&file=' + encodeURIComponent(file), { method: 'DELETE' });
    listCookies();
    loadStats();
  } catch (e) {
    fail(el.ckMsg, e);
  }
}

/* ============================================================
   Prueba
   ============================================================ */
async function testActivation() {
  const platform = $('#tplat').value;
  const code = $('#tcode').value.trim();
  if (!platform || !code) return msg(el.tMsg, 'Elegí plataforma y escribí el código');
  $('#test').disabled = true;
  msg(el.tMsg, '');
  $('#tLog').innerHTML = '';
  try {
    const r = await call(EP.test, { method: 'POST', body: { platform, code } });
    msg(el.tMsg, r.ok ? '' : (r.error || 'No se pudo activar'));
    $('#tLog').innerHTML = '<pre class="muted">' + esc((r.steps || []).join('\n')) + '</pre>';
    loadStats();
  } catch (e) {
    fail(el.tMsg, e);
  } finally {
    $('#test').disabled = false;
  }
}

/* ============================================================
   Registros
   ============================================================ */
async function loadLogs() {
  const host = $('#logs');
  msg(el.logMsg, '');
  try {
    const j = await call(EP.logs);
    const rows = j.logs || [];
    if (!rows.length) { host.innerHTML = '<div class="empty">Sin registros.</div>'; return; }
    host.innerHTML = `<table><thead><tr><th>Fecha</th><th>Telegram</th><th>Plataforma</th><th>Estado</th></tr></thead><tbody>${
      rows.map(l => {
        const cls = l.ok ? 'ok' : (l.pending ? 'wait' : 'err');
        return `<tr>
          <td>${esc(l.createdAt || l.ts || '')}</td>
          <td>${esc(l.tg || '')}</td>
          <td>${esc(l.platform || '')}</td>
          <td><span class="pill ${cls}">${l.ok ? 'OK' : (l.pending ? 'espera' : 'falló')}</span></td>
        </tr>`;
      }).join('')}</tbody></table>`;
  } catch (e) {
    fail(el.logMsg, e);
  }
}

/* ============================================================
   Eventos
   ============================================================ */
el.go.addEventListener('click', login);
el.pw.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
el.out.addEventListener('click', logout);
$('#reload').addEventListener('click', () => { runChecks(); loadStats(); });
$('#save').addEventListener('click', saveCookie);
$('#listBtn').addEventListener('click', listCookies);
$('#test').addEventListener('click', testActivation);
$('#logsBtn').addEventListener('click', loadLogs);
$('#ckList').addEventListener('click', e => {
  const b = e.target.closest('[data-del]');
  if (b) delCookie(b.dataset.del);
});
$('#plat').addEventListener('change', () => $('#ckList').innerHTML = '');

if (token()) enter();
