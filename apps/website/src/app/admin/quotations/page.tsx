'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth-context';
import { FileText, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface QuotationItem {
  treeName: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface QuotationService {
  name: string;
  description?: string;
  price: number;
}

interface Quotation {
  _id: string;
  quotationNo: string;
  name: string;
  phone: string;
  items: QuotationItem[];
  services?: QuotationService[];
  treesSubtotal: number;
  servicesSubtotal: number;
  total: number;
  status: 'draft' | 'sent' | 'accepted' | 'expired';
  validUntil: string;
  note?: string;
  createdAt: string;
}

const STATUS_MAP: Record<string, string> = {
  draft: '草稿',
  sent: '已发送',
  accepted: '已接受',
  expired: '已过期',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  expired: 'bg-red-100 text-red-800',
};

export default function QuotationsPage() {
  const { token } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/quotations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setQuotations(data.data || []);
      }
    } catch (err) {
      console.error('获取报价列表失败', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchQuotations();
  }, [token, fetchQuotations]);

  async function updateStatus(quotationNo: string, status: string) {
    setUpdating(quotationNo);
    try {
      const res = await fetch(`${API_BASE}/api/v1/quotations/${quotationNo}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setQuotations((prev) =>
          prev.map((q) =>
            q.quotationNo === quotationNo ? { ...q, status: status as Quotation['status'] } : q
          )
        );
      }
    } catch (err) {
      console.error('更新状态失败', err);
    } finally {
      setUpdating(null);
    }
  }

  function formatMoney(val: number) {
    return `¥${(val || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">报价管理</h1>
        <button
          onClick={fetchQuotations}
          className="rounded-lg border p-2 hover:bg-gray-50"
          title="刷新"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">加载中...</div>
      ) : quotations.length === 0 ? (
        <div className="rounded-xl bg-white py-20 text-center shadow-sm">
          <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-400">暂无报价记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotations.map((q) => {
            const isExpanded = expandedId === q._id;
            return (
              <div key={q._id} className="rounded-xl bg-white shadow-sm">
                {/* Header row */}
                <div
                  className="flex cursor-pointer items-center gap-4 p-4 hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : q._id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium text-brand-navy">
                        {q.quotationNo}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[q.status]}`}>
                        {STATUS_MAP[q.status]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span>{q.name}</span>
                      <span>{q.phone}</span>
                      <span>{q.items?.length || 0} 项树木</span>
                      <span className="font-medium text-gray-800">{formatMoney(q.total)}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      有效期至: {new Date(q.validUntil).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={q.status}
                      disabled={updating === q.quotationNo}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateStatus(q.quotationNo, e.target.value)}
                      className="rounded border px-2 py-1 text-xs outline-none focus:border-brand-navy disabled:opacity-50"
                    >
                      <option value="draft">草稿</option>
                      <option value="sent">已发送</option>
                      <option value="accepted">已接受</option>
                      <option value="expired">已过期</option>
                    </select>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t px-4 pb-4 pt-3">
                    {/* Items table */}
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">树木明细</h3>
                    <div className="mb-4 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500">
                          <tr>
                            <th className="px-3 py-2 font-medium">树木名称</th>
                            <th className="px-3 py-2 font-medium">规格</th>
                            <th className="px-3 py-2 font-medium text-right">数量</th>
                            <th className="px-3 py-2 font-medium text-right">单价</th>
                            <th className="px-3 py-2 font-medium text-right">小计</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {q.items?.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 text-gray-800">{item.treeName}</td>
                              <td className="px-3 py-2 text-gray-600">{item.spec}</td>
                              <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
                              <td className="px-3 py-2 text-right text-gray-600">{formatMoney(item.unitPrice)}</td>
                              <td className="px-3 py-2 text-right font-medium text-gray-800">{formatMoney(item.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Services */}
                    {q.services && q.services.length > 0 && (
                      <>
                        <h3 className="mb-2 text-sm font-semibold text-gray-700">服务项目</h3>
                        <div className="mb-4 space-y-1">
                          {q.services.map((svc, idx) => (
                            <div key={idx} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
                              <div>
                                <span className="text-gray-800">{svc.name}</span>
                                {svc.description && (
                                  <span className="ml-2 text-gray-400">{svc.description}</span>
                                )}
                              </div>
                              <span className="font-medium text-gray-800">{formatMoney(svc.price)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Summary */}
                    <div className="flex flex-col items-end gap-1 border-t pt-3 text-sm">
                      <div className="flex gap-8">
                        <span className="text-gray-500">树木小计</span>
                        <span className="font-medium">{formatMoney(q.treesSubtotal)}</span>
                      </div>
                      <div className="flex gap-8">
                        <span className="text-gray-500">服务小计</span>
                        <span className="font-medium">{formatMoney(q.servicesSubtotal)}</span>
                      </div>
                      <div className="flex gap-8 text-base">
                        <span className="font-semibold text-gray-800">总计</span>
                        <span className="font-bold text-brand-navy">{formatMoney(q.total)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
