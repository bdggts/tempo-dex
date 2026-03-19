import { Providers } from './providers';
import './globals.css';

export const metadata = {
  title: 'TempoSwap - Advanced DEX on Tempo',
  description: 'The first Automated Market Maker built on the EVM-compatible Tempo blockchain.',
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
