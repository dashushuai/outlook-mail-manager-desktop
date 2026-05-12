import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(rootDir, 'server');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'null'}`);
  }
}

let buildError = null;
let restoreError = null;

try {
  run(npmCommand, ['run', 'build']);
  run(npmCommand, ['run', 'electron:compile']);
  run(npmCommand, ['prune', '--omit=dev'], { cwd: serverDir });
  run(npxCommand, ['electron-builder', '--config', 'electron-builder.yml', '--win'], {
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    },
  });
} catch (error) {
  buildError = error;
} finally {
  try {
    run(npmCommand, ['install'], { cwd: serverDir });
  } catch (error) {
    restoreError = error;
  }
}

if (buildError) {
  throw buildError;
}

if (restoreError) {
  throw restoreError;
}
