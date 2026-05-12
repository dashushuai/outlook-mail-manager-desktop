import assert from 'node:assert/strict';
import test from 'node:test';
import { BrowserRouter, HashRouter } from 'react-router-dom';

import { selectAppRouter } from './appRouter';

test('desktop file renderer uses HashRouter so packaged routes do not blank the app', () => {
  const Router = selectAppRouter({ location: { protocol: 'file:' } });

  assert.equal(Router, HashRouter);
});

test('web renderer keeps BrowserRouter for http routes', () => {
  const Router = selectAppRouter({ location: { protocol: 'http:' } });

  assert.equal(Router, BrowserRouter);
});
