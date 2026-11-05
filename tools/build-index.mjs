import { readdirSync, writeFileSync, existsSync } from 'node:fs';
for (const dir of readdirSync('cookies')) {
  const p = `cookies/${dir}`;
  if (!existsSync(p)) continue;
  const files = readdirSync(p).filter(f => /^file\d+\.(json|txt)$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
  if (files.length) { writeFileSync(`${p}/index.json`, JSON.stringify({ files }, null, 2)); console.log(dir, files.length); }
}
