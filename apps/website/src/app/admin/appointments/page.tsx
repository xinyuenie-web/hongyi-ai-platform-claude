'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth-context';
import { CalendarCheck, Search, RefreshCw } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Appointment {
  _id: string;
  name: string;
  phone: string;
  type: 'view_tree' | 'live_stream' | 'site_visit' | 'consultation';
  date: string;
  timeSlot: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  note?: string;
  createdAt: string;
}

const TYPE_MAP: Record<string, string> = {
  view_tree: '现场看树',
  live_stream: '直播看树',
  site_visit: '基地参观',
  consultation: '咨询洽谈',
};

const STATUS_MAP: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  completed: '已完成',
  cancelled: '已取消',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function AppointmentsPage() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.set('date', dateFilter);
      const res = await fetch(`${API_BASE}/api/v1/appointments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setAppointments(data.data || []);
      }
    } catch (err) {
      console.error('获取预约列表失败', err);
    } finally {
      setLoading(false);
    }
  }, [token, dateFilter]);

  useEffect(() => {
    if (token) fetchAppointments();
  }, [token, fetchAppointments]);

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    try {
      const res = await fetch(`${API_BASE}/api/v1/appointments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setAppointments((prev) =>
          prev.map((a) => (a._id === id ? { ...a, status: status as Appointment['status'] } : a))
        );
      }
    } catch (err) {
      console.error('更新状态失败', err);
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">预约管理</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-lg border py-2 pl-10 pr-3 text-sm outline-none focus:border-brand-navy"
            />
          </div>
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              清除筛选
            </button>
          )}
          <button
            onClick={fetchAppointments}
            className="rounded-lg border p-2 hover:bg-gray-50"
            title="刷新"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">加载中...</div>
      ) : appointments.length === 0 ? (
        <div className="rounded-xl bg-white py-20 text-center shadow-sm">
          <CalendarCheck className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-400">暂无预约记录</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">姓名</th>
                  <th className="px-4 py-3 font-medium">电话</th>
                  <th className="px-4 py-3 font-medium">预约类型</th>
                  <th className="px-4 py-3 font-medium">日期</th>
                  <th className="px-4 py-3 font-medium">时段</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {appointments.map((apt) => (
                  <tr key={apt._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{apt.name}</td>
                    <td className="px-4 py-3 text-gray-600">{apt.phone}</td>
                    <td className="px-4 py-3 text-gray-600">{TYPE_MAP[apt.type] || apt.type}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(apt.date).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{apt.timeSlot}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[apt.status]}`}>
                        {STATUS_MAP[apt.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={apt.status}
                        disabled={updating === apt._id}
                        onChange={(e) => updateStatus(apt._id, e.target.value)}
                        className="rounded border px-2 py-1 text-xs outline-none focus:border-brand-navy disabled:opacity-50"
                      >
                        <option value="pending">待确认</option>
                        <option value="confirmed">已确认</option>
                        <option value="completed">已完成</option>
                        <option value="cancelled">已取消</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {appointments.map((apt) => (
              <div key={apt._id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-gray-800">{apt.name}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[apt.status]}`}>
                    {STATUS_MAP[apt.status]}
                  </span>
                </div>
                <div className="mb-3 space-y-1 text-sm text-gray-500">
                  <p>电话: {apt.phone}</p>
                  <p>类型: {TYPE_MAP[apt.type] || apt.type}</p>
                  <p>日期: {new Date(apt.date).toLocaleDateString('zh-CN')} {apt.timeSlot}</p>
                </div>
                <select
                  value={apt.status}
                  disabled={updating === apt._id}
                  onChange={(e) => updateStatus(apt._id, e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand-navy disabled:opacity-50"
                >
                  <option value="pending">待确认</option>
                  <option value="confirmed">已确认</option>
                  <option value="completed">已完成</option>
                  <option value="cancelled">已取消</option>
                </select>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
