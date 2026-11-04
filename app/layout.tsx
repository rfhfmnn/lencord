import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ServiceProvider } from '@/context';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lencord',
  description: 'Plataforma peer-to-peer (P2P) de préstamos colectivos orientada a PyMEs argentinas',
};

export const viewport: Viewport = {
  themeColor: '#F8FAFC',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}>
      <body className={plusJakartaSans.className}>
        <a href="#main-content" className="skip-link">
          Saltar al contenido principal
        </a>
        <ServiceProvider>{children}</ServiceProvider>
      </body>
    </html>
  );
}
