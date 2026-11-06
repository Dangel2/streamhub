(() => {
  const API_BASE = 'https://plain-lab-68c3.tvs12202.workers.dev';
  const TIMEOUT = 20000;
  const FALLBACK_PLATS = [
    { id: 'netflix', name: 'Netflix', short: 'N', codeLength: 8, color: '#E50914' },
    { id: 'disneyplus', name: 'Disney+', short: 'D+', codeLength: 8, color: '#113CCF' },
    { id: 'max', name: 'Max', short: 'M', codeLength: 6, color: '#002BE7' },
    { id: 'primevideo', name: 'Prime Video', short: 'P', codeLength: 6, color: '#00A8E8' },
    { id: 'paramount', name: 'Paramount+', short: 'P+', codeLength: 6, color: '#0064FF' },
    { id: 'crunchyroll', name: 'Crunchyroll', short: 'C', codeLength: 6, color: '#F47521' },
    { id: 'spotify', name: 'Spotify', short: 'S', codeLength: 6, color: '#1DB954' }
  ];

  const $ = s => document.querySelector(s);
  const toastEl = $('#toast');
  let session = sessionStorage.getItem('dg_session') || '';
  let otpToken = '';
  let tgId = '';
  let platforms = [];
  let selected = null;
  let countdownTimer = null;

  /* ---------- helpers ---------- */

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function api(path, body, opt = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opt.timeout || TIMEOUT);
    try {
      const headers = { 'content-type': 'application/json' };
      if (opt.auth !== false && session) headers.authorization = 'Bearer ' + session;
      const res = await fetch(API_BASE + path, {
        method: 'POST', headers, body: JSON.stringify(body || {}), signal: ctrl.signal
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Error del servidor');
      return data;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('El servidor tardó demasiado. Probá de nuevo.');
      if (e instanceof TypeError) throw new Error('Sin conexión con el servidor.');
      throw e;
    } finally { clearTimeout(t); }
  }

  async function withBtn(btn, label, fn) {
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = label;
    try { return await fn(); }
    finally { btn.textContent = old; btn.disabled = false; }
  }

  /* ---------- OTP boxes ---------- */

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
          inputs[i - 1].focus();
          inputs[i - 1].value = '';
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
    return {
      val,
      clear: () => { inputs.forEach(i => i.value = ''); inputs[0].focus(); }
    };
  }

  const otpLogin = wireOtp($('#otpLogin'), v => {
    $('#btnLogin').disabled = v.length !== 6;
  });

  /* ---------- PASO 1: enviar OTP ---------- */

  const btnSend = $('#btnSend');
  const tgInput = $('#tgId');

  tgInput.addEventListener('input', () => {
    tgInput.value = tgInput.value.replace(/\D/g, '').slice(0, 12);
  });

  btnSend.addEventListener('click', () => {
    const id = tgInput.value.trim();
    if (!/^\d{5,12}$/.test(id)) return toast('Ingresá un ID de Telegram válido');
    withBtn(btnSend, '…', async () => {
      try {
        const r = await api('/api/otp', { tg: id }, { auth: false });
        otpToken = r.token;
        tgId = id;
        $('#tgIdShow').value = id;
        otpLogin.clear();
        $('#btnLogin').disabled = true;
        show(2);
        toast('Código enviado a tu Telegram', false);
      } catch (e) { toast(e.message); }
    });
  });

  tgInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnSend.click(); });

  /* ---------- PASO 2: verificar ---------- */

  $('#btnLogin').addEventListener('click', async () => {
    const code = otpLogin.val();
    if (code.length !== 6) return toast('El código tiene 6 dígitos');
    try {
      const r = await api('/api/verify', { token: otpToken, code }, { auth: false });
      session = r.session;
      sessionStorage.setItem('dg_session', session);
      otpLogin.clear();
      renderPlatforms();
      show(3);
    } catch (e) {
      toast(e.message);
      otpLogin.clear();
      $('#btnLogin').disabled = true;
    }
  });

  $('#btnResend').addEventListener('click', () => {
    if (!tgId) return show(1);
    withBtn($('#btnResend'), 'Enviando…', async () => {
      try {
        const r = await api('/api/otp', { tg: tgId }, { auth: false });
        otpToken = r.token;
        otpLogin.clear();
        $('#btnLogin').disabled = true;
        toast('Código reenviado', false);
      } catch (e) { toast(e.message); }
    });
  });

  /* ---------- PASO 3: plataformas ---------- */

  async function renderPlatforms() {
    const box = $('#plats');
    if (!platforms.length) {
      try {
        const res = await fetch('platforms.json', { cache: 'no-store' });
        const d = await res.json();
        platforms = Array.isArray(d.platforms) && d.platforms.length ? d.platforms : FALLBACK_PLATS;
      } catch { platforms = FALLBACK_PLATS; }
    }
    box.innerHTML = '';
    platforms.forEach(p => {
      const el = document.createElement('div');
      el.className = 'plat';
      el.dataset.id = p.id;
      el.innerHTML = `<div class="ic" style="background:${p.color}">${p.short}</div>
        <div><b></b><small>Disponible</small></div><div class="radio"></div>`;
      el.querySelector('b').textContent = p.name;
      el.addEventListener('click', () => {
        box.querySelectorAll('.plat').forEach(x => x.classList.remove('sel'));
        el.classList.add('sel');
        selected = p;
        $('#btnPlat').disabled = false;
      });
      box.appendChild(el);
    });
  }

  $('#btnPlat').addEventListener('click', () => {
    if (!selected) return;
    const tv = $('#tvCode');
    tv.value = '';
    tv.maxLength = selected.codeLength || 8;
    tv.placeholder = `Código de ${selected.codeLength || 8} caracteres`;
    $('#btnActivate').disabled = true;
    show(4);
    tv.focus();
  });

  /* ---------- PASO 4: activar ---------- */

  const tvInput = $('#tvCode');

  tvInput.addEventListener('input', () => {
    tvInput.value = tvInput.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const need = selected?.codeLength || 8;
    $('#btnActivate').disabled = tvInput.value.length < Math.min(4, need);
  });

  tvInput.addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnActivate').click(); });

  function getBlk() {
    try { return JSON.parse(localStorage.getItem('dg_blk') || '{}'); } catch { return {}; }
  }
  function addBlk(platform, file) {
    const b = getBlk();
    (b[platform] ||= []).includes(file) || b[platform].push(file);
    localStorage.setItem('dg_blk', JSON.stringify(b));
  }

  async function localCookie(platform) {
    const blk = new Set(getBlk()[platform] || []);
    for (let i = 1; i <= 8; i++) {
      const file = `file${i}.json`;
      if (blk.has(file)) continue;
      try {
        const r = await fetch(`cookies/${platform}/${file}`, { cache: 'no-store' });
        if (!r.ok) continue;
        const txt = await r.text();
        if (!txt.trim().startsWith('[')) continue;
        return { file, cookie: toCookie(txt) };
      } catch {}
    }
    throw new Error('No hay cookies disponibles');
  }

  function toCookie(raw) {
    const t = String(raw || '').trim();
    if (t.startsWith('[')) {
      try { return JSON.parse(t).map(c => `${c.name}=${c.value}`).join('; '); } catch {}
    }
    return t;
  }

  async function pickCookie(platform) {
    try {
      const r = await api('/api/get-cookie', { platform });
      if (r.cookie) return { file: r.filename, cookie: r.cookie };
    } catch (e) { console.warn('worker get-cookie:', e.message); }
    return localCookie(platform);
  }

  $('#btnActivate').addEventListener('click', async () => {
    const code = tvInput.value.trim();
    if (!selected || code.length < 4) return toast('Código incompleto');

    const btn = $('#btnActivate');
    await withBtn(btn, 'Activando…', async () => {
      let picked;
      try { picked = await pickCookie(selected.id); }
      catch (e) { return toast(e.message); }

      try {
        const r = await api('/api/activate', { platform: selected.id, cookie: picked.cookie, code, file: picked.file }, { timeout: 45000 });
        if (r.ok) {
          $('#resIcon').textContent = '✅';
          $('#resTitle').textContent = 'Listo';
          $('#resSub').textContent = 'Cuenta activada correctamente';
        } else {
          $('#resIcon').textContent = '⚠️';
          $('#resTitle').textContent = 'No se pudo activar';
          $('#resSub').textContent = r.error || 'Probá de nuevo';
          addBlk(selected.id, picked.file);
        }
        $('#resLog').textContent = (r.steps || []).join('\n') || r.error || '';
        show(5);
        startCountdown(r.ok ? 8 : 12);
      } catch (e) {
        toast(e.message);
        addBlk(selected.id, picked.file);
      }
    });
  });

  function startCountdown(sec) {
    clearInterval(countdownTimer);
    const el = $('#countdown');
    let n = sec;
    el.textContent = n;
    countdownTimer = setInterval(() => {
      n--;
      el.textContent = n;
      if (n <= 0) { clearInterval(countdownTimer); show(3); }
    }, 1000);
  }

  $('#btnAgain').addEventListener('click', () => {
    clearInterval(countdownTimer);
    tvInput.value = '';
    show(3);
  });

  /* ---------- arranque ---------- */

  if (session) { renderPlatforms(); show(3); }
  else show(1);
})();
