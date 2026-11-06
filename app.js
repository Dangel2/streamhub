const CONFIG = {
API: 'https://plain-lab-68c3.tvs12202.workers.dev',
PLATFORMS: 'platforms.json',
RESET_SECS: 8
};
​const S = { tg: null, session: null, platform: null, codeLen: 6, otpToken: null, busy: false, timer: null };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];  function show(n) { clearInterval(S.timer); $$('.screen').forEach(s => s.hidden = s.dataset.screen !== String(n));
window.scrollTo({ top: 0 });
}
​function toast(msg, err) {
const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, 4500); }  function api(path, body, auth) { return fetch(CONFIG.API + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(body \vert{}\vert{} {}) }).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok \vert{}\vert{} j.ok === false) throw new Error(j.error \vert{}\vert{} ('HTTP ' + r.status)); return j; }); }  function buildOtp(host, len, onChange) { host.innerHTML = ''; for (let i = 0; i < len; i++) { const el = document.createElement('input'); el.inputMode = 'numeric'; el.autocomplete = 'one-time-code'; el.maxLength = 1; el.addEventListener('input', () => { el.value = el.value.replace(/\D/g, ''); if (el.value && el.nextElementSibling) el.nextElementSibling.focus(); onChange?.(readOtp(host)); }); el.addEventListener('keydown', e => { if (e.key === 'Backspace' && !el.value && el.previousElementSibling) el.previousElementSibling.focus(); }); el.addEventListener('paste', e => { e.preventDefault(); const d = (e.clipboardData.getData('text') \vert{}\vert{} '').replace(/\W/g, '').split(''); $$('input', host).forEach((x, k) => { if (d[k]) x.value = d[k]; });
onChange?.(readOtp(host));
$$('input', host)[Math.min(d.length, len - 1)]?.focus(); }); host.appendChild(el); } } const readOtp = host => $$
('input', host).map(i => i.value).join('');
​// PASO 1
$('#tgId').addEventListener('input', e => {
e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);
$('#btnVerify').disabled = e.target.value.length < 5;
});
$('#btnVerify').addEventListener('click', () => $('#btnSend').click());
​$('#btnSend').addEventListener('click', async () => {
const tg = $('#tgId').value.trim();
if (tg.length < 5) return toast('ID inválido', true);
const b = $('#btnSend'); b.disabled = true; b.textContent = 'Enviando…';
try {
const r = await api('/api/otp', { tg });
S.tg = tg; S.otpToken = r.token;
('#tgIdShow').value = tg;
buildOtp(('#otpLogin'), 6, v => $('#btnLogin').disabled = v.length !== 6); show(2); $$('#otpLogin input')[0]?.focus();
toast(r.demo ? 'Código enviado · DEMO: ' + r.demo : 'Código enviado por Telegram');
} catch (e) { toast(e.message, true); }
finally { b.disabled = false; b.textContent = 'Enviar código'; }
});
​// PASO 2
('#btnLogin').addEventListener('click', async () => {
const code = readOtp(('#otpLogin'));
if (code.length !== 6) return toast('Código incompleto', true);
try {
const r = await api('/api/verify', { token: S.otpToken, code });
S.session = r.session;
await loadPlatforms();
show(3);
} catch (e) { toast(e.message, true); }
});
​// PASO 3
async function loadPlatforms() {
const host = $('#plats'); if (host.dataset.loaded) return; const { platforms } = await fetch(CONFIG.PLATFORMS, { cache: 'no-store' }).then(r => r.json()); host.innerHTML = ''; platforms.forEach(p => { const el = document.createElement('div'); el.className = 'plat'; el.innerHTML = <div class="ic" style="background:${p.color}">${p.short}</div> <div><b>${p.name}</b><small>Activar por código</small></div><div class="radio"></div>; el.addEventListener('click', () => { $$('.plat', host).forEach(x => x.classList.remove('sel'));
el.classList.add('sel');
S.platform = p; S.codeLen = p.codeLength || 6;
$('#btnPlat').disabled = false;
});
host.appendChild(el);
});
host.dataset.loaded = '1';
}
('#btnPlat').addEventListener('click', () => {
if (!S.platform) return;
buildOtp(('#otpTv'), S.codeLen, v => $('#btnActivate').disabled = v.length !== S.codeLen); show(4); $$('#otpTv input')[0]?.focus();
});
​// PASO 4
('#btnActivate').addEventListener('click', async () => {
if (S.busy || !S.platform) return;
const code = readOtp(('#otpTv'));
if (code.length !== S.codeLen) return toast('Código incompleto', true);
S.busy = true;
const btn = $('#btnActivate'); btn.disabled = true; btn.textContent = 'ACTIVANDO…';
try {
const r = await api('/api/activate', { platform: S.platform.id, code }, S.session);
if (r.ok) {
$('#resIcon').textContent = '✅';
$('#resTitle').textContent = '¡Activado!';
$('#resSub').textContent = S.platform.name + ' ya tiene sesión en tu TV';
} else {
$('#resIcon').textContent = '⚠️';
$('#resTitle').textContent = 'No se pudo activar';
$('#resSub').textContent = r.error || 'Probá otra vez';
}
$('#resLog').textContent = (r.steps || []).join('\n') || 'Proceso finalizado.';
show(5);
let n = CONFIG.RESET_SECS;
$('#countdown').textContent = n;
S.timer = setInterval(() => {
n--; $('#countdown').textContent = n;
if (n <= 0) resetApp();
}, 1000);
} catch (e) { toast(e.message, true); }
finally { S.busy = false; btn.disabled = false; btn.textContent = 'ACTIVAR'; }
});
​function resetApp() {
clearInterval(S.timer);
S.platform = null; S.session = null; S.tg = null; S.otpToken = null;
$('#tgId').value = ''; $('#otpLogin').innerHTML = ''; $('#otpTv').innerHTML = '';
$('#btnVerify').disabled = true; $('#btnPlat').disabled = true; $('#btnActivate').disabled = true;
$('#plats').dataset.loaded = '';
show(1);
}
​$('#btnAgain').addEventListener('click', resetApp);
$('#toast').hidden = true;
show(1);
