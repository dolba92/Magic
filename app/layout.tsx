import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Magic — личная библиотека',
  description: 'Читайте EPUB и FB2 с комфортом на любом устройстве.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
