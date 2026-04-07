'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, TreePine, Palette, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/', icon: Home, label: '首页' },
  { href: '/trees', icon: TreePine, label: '树木' },
  { href: '/styles', icon: Palette, label: '方案' },
  { href: '/contact', icon: User, label: '联系' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur-sm md:hidden">
      <div className="flex h-16 items-stretch">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors',
                isActive ? 'text-brand-navy' : 'text-gray-400',
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
