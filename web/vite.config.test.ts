import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const viteConfigPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'vite.config.ts');

test('production build uses relative asset paths for packaged file renderer', async () => {
  const config = await readFile(viteConfigPath, 'utf8');

  assert.match(config, /base:\s*['"]\.\/['"]/);
});
