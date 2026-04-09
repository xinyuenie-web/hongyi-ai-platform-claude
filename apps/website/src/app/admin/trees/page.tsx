'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '../auth-context';
import { formatPrice } from '@hongyi/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Tree {
  _id: string;
  treeId: string;
  name: string;
  species: string;
  specs: { height: number; crown: number };
  price: { sale: number };
  coverImage: string;
  status: string;
  location: string;
  tags: string[];
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  available: { label: '在售', color: 'bg-green-100 text-green-700' },
  reserved: { label: '已预定', color: 'bg-yellow-100 text-yellow-700' },
  sold: { label: '已售', color: 'bg-red-100 text-red-700' },
  maintenance: { label: '养护中', color: 'bg-blue-100 text-blue-700' },
  archived: { label: '已下架', color: 'bg-gray-100 text-gray-500' },
};

export default function AdminTreesPage() {
  const { token } = useAuth();
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/trees?limit=50`);
        const data = await res.json();
        if (data.success) setTrees(data.data);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function updateStatus(treeId: string, status: string) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/trees/${treeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setTrees((prev) => prev.map((t) => (t.treeId === treeId ? { ...t, status } : t)));
      }
    } catch {}
  }

  if (loading) return <div className="py-12 text-center text-gray-400">加载中...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">树木管理</h1>
        <span className="text-sm text-gray-500">共 {trees.length} 棵</span>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">照片</th>
                <th className="px-4 py-3">编号</th>
                <th className="px-4 py-3">名称</th>
                <th className="px-4 py-3">品种</th>
                <th className="px-4 py-3">规格</th>
                <th className="px-4 py-3">价格</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {trees.map((tree) => {
                const st = STATUS_MAP[tree.status] || STATUS_MAP.available;
                return (
                  <tr key={tree._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-gray-100">
                        <Image
                          src={tree.coverImage || '/images/tree-placeholder.jpg'}
                          alt={tree.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{tree.treeId}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{tree.name}</td>
                    <td className="px-4 py-3 text-gray-600">{tree.species}</td>
                    <td className="px-4 py-3 text-gray-500">
                      高{tree.specs.height}cm 冠{tree.specs.crown}cm
                    </td>
                    <td className="px-4 py-3 font-medium text-brand-red">
                      ¥{formatPrice(tree.price.sale)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={tree.status}
                        onChange={(e) => updateStatus(tree.treeId, e.target.value)}
                        className="rounded border px-2 py-1 text-xs outline-none"
                      >
                        <option value="available">在售</option>
                        <option value="reserved">已预定</option>
                        <option value="sold">已售</option>
                        <option value="maintenance">养护中</option>
                        <option value="archived">下架</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
