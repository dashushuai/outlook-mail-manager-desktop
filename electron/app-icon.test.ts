import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(__dirname, '..');
const iconPath = path.join(projectRoot, 'build', 'icon.ico');
const builderConfigPath = path.join(projectRoot, 'electron-builder.yml');

test('Windows app icon asset exists as a multi-size ICO', async () => {
  const icon = await readFile(iconPath);
  const count = icon.readUInt16LE(4);
  const entries = Array.from({ length: count }, (_, index) => {
    const entryOffset = 6 + index * 16;
    const width = icon[entryOffset] === 0 ? 256 : icon[entryOffset];
    const height = icon[entryOffset + 1] === 0 ? 256 : icon[entryOffset + 1];
    const dataOffset = icon.readUInt32LE(entryOffset + 12);

    return {
      width,
      height,
      pngWidth: icon.readUInt32BE(dataOffset + 16),
      pngHeight: icon.readUInt32BE(dataOffset + 20),
    };
  });
  const sizes = entries.map((entry) => entry.width).sort((a, b) => a - b);

  assert.equal(icon.readUInt16LE(0), 0);
  assert.equal(icon.readUInt16LE(2), 1);
  assert.deepEqual(sizes, [16, 32, 48, 256]);

  for (const entry of entries) {
    assert.equal(entry.height, entry.width);
    assert.equal(entry.pngWidth, entry.width);
    assert.equal(entry.pngHeight, entry.height);
  }
});

test('electron-builder config uses the Windows app icon', async () => {
  const config = await readFile(builderConfigPath, 'utf8');

  assert.match(config, /win:\n(?:  .+\n)*  icon: build\/icon\.ico/);
});
