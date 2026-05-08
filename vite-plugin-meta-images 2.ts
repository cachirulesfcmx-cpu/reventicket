import type { Plugin } from 'vite';

// Stub plugin - not needed outside Replit
export function metaImagesPlugin(): Plugin {
  return {
    name: 'meta-images-stub',
    enforce: 'pre',
  };
}
