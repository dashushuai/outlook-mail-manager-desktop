import test from 'node:test';
import assert from 'node:assert/strict';

test('resolveRendererTarget uses the dev server URL when ELECTRON_RENDERER_URL is provided', async () => {
  const rendererModule = await import('./renderer');

  assert.equal(typeof rendererModule.resolveRendererTarget, 'function');

  if (typeof rendererModule.resolveRendererTarget !== 'function') {
    return;
  }

  const target = rendererModule.resolveRendererTarget({
    ELECTRON_RENDERER_URL: ' http://127.0.0.1:5173 ',
  }, 'D:/AI/claude/outlook-mail-manager/.worktrees/sqlite3-migration/dist-electron');

  assert.deepEqual(target, {
    kind: 'url',
    value: 'http://127.0.0.1:5173',
  });
});

test('resolveRendererTarget falls back to the built renderer entry when ELECTRON_RENDERER_URL is absent', async () => {
  const rendererModule = await import('./renderer');

  assert.equal(typeof rendererModule.resolveRendererTarget, 'function');

  if (typeof rendererModule.resolveRendererTarget !== 'function') {
    return;
  }

  const target = rendererModule.resolveRendererTarget(
    {},
    'D:/AI/claude/outlook-mail-manager/.worktrees/sqlite3-migration/dist-electron',
  );

  assert.deepEqual(target, {
    kind: 'file',
    value: 'D:\\AI\\claude\\outlook-mail-manager\\.worktrees\\sqlite3-migration\\web\\dist\\index.html',
  });
});
