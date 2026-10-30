import './globals.css';
import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';

const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'beats — mo-tion interactive',
  description: 'a one-page drum machine built with next.js and web audio',
  metadataBase: new URL('http://localhost:3000'),
  // next doesn't put its basePath in front of metadata icons — under /beats that's on us
  icons: [
    { rel: 'icon', url: `${process.env.BASE_PATH || ''}/favicon.svg`, type: 'image/svg+xml' },
    { rel: 'alternate icon', url: `${process.env.BASE_PATH || ''}/favicon.ico` }
  ],
};

export const viewport: Viewport = {
  themeColor: '#05080d',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
