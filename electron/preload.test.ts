import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const preloadPath = path.join(__dirname, 'preload.ts');

test('preload script stays self-contained for Electron sandbox packaging', async () => {
  const preloadSource = await readFile(preloadPath, 'utf8');

  assert.doesNotMatch(preloadSource, /from ['"]\.\//);
  assert.doesNotMatch(preloadSource, /require\(['"]\.\//);
});
