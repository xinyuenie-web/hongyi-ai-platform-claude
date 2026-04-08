'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './layout';
import { TreePine, MessageSquare, Users, TrendingUp } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, inqRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/trees/meta/stats`).then((r) => r.json()),
          fetch(`${API_BASE}/api/v1/inquiries`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()),
        ]);
        if (statsRes.success) setTreeStats(statsRes.data);
        if (inqRes.success) setInquiryCount(inqRes.pagination?.total || inqRes.data?.length || 0);
      } catch {}
    }
    if (token) load();
  }, [token]);

  const cards = [
    { label: '树木总数', value: treeStats?.total ?? '-', icon: TreePine, color: 'bg-green-500' },
    { label: '在售中', value: treeStats?.available ?? '-', icon: TrendingUp, color: 'bg-blue-500' },
    { label: '已售出', value: treeStats?.sold ?? '-', icon: Users, color: 'bg-orange-500' },
    { label: '客户询盘', value: inquiryCount || '-', icon: MessageSquare, color: 'bg-purple-500' },
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <a href="/admin/trees" className="rounded-lg border p-4 text-center hover:bg-gray-50">
            <TreePine className="mx-auto mb-2 h-6 w-6 text-brand-green" />
            <span className="text-sm font-medium">管理树木</span>
          </a>
          <a href="/admin/inquiries" className="rounded-lg border p-4 text-center hover:bg-gray-50">
            <MessageSquare className="mx-auto mb-2 h-6 w-6 text-purple-500" />
            <span className="text-sm font-medium">查看询盘</span>
          </a>
          <a href="/" target="_blank" className="rounded-lg border p-4 text-center hover:bg-gray-50">
            <TrendingUp className="mx-auto mb-2 h-6 w-6 text-blue-500" />
            <span className="text-sm font-medium">查看官网</span>
          </a>
        </div>
      </div>
    </div>
  );
}
