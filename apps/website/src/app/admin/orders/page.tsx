'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth-context';
import { ShoppingCart, RefreshCw, Plus, X, Truck } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface LogisticsStep {
  step: string;
  description: string;
  time?: string;
}

interface Order {
  _id: string;
  orderNo: string;
  customerId?: string;
  phone?: string;
  items?: { treeName: string; quantity: number; price: number }[];
  totalAmount: number;
  payStatus: string;
  status: string;
  logistics?: LogisticsStep[];
  createdAt: string;
}

const STATUS_MAP: Record<string, string> = {
  pending: '待处理',
  paid: '已付款',
  preparing: '备货中',
  shipping: '运输中',
  delivered: '已送达',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  preparing: 'bg-indigo-100 text-indigo-800',
  shipping: 'bg-purple-100 text-purple-800',
  delivered: 'bg-teal-100 text-teal-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

const PAY_STATUS_MAP: Record<string, string> = {
  unpaid: '未付款',
  paid: '已付款',
  partial: '部分付款',
  refunded: '已退款',
};

export default function OrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [logisticsModal, setLogisticsModal] = useState<string | null>(null);
  const [logisticsForm, setLogisticsForm] = useState({ step: '', description: '' });
  const [logisticsSubmitting, setLogisticsSubmitting] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setOrders(data.data || []);
      }
    } catch (err) {
      console.error('获取订单列表失败', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchOrders();
  }, [token, fetchOrders]);

  async function updateStatus(orderNo: string, status: string) {
    setUpdating(orderNo);
    try {
      const res = await fetch(`${API_BASE}/api/v1/orders/${orderNo}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) =>
          prev.map((o) => (o.orderNo === orderNo ? { ...o, status } : o))
        );
      }
    } catch (err) {
      console.error('更新订单状态失败', err);
    } finally {
      setUpdating(null);
    }
  }

  async function addLogistics(orderNo: string) {
    if (!logisticsForm.step || !logisticsForm.description) return;
    setLogisticsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/orders/${orderNo}/logistics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(logisticsForm),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh order data
        await fetchOrders();
        setLogisticsModal(null);
        setLogisticsForm({ step: '', description: '' });
      }
    } catch (err) {
      console.error('添加物流信息失败', err);
    } finally {
      setLogisticsSubmitting(false);
    }
  }

  function formatMoney(val: number) {
    return `¥${(val || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">订单管理</h1>
        <button
          onClick={fetchOrders}
          className="rounded-lg border p-2 hover:bg-gray-50"
          title="刷新"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">加载中...</div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl bg-white py-20 text-center shadow-sm">
          <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-400">暂无订单记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order._id} className="rounded-xl bg-white shadow-sm">
              {/* Order header */}
              <div className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium text-brand-navy">
                        {order.orderNo}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                        {STATUS_MAP[order.status] || order.status}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                        {PAY_STATUS_MAP[order.payStatus] || order.payStatus}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span>客户: {order.phone || order.customerId || '-'}</span>
                      <span>树木: {order.items?.length || 0} 项</span>
                      <span className="font-medium text-gray-800">{formatMoney(order.totalAmount)}</span>
                      <span>{new Date(order.createdAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={order.status}
                      disabled={updating === order.orderNo}
                      onChange={(e) => updateStatus(order.orderNo, e.target.value)}
                      className="rounded border px-2 py-1 text-xs outline-none focus:border-brand-navy disabled:opacity-50"
                    >
                      <option value="pending">待处理</option>
                      <option value="paid">已付款</option>
                      <option value="preparing">备货中</option>
                      <option value="shipping">运输中</option>
                      <option value="delivered">已送达</option>
                      <option value="completed">已完成</option>
                      <option value="cancelled">已取消</option>
                      <option value="refunded">已退款</option>
                    </select>
                    <button
                      onClick={() => {
                        setLogisticsModal(order.orderNo);
                        setLogisticsForm({ step: '', description: '' });
                      }}
                      className="flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-1.5 text-xs text-white hover:bg-brand-navy/90"
                    >
                      <Plus className="h-3 w-3" />
                      物流
                    </button>
                    {order.logistics && order.logistics.length > 0 && (
                      <button
                        onClick={() =>
                          setExpandedOrder(expandedOrder === order.orderNo ? null : order.orderNo)
                        }
                        className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        <Truck className="h-3 w-3" />
                        轨迹 ({order.logistics.length})
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Logistics timeline */}
              {expandedOrder === order.orderNo && order.logistics && order.logistics.length > 0 && (
                <div className="border-t px-4 pb-4 pt-3">
                  <h3 className="mb-3 text-sm font-semibold text-gray-700">物流轨迹</h3>
                  <div className="relative ml-3 border-l-2 border-brand-navy/20 pl-6">
                    {order.logistics.map((log, idx) => (
                      <div key={idx} className="relative mb-4 last:mb-0">
                        <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-brand-navy bg-white" />
                        <div className="text-sm">
                          <span className="font-medium text-gray-800">{log.step}</span>
                          <p className="text-gray-500">{log.description}</p>
                          {log.time && (
                            <p className="mt-0.5 text-xs text-gray-400">
                              {new Date(log.time).toLocaleString('zh-CN')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Logistics Modal */}
      {logisticsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">添加物流信息</h3>
              <button onClick={() => setLogisticsModal(null)}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-500">订单号: {logisticsModal}</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">物流节点</label>
                <input
                  type="text"
                  value={logisticsForm.step}
                  onChange={(e) => setLogisticsForm({ ...logisticsForm, step: e.target.value })}
                  placeholder="如: 已发货、已到达中转站、派送中"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand-navy"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">详细描述</label>
                <textarea
                  value={logisticsForm.description}
                  onChange={(e) => setLogisticsForm({ ...logisticsForm, description: e.target.value })}
                  placeholder="描述物流详情..."
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand-navy"
                />
              </div>
              <button
                onClick={() => addLogistics(logisticsModal)}
                disabled={logisticsSubmitting || !logisticsForm.step || !logisticsForm.description}
                className="w-full rounded-lg bg-brand-navy py-2.5 text-sm font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
              >
                {logisticsSubmitting ? '提交中...' : '添加物流节点'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
