import type { Metadata } from 'next';
import { Vazirmatn } from 'next/font/google';
import './globals.css';

const vazir = Vazirmatn({
  variable: '--font-vazir',
  subsets: ['arabic', 'latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'پریمیوم هاب | حساب کاربری',
  description: 'خرید VPN و سرویس‌های دیجیتال — حساب کاربری پریمیوم هاب',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazir.variable}>
      <body>{children}</body>
    </html>
  );
}
