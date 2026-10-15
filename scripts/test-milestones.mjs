import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = mkdtempSync(join(tmpdir(), 'horse-milestones-'));
try {
  const entries = ['src/world/boards.test.ts', 'src/data/achievements.test.ts'];
  await build({ entryPoints: entries, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outdir: directory });
  for (const name of ['world/boards.test.js', 'data/achievements.test.js']) await import(pathToFileURL(join(directory, name)).href);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
