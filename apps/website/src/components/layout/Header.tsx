'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, TreePine } from 'lucide-react';

const navLinks = [
  { href: '/', label: '首页' },
  { href: '/trees', label: '精品树木' },
  { href: '/styles', label: '庭院风格' },
  { href: '/appointment', label: '预约看树' },
  { href: '/care', label: '养护指南' },
  { href: '/contact', label: '联系我们' },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
      <div className="container-page flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <TreePine className="h-8 w-8 text-brand-green" />
          <div>
            <span className="text-lg font-bold text-brand-navy">红艺花木</span>
            <span className="ml-1 hidden text-xs text-brand-gold sm:inline">AI · 造型树木</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-navy"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/ai-plan" className="btn-primary text-sm">
            免费AI方案
          </Link>
        </nav>

        {/* Mobile toggle */}
        <button
          className="flex h-11 w-11 items-center justify-center md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="菜单"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t bg-white px-4 pb-4 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block py-3 text-base font-medium text-gray-700"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/ai-plan"
            className="btn-primary mt-2 w-full text-center"
            onClick={() => setMobileOpen(false)}
          >
            免费AI方案
          </Link>
        </nav>
      )}
    </header>
  );
}
