'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { TreePine, LayoutDashboard, MessageSquare, LogOut, Menu, X, CalendarCheck, FileText, ShoppingCart } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

import { AuthContext, useAuth } from './auth-context';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('admin_token');
    if (saved) setToken(saved);
    setLoading(false);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (data.success && data.data?.token) {
        localStorage.setItem('admin_token', data.data.token);
        setToken(data.data.token);
      } else {
        setLoginError(data.error?.message || '登录失败');
      }
    } catch {
      setLoginError('网络错误');
    } finally {
      setLoginLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('admin_token');
    setToken(null);
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">加载中...</div>;
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
          <div className="mb-6 text-center">
            <TreePine className="mx-auto mb-2 h-10 w-10 text-brand-navy" />
            <h1 className="text-xl font-bold text-brand-navy">红艺花木管理后台</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              placeholder="用户名"
              value={loginForm.username}
              onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-brand-navy"
            />
            <input
              type="password"
              placeholder="密码"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-brand-navy"
            />
            {loginError && <p className="text-sm text-red-500">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-lg bg-brand-navy py-3 text-sm font-medium text-white hover:bg-brand-navy/90"
            >
              {loginLoading ? '登录中...' : '登 录'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: '/admin', label: '仪表盘', icon: LayoutDashboard },
    { href: '/admin/trees', label: '树木管理', icon: TreePine },
    { href: '/admin/inquiries', label: '客户询盘', icon: MessageSquare },
    { href: '/admin/appointments', label: '预约管理', icon: CalendarCheck },
    { href: '/admin/quotations', label: '报价管理', icon: FileText },
    { href: '/admin/orders', label: '订单管理', icon: ShoppingCart },
  ];

  return (
    <AuthContext.Provider value={{ token, logout }}>
      <div className="flex min-h-screen bg-gray-100">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-60 transform bg-brand-navy transition-transform md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
            <TreePine className="h-6 w-6 text-brand-gold" />
            <span className="text-sm font-bold text-white">红艺花木管理后台</span>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto text-white md:hidden">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="mt-4 space-y-1 px-3">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? 'bg-white/15 text-white' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="absolute bottom-4 left-0 right-0 px-3">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main */}
        <div className="flex-1">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-white px-4 shadow-sm">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-500">管理后台</span>
          </header>
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </AuthContext.Provider>
  );
}
