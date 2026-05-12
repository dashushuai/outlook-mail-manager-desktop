import path from 'node:path';

export type RendererEnv = {
  ELECTRON_RENDERER_URL?: string;
};

export type RendererTarget =
  | { kind: 'url'; value: string }
  | { kind: 'file'; value: string };

export function resolveRendererTarget(
  env: RendererEnv = process.env,
  runtimeDir = __dirname,
): RendererTarget {
  const rendererUrl = env.ELECTRON_RENDERER_URL?.trim();

  if (rendererUrl) {
    return {
      kind: 'url',
      value: rendererUrl,
    };
  }

  return {
    kind: 'file',
    value: path.resolve(runtimeDir, '../web/dist/index.html'),
  };
}
