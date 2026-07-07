import type { Metadata } from 'next';
import { getDict } from '@/lib/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: 'Premium Hub Admin',
  description: 'Premium Hub administration panel',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, dir } = await getDict();
  return (
    <html lang={lang} dir={dir}>
      <body>{children}</body>
    </html>
  );
}
