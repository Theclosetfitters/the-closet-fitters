import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import { CartProvider } from '@/lib/cart-context';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Custom Closets',
    template: '%s · Custom Closets',
  },
  description:
    'Design a custom closet with a live 3D preview and instant pricing, then order online.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Custom Closets',
  },
};

export const viewport: Viewport = {
  themeColor: '#d97706',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900">
        <CartProvider>
          <Nav />
          <div className="flex flex-1 flex-col">{children}</div>
          <ServiceWorkerRegister />
        </CartProvider>
      </body>
    </html>
  );
}
