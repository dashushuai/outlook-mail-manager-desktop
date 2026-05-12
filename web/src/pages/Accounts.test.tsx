import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

test('accounts page advertises JSON drag-and-drop import support', async () => {
  Object.defineProperty(globalThis, 'React', {
    configurable: true,
    value: React,
  });

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { protocol: 'http:' },
    },
  });

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => undefined,
    },
  });

  const { default: Accounts } = await import('./Accounts');
  const markup = renderToStaticMarkup(<Accounts />);

  assert.match(markup, /拖拽 \.json 账户文件到这里导入/);
});
