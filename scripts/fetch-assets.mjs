// node scripts/fetch-assets.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const UA = 'HorseSimulator-asset-fetch/1.0 (personal project)';
const textures = ['grass_ground', 'sparse_grass', 'grass_path_2'];
const hdris = ['toposcope_sunset', 'kloofendal_overcast_puresky'];
const TEX_MAPS = ['Diffuse', 'nor_gl', 'Rough', 'AO'];
const RES = '2k';

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
}
async function save(url, path) {
  const buf = Buffer.from(await (await get(url)).arrayBuffer());
  await writeFile(path, buf);
  console.log('saved', path);
}

(async () => {
  for (const id of textures) {
    const files = await (await get(`https://api.polyhaven.com/files/${id}`)).json();
    await mkdir(`public/textures/${id}`, { recursive: true });
    for (const map of TEX_MAPS) {
      const entry = files[map]?.[RES]?.jpg;
      if (entry) await save(entry.url, `public/textures/${id}/${map}_${RES}.jpg`);
      else console.warn('missing', id, map);
    }
  }
  for (const id of hdris) {
    const files = await (await get(`https://api.polyhaven.com/files/${id}`)).json();
    await mkdir('public/hdri', { recursive: true });
    const entry = files.hdri?.['2k']?.hdr;
    if (entry) await save(entry.url, `public/hdri/${id}_2k.hdr`);
    else console.warn('missing hdri', id);
  }
})();
