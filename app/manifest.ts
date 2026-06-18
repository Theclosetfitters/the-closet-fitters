import type { MetadataRoute } from 'next';

// Generates /manifest.webmanifest (referenced from the root layout).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The Closet Fitters',
    short_name: 'Closet Fitters',
    description:
      'Custom, made-to-measure closet systems with a live 3D preview and instant pricing.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f1ea',
    theme_color: '#1f333a',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
