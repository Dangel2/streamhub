/* cookies mejoradas con respaldo en Cloudflare Worker */
async function pickCookie(platform) {
  try {
    // Consultamos directo al Worker para obtener una cookie aleatoria válida sin sobrecargar con sondas HEAD
    const res = await api('/api/get-cookie', { platform });
    if (res && res.cookie) {
      return { file: res.filename || 'worker-allocated', cookie: res.cookie };
    }
  } catch (err) {
    console.warn('Fallback a método estático local por red:', err.message);
  }

  // Método de respaldo local estático optimizado
  const dir = `cookies/${platform}/`;
  let files = ['file1.json', 'file2.json', 'file3.json']; 
  const bl = new Set(getBlk(platform));
  const pool = files.filter(f => !bl.has(f));
  const selectedFile = (pool.length ? pool : files)[Math.floor(Math.random() * (pool.length ? pool : files).length)];
  
  const raw = await fetch(dir + selectedFile, { cache: 'no-store' }).then(r => r.text());
  return { file: selectedFile, cookie: toCookieString(raw) };
}
