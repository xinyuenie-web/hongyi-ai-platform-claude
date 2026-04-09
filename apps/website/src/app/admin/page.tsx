'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import Link from 'next/link';
import {
  TreePine,
  MessageSquare,
  Users,
  TrendingUp,
  CalendarCheck,
  FileText,
  ShoppingCart,
  ExternalLink,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface Stats {
  total: number;
  available: number;
  reserved: number;
  sold: number;
}

export default function AdminDashboard() {
  const { token } = useAuth();
  const [treeStats, setTreeStats] = useState<Stats | null>(null);
  const [inquiryCount, setInquiryCount] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState(0);
  const [draftQuotations, setDraftQuotations] = useState(0);
  const [activeOrders, setActiveOrders] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [statsRes, inqRes, aptRes, quoRes, ordRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/trees/meta/stats`).then((r) => r.json()),
          fetch(`${API_BASE}/api/v1/inquiries`, { headers }).then((r) => r.json()),
          fetch(`${API_BASE}/api/v1/appointments`, { headers }).then((r) => r.json()).catch(() => ({ success: false })),
          fetch(`${API_BASE}/api/v1/quotations`, { headers }).then((r) => r.json()).catch(() => ({ success: false })),
          fetch(`${API_BASE}/api/v1/orders`, { headers }).then((r) => r.json()).catch(() => ({ success: false })),
        ]);

        if (statsRes.success) setTreeStats(statsRes.data);
        if (inqRes.success) setInquiryCount(inqRes.pagination?.total || inqRes.data?.length || 0);

        // Count today's appointments
        if (aptRes.success && aptRes.data) {
          const today = new Date().toISOString().split('T')[0];
          const todayCount = aptRes.data.filter((a: { date: string }) => {
            const aptDate = new Date(a.date).toISOString().split('T')[0];
            return aptDate === today;
          }).length;
          setTodayAppointments(todayCount);
        }

        // Count draft quotations
        if (quoRes.success && quoRes.data) {
          const draftCount = quoRes.data.filter((q: { status: string }) => q.status === 'draft').length;
          setDraftQuotations(draftCount);
        }

        // Count active orders (not completed/cancelled)
        if (ordRes.success && ordRes.data) {
          const activeCount = ordRes.data.filter(
            (o: { status: string }) => o.status !== 'completed' && o.status !== 'cancelled'
          ).length;
          setActiveOrders(activeCount);
        }
      } catch {}
    }
    if (token) load();
  }, [token]);

  const cards = [
    { label: '树木总数', value: treeStats?.total ?? '-', icon: TreePine, color: 'bg-green-500' },
    { label: '在售中', value: treeStats?.available ?? '-', icon: TrendingUp, color: 'bg-blue-500' },
    { label: '已售出', value: treeStats?.sold ?? '-', icon: Users, color: 'bg-orange-500' },
    { label: '客户询盘', value: inquiryCount || '-', icon: MessageSquare, color: 'bg-purple-500' },
    { label: '今日预约', value: todayAppointments, icon: CalendarCheck, color: 'bg-cyan-500' },
    { label: '待处理报价', value: draftQuotations, icon: FileText, color: 'bg-amber-500' },
    { label: '进行中订单', value: activeOrders, icon: ShoppingCart, color: 'bg-rose-500' },
  ];

  const quickActions = [
    { href: '/admin/trees', label: '管理树木', icon: TreePine, color: 'text-brand-green' },
    { href: '/admin/inquiries', label: '查看询盘', icon: MessageSquare, color: 'text-purple-500' },
    { href: '/admin/appointments', label: '预约管理', icon: CalendarCheck, color: 'text-cyan-500' },
    { href: '/admin/quotations', label: '报价管理', icon: FileText, color: 'text-amber-500' },
    { href: '/admin/orders', label: '订单管理', icon: ShoppingCart, color: 'text-rose-500' },
    { href: '/', label: '查看官网', icon: ExternalLink, color: 'text-blue-500', external: true },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">仪表盘</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">{card.label}</span>
              <div className={`rounded-lg p-2 ${card.color}`}>
                <card.icon className="h-4 w-4 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">快捷操作</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickActions.map((action) =>
            action.external ? (
              <a
                key={action.href}
                href={action.href}
                target="_blank"
                className="rounded-lg border p-4 text-center transition-colors hover:bg-gray-50"
              >
                <action.icon className={`mx-auto mb-2 h-6 w-6 ${action.color}`} />
                <span className="text-sm font-medium">{action.label}</span>
              </a>
            ) : (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-lg border p-4 text-center transition-colors hover:bg-gray-50"
              >
                <action.icon className={`mx-auto mb-2 h-6 w-6 ${action.color}`} />
                <span className="text-sm font-medium">{action.label}</span>
              </Link>
            )
          )}
        </div>
      </div>
    </div>
  );
}
