import { Providers } from './providers';
import './globals.css';

export const metadata = {
  title: 'TempoSwap — Advanced DEX on Tempo Network',
  description: 'Trade tokens, place limit orders, and earn yield on Tempo Network. The first full-featured decentralized exchange on Tempo blockchain.',
  keywords: 'DEX, DeFi, Tempo Network, swap, limit orders, yield, blockchain, crypto',
  authors: [{ name: 'TempoSwap' }],
  creator: 'TempoSwap',
  metadataBase: new URL('https://tempo-dex.vercel.app'),
  openGraph: {
    title: 'TempoSwap — Advanced DEX on Tempo Network',
    description: 'Trade tokens, place limit orders, and earn yield on Tempo Network.',
    url: 'https://tempo-dex.vercel.app',
    siteName: 'TempoSwap',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'TempoSwap DEX' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TempoSwap — Advanced DEX on Tempo Network',
    description: 'Trade tokens, place limit orders, and earn yield on Tempo Network.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
  themeColor: '#ff007a',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#09090c',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* Animated grid background */}
        <div className="bg-grid" />
        <div className="bg-glow bg-glow-1" />
        <div className="bg-glow bg-glow-2" />
        
        <Providers>
          <div className="app-container">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
