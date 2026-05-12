import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(__dirname, '..');
const builderConfigPath = path.join(projectRoot, 'electron-builder.yml');

test('electron-builder config builds NSIS installer and portable zip packages', async () => {
  const config = await readFile(builderConfigPath, 'utf8');

  assert.match(config, /win:\n(?:  .+\n)*  target:\n    - target: nsis\n      arch:\n        - x64\n    - target: zip\n      arch:\n        - x64/);
});

test('electron-builder config associates JSON account import files', async () => {
  const config = await readFile(builderConfigPath, 'utf8');

  assert.match(config, /fileAssociations:\n  - ext: json\n    name: Outlook Mail Manager Account Import\n    description: Outlook Mail Manager account import file\n    role: Editor/);
});

test('electron build script lets electron-builder use configured Windows targets', async () => {
  const script = await readFile(path.join(projectRoot, 'electron', 'build.mjs'), 'utf8');

  assert.doesNotMatch(script, /'--win', 'nsis'/);
});

test('electron-builder config uses an update-safe artifact name', async () => {
  const config = await readFile(builderConfigPath, 'utf8');

  assert.match(config, /artifactName: Outlook-Mail-Manager-Setup-\$\{version\}\.\$\{ext\}/);
});
