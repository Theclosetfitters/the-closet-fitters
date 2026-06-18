import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk, Caveat } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import { CartProvider } from '@/lib/cart-context';

const hanken = Hanken_Grotesk({
  variable: '--font-hanken',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const caveat = Caveat({
  variable: '--font-caveat',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'The Closet Fitters',
    template: '%s · The Closet Fitters',
  },
  description:
    'Custom, made-to-measure closet systems — designed, engineered, and built with premium materials and a design-led approach.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'The Closet Fitters',
  },
};

export const viewport: Viewport = {
  themeColor: '#1f333a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${hanken.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <CartProvider>
          <Nav />
          <div className="flex flex-1 flex-col">{children}</div>
          <ServiceWorkerRegister />
        </CartProvider>
      </body>
    </html>
  );
}
