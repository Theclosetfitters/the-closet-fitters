import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Inter, Cormorant_Garamond, Dancing_Script } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import { CartProvider } from '@/lib/cart-context';

// Brand type system (licensed fonts stood in by Google Fonts):
//  - New Hero  -> Inter            (body, nav, labels, CTAs)
//  - Mogan     -> Cormorant Garamond (headings / display)
//  - script    -> Dancing Script   (the "The" in the logo)
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

const dancing = Dancing_Script({
  variable: '--font-dancing',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
    icon: '/icon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'The Closet Fitters',
  },
};

export const viewport: Viewport = {
  themeColor: '#1F333A',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The staff portal (/staff, set by the proxy) is a separate app — no public
  // nav. Public pages are unaffected.
  const isStaff = (await headers()).get('x-staff-portal') === '1';
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${dancing.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <CartProvider>
          {!isStaff && <Nav />}
          <div className="flex flex-1 flex-col">{children}</div>
          <ServiceWorkerRegister />
        </CartProvider>
      </body>
    </html>
  );
}
