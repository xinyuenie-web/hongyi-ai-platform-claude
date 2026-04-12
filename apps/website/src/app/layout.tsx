import type { Metadata, Viewport } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BottomNav } from '@/components/layout/BottomNav';
import { WeChatFloat } from '@/components/layout/WeChatFloat';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: '红艺花木 | 高端庭院别墅造型花木解决方案',
    template: '%s | 红艺花木',
  },
  description:
    '浏阳红艺造型花木有限公司，高端庭院别墅造型花木解决方案。真院照+真树木+真想法=真效果，AI帮您设计庭院花木方案。先看效果，再选树，好下单。省心又省事，省时又省钱。11年专业经验，百亩基地直供。',
  keywords: [
    '造型花木',
    '私家庭院',
    '造型树',
    '罗汉松',
    '别墅庭院',
    '庭院设计',
    'AI方案',
    '红艺花木',
    '浏阳花木',
  ],
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: 'AI · 红艺花木',
    url: 'https://ai花木.com',
  },
  metadataBase: new URL('https://xn--ai-0p4ew22l.com'),
  alternates: {
    canonical: '/',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#1F3864',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <Footer />
        <BottomNav />
        <WeChatFloat />
      </body>
    </html>
  );
}
