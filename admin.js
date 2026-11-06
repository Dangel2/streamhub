document.addEventListener("DOMContentLoaded", () => {
const API_BASE = 'https://plain-lab-68c3.tvs12202.workers.dev';
let adminToken = sessionStorage.getItem('sh_admin_token') || '';
​const loginBox = document.getElementById('loginBox');
const panel = document.getElementById('panel');
const pwInput = document.getElementById('pw');
const goBtn = document.getElementById('go');
const loginMsg = document.getElementById('loginMsg');
const outBtn = document.getElementById('out');
​function setAuthenticated(isAuth) {
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
​if (adminToken) setAuthenticated(true);
​async function apiAdmin(endpoint, body = {}, method = 'POST') {
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
throw new Error(data.error || 'Error de autorización');
}
return data;
}
​function showMsg(el, text, isErr = false) {
el.textContent = text;
el.className = 'msg show';
if (!isErr) {
el.style.background = '#142a1d';
el.style.color = '#22c55e';
} else {
el.style.background = '#361013';
el.style.color = '#ef4444';
}
setTimeout(() => el.classList.remove('show'), 5000);
}
​// --- LOGIN CORRECTO ---
goBtn.addEventListener('click', async () => {
const password = pwInput.value.trim();
if (!password) return showMsg(loginMsg, 'Ingresá la contraseña', true);
goBtn.disabled = true;
goBtn.textContent = 'Verificando...';
try {
const res = await fetch(API_BASE + '/api/admin/login', {
method: 'POST',
headers: { 'content-type': 'application/json' },
body: JSON.stringify({ password })
});
const data = await res.json();
if (!res.ok || !data.ok) {
throw new Error(data.error || 'Contraseña incorrecta');
}
​showMsg(loginMsg, '¡Contraseña correcta! Accediendo...', false);
adminToken = data.token;
sessionStorage.setItem('sh_admin_token', adminToken);
​setTimeout(() => {
setAuthenticated(true);
pwInput.value = '';
}, 500);
​} catch (e) {
showMsg(loginMsg, e.message || 'Contraseña incorrecta o sin permisos', true);
adminToken = '';
} finally {
goBtn.disabled = false;
goBtn.textContent = 'Entrar';
}
});
​outBtn.addEventListener('click', () => setAuthenticated(false));
​async function loadSystemStats() {
try {
const data = await apiAdmin('/api/admin/stats', {}, 'POST');
document.getElementById('sCookies').textContent = data.users?.length ?? 0;
document.getElementById('sAct').textContent = data.actHoy ?? 0;
document.getElementById('sOk').textContent = data.total ?? 0;
document.getElementById('sErr').textContent = data.nuevosHoy ?? 0;
} catch (e) {
document.getElementById('statsMsg').textContent = 'Error al cargar métricas: ' + e.message;
}
}
​document.getElementById('reload').addEventListener('click', loadSystemStats);
​async function loadPlatformsDropdown() {
try {
const res = await fetch('platforms.json');
const data = await res.json();
const selects = [document.getElementById('plat'), document.getElementById('tplat')];
​selects.forEach(sel => {
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
​document.getElementById('save').addEventListener('click', async () => {
const platform = document.getElementById('plat').value;
const cookieData = document.getElementById('raw').value.trim();
const ckMsg = document.getElementById('ckMsg');
​if (!cookieData) return showMsg(ckMsg, 'El contenido de la cookie está vacío', true);
​try {
await apiAdmin('/api/admin/save-cookie', { platform, cookieData });
showMsg(ckMsg, '¡Cookie guardada exitosamente en Cloudflare KV!', false);
document.getElementById('raw').value = '';
loadSystemStats();
} catch (e) {
showMsg(ckMsg, e.message, true);
}
});
​document.getElementById('test').addEventListener('click', async () => {
const platform = document.getElementById('tplat').value;
const code = document.getElementById('tcode').value.trim();
const tMsg = document.getElementById('tMsg');
const tLog = document.getElementById('tLog');
​if (!code) return showMsg(tMsg, 'Ingresá el código de la TV para probar', true);
​try {
tMsg.textContent = 'Probando activación...';
tMsg.className = 'msg show';
​const cookiesRes = await apiAdmin('/api/admin/get-cookies?platform=' + platform, {}, 'GET').catch(() => ({ cookies: [] }));
const sampleCookie = cookiesRes.cookies?.[0]?.content || '{}';
​const r = await apiAdmin('/api/admin/test', { platform, cookie: sampleCookie, code });
tLog.innerHTML = <pre class="log">${JSON.stringify(r, null, 2)}</pre>;
showMsg(tMsg, r.ok ? '¡Prueba exitosa!' : 'Falló la prueba, revisá los logs.', !r.ok);
} catch (e) {
showMsg(tMsg, e.message, true);
}
});
});
