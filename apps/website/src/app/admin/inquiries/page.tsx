'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '../layout';
import { Phone, MessageCircle, Clock, CheckCircle, XCircle, ImageIcon } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Inquiry {
  _id: string;
  name: string;
  phone: string;
  wechatId?: string;
  message: string;
  photos?: string[];
  status: 'pending' | 'contacted' | 'closed';
  createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '待处理', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  contacted: { label: '已联系', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  closed: { label: '已关闭', color: 'bg-gray-100 text-gray-500', icon: XCircle },
};

export default function AdminInquiriesPage() {
  const { token } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/inquiries`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setInquiries(data.data);
      } catch {}
      setLoading(false);
    }
    if (token) load();
  }, [token]);

  async function updateStatus(id: string, status: string) {
    try {
      await fetch(`${API_BASE}/api/v1/inquiries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      setInquiries((prev) => prev.map((inq) => (inq._id === id ? { ...inq, status: status as any } : inq)));
    } catch {}
  }

  if (loading) return <div className="py-12 text-center text-gray-400">加载中...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">客户询盘</h1>
        <span className="text-sm text-gray-500">
          共 {inquiries.length} 条，
          {inquiries.filter((i) => i.status === 'pending').length} 条待处理
        </span>
      </div>

      {inquiries.length === 0 ? (
        <div className="rounded-xl bg-white py-16 text-center shadow-sm">
          <MessageCircle className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-400">暂无客户询盘</p>
        </div>
      ) : (
        <div className="space-y-4">
          {inquiries.map((inq) => {
            const st = STATUS_MAP[inq.status] || STATUS_MAP.pending;
            return (
              <div key={inq._id} className="rounded-xl bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-gray-800">{inq.name}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {inq.phone}
                      </span>
                      {inq.wechatId && (
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3.5 w-3.5" />
                          {inq.wechatId}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(inq.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  <select
                    value={inq.status}
                    onChange={(e) => updateStatus(inq._id, e.target.value)}
                    className="rounded border px-2 py-1 text-xs outline-none"
                  >
                    <option value="pending">待处理</option>
                    <option value="contacted">已联系</option>
                    <option value="closed">已关闭</option>
                  </select>
                </div>

                <p className="mb-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{inq.message}</p>

                {inq.photos && inq.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <ImageIcon className="h-3.5 w-3.5" /> 庭院照片：
                    </span>
                    {inq.photos.map((photo, i) => (
                      <button
                        key={i}
                        onClick={() => setPreviewImg(`${API_BASE}${photo}`)}
                        className="relative h-16 w-16 overflow-hidden rounded-lg border hover:opacity-80"
                      >
                        <Image
                          src={`${API_BASE}${photo}`}
                          alt={`庭院照片${i + 1}`}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreviewImg(null)}
        >
          <div className="relative max-h-[80vh] max-w-[90vw]">
            <Image
              src={previewImg}
              alt="预览"
              width={800}
              height={600}
              className="max-h-[80vh] rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
