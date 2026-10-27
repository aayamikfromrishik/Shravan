import type { MetadataRoute } from 'next';

// Lets learners add SHRAVAN to the phone's Home Screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SHRAVAN — Listen. Reflect. Apply.',
    short_name: 'SHRAVAN',
    description: 'Great books, explained by a teacher who listens. By AAYAMIK.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f5ef',
    theme_color: '#1b2340',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
