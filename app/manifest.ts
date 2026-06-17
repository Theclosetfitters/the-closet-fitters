import type { MetadataRoute } from 'next';

// Generates /manifest.webmanifest (referenced from the root layout).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Custom Closets',
    short_name: 'Closets',
    description:
      'Design a custom closet with a live 3D preview and instant pricing.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fafafa',
    theme_color: '#d97706',
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
