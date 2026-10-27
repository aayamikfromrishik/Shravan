import type { Metadata, Viewport } from 'next';
import './globals.css';
import AppProvider from '@/components/AppProvider';

export const metadata: Metadata = {
  title: 'SHRAVAN',
  description: 'Listen. Reflect. Apply. Great books, explained by a teacher who listens. By AAYAMIK.',
  applicationName: 'SHRAVAN',
  appleWebApp: { capable: true, title: 'SHRAVAN', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1b2340',
};

// Apply the saved view before the page paints, so there is no flash of the wrong colours.
const viewScript = `try{var v=localStorage.getItem('shravan-view');if(v)document.documentElement.dataset.view=v}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-view="basic" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: viewScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Mukta:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
