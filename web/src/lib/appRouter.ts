import { BrowserRouter, HashRouter } from 'react-router-dom';

type RouterWindow = { location: Pick<Location, 'protocol'> };

export function selectAppRouter(currentWindow: RouterWindow = window) {
  return currentWindow.location.protocol === 'file:' ? HashRouter : BrowserRouter;
}
