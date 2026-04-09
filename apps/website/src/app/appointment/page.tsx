'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  Phone,
  MessageSquare,
  CheckCircle,
  Loader2,
  TreePine,
  Video,
  MapPin,
  MessageCircle,
} from 'lucide-react';
import { getAvailableSlots, createAppointment, getTreeList } from '@/lib/api';
import type { ITree } from '@hongyi/shared';

const APPOINTMENT_TYPES = [
  { value: 'view_tree', label: '远程看树', icon: Video, desc: '视频连线实地看树' },
  { value: 'live_stream', label: '直播看树', icon: Video, desc: '直播间选树互动' },
  { value: 'site_visit', label: '到场看树', icon: MapPin, desc: '亲临基地现场' },
  { value: 'consultation', label: '专家咨询', icon: MessageCircle, desc: '1对1专业顾问' },
];

export default function AppointmentPage() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    wechatId: '',
    type: 'view_tree',
    date: '',
    timeSlot: '',
    treeIds: [] as string[],
    message: '',
  });
  const [dates, setDates] = useState<{ date: string; label: string; weekday: string }[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [trees, setTrees] = useState<ITree[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    date: string;
    timeSlot: string;
    type: string;
    status: string;
  } | null>(null);

  // Generate next 14 days
  useEffect(() => {
    const days: { date: string; label: string; weekday: string }[] = [];
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    for (let i = 1; i <= 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      days.push({
        date: `${yyyy}-${mm}-${dd}`,
        label: `${mm}/${dd}`,
        weekday: `周${weekdays[d.getDay()]}`,
      });
    }
    setDates(days);
  }, []);

  // Load trees
  useEffect(() => {
    getTreeList({ status: 'available', limit: 50 })
      .then((res) => {
        if (res.success && res.data) setTrees(res.data);
      })
      .catch(() => {});
  }, []);

  // Fetch slots when date changes
  useEffect(() => {
    if (!form.date) return;
    setSlotsLoading(true);
    setSlots([]);
    setForm((prev) => ({ ...prev, timeSlot: '' }));
    getAvailableSlots(form.date)
      .then((res) => {
        if (res.success && res.data) setSlots(res.data);
      })
      .catch(() => {})
      .finally(() => setSlotsLoading(false));
  }, [form.date]);

  function toggleTree(treeId: string) {
    setForm((prev) => ({
      ...prev,
      treeIds: prev.treeIds.includes(treeId)
        ? prev.treeIds.filter((id) => id !== treeId)
        : [...prev.treeIds, treeId],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) return setError('请输入您的姓名');
    if (!form.phone.trim()) return setError('请输入手机号');
    if (!/^1[3-9]\d{9}$/.test(form.phone)) return setError('请输入正确的手机号');
    if (!form.date) return setError('请选择预约日期');
    if (!form.timeSlot) return setError('请选择时间段');

    setLoading(true);
    try {
      const res = await createAppointment({
        ...form,
        treeIds: form.treeIds.length > 0 ? form.treeIds : undefined,
        wechatId: form.wechatId || undefined,
        message: form.message || undefined,
      });
      if (res.success && res.data) {
        setSuccess(true);
        setResult(res.data);
      } else {
        setError(res.error?.message || '预约失败，请稍后重试');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  if (success && result) {
    const typeLabel = APPOINTMENT_TYPES.find((t) => t.value === result.type)?.label || result.type;
    return (
      <div className="min-h-screen bg-gray-50 py-8 md:py-16">
        <div className="container-page max-w-lg">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
            <h2 className="mb-2 text-2xl font-bold text-brand-navy">预约成功</h2>
            <p className="mb-6 text-sm text-gray-500">我们会在预约前与您确认</p>
            <div className="space-y-3 rounded-xl bg-gray-50 p-5 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">预约类型</span>
                <span className="font-medium text-gray-800">{typeLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">预约日期</span>
                <span className="font-medium text-gray-800">{result.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">时间段</span>
                <span className="font-medium text-gray-800">{result.timeSlot}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">状态</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  待确认
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setSuccess(false);
                setResult(null);
                setForm({
                  name: '',
                  phone: '',
                  wechatId: '',
                  type: 'view_tree',
                  date: '',
                  timeSlot: '',
                  treeIds: [],
                  message: '',
                });
              }}
              className="btn-outline mt-6"
            >
              继续预约
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Banner */}
      <section className="bg-brand-navy py-10 md:py-14">
        <div className="container-page text-center text-white">
          <Calendar className="mx-auto mb-3 h-10 w-10 text-brand-gold" />
          <h1 className="text-2xl font-bold md:text-3xl">预约看树</h1>
          <p className="mt-2 text-sm text-gray-300">
            远程视频看树 / 直播互动选树 / 到场实地考察
          </p>
        </div>
      </section>

      <div className="container-page -mt-6 max-w-2xl pb-12">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl bg-white p-6 shadow-sm md:p-8">
          {/* Appointment Type */}
          <div>
            <label className="mb-3 block text-sm font-semibold text-gray-800">预约类型</label>
            <div className="grid grid-cols-2 gap-3">
              {APPOINTMENT_TYPES.map((item) => {
                const Icon = item.icon;
                const selected = form.type === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setForm({ ...form, type: item.value })}
                    className={`flex flex-col items-center rounded-xl border-2 p-4 transition-all ${
                      selected
                        ? 'border-brand-navy bg-brand-navy/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon
                      className={`mb-2 h-6 w-6 ${selected ? 'text-brand-navy' : 'text-gray-400'}`}
                    />
                    <span
                      className={`text-sm font-medium ${selected ? 'text-brand-navy' : 'text-gray-700'}`}
                    >
                      {item.label}
                    </span>
                    <span className="mt-0.5 text-xs text-gray-400">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Calendar className="h-4 w-4 text-brand-navy" />
              选择日期 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-7 gap-2">
              {dates.map((d) => {
                const selected = form.date === d.date;
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setForm({ ...form, date: d.date })}
                    className={`flex flex-col items-center rounded-lg border py-2 text-center transition-all ${
                      selected
                        ? 'border-brand-navy bg-brand-navy text-white'
                        : 'border-gray-200 hover:border-brand-navy/50'
                    }`}
                  >
                    <span className="text-xs">{d.weekday}</span>
                    <span className="text-sm font-semibold">{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slot */}
          <div>
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Clock className="h-4 w-4 text-brand-navy" />
              选择时间 <span className="text-red-500">*</span>
            </label>
            {!form.date ? (
              <p className="text-sm text-gray-400">请先选择日期</p>
            ) : slotsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载可用时段...
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-gray-400">该日期暂无可用时段</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => {
                  const selected = form.timeSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setForm({ ...form, timeSlot: slot })}
                      className={`rounded-lg border py-2.5 text-center text-sm font-medium transition-all ${
                        selected
                          ? 'border-brand-navy bg-brand-navy text-white'
                          : 'border-gray-200 text-gray-700 hover:border-brand-navy/50'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Customer Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
                <User className="h-3.5 w-3.5" />
                姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                placeholder="请输入您的姓名"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
                <Phone className="h-3.5 w-3.5" />
                手机号 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                placeholder="请输入手机号"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">微信号（选填）</label>
            <input
              type="text"
              value={form.wechatId}
              onChange={(e) => setForm({ ...form, wechatId: e.target.value })}
              className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
              placeholder="方便通过微信联系您"
            />
          </div>

          {/* Tree Selection (optional) */}
          {trees.length > 0 && (
            <div>
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                <TreePine className="h-4 w-4 text-brand-green" />
                想看的树木（选填，可多选）
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {trees.slice(0, 12).map((tree) => {
                  const selected = form.treeIds.includes(tree.treeId);
                  return (
                    <button
                      key={tree.treeId}
                      type="button"
                      onClick={() => toggleTree(tree.treeId)}
                      className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all ${
                        selected
                          ? 'border-brand-green bg-brand-green/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
                          selected
                            ? 'border-brand-green bg-brand-green text-white'
                            : 'border-gray-300'
                        }`}
                      >
                        {selected && <CheckCircle className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-gray-800">{tree.name}</p>
                        <p className="text-xs text-gray-400">{tree.treeId}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Message */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
              <MessageSquare className="h-3.5 w-3.5" />
              备注信息（选填）
            </label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={3}
              className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
              placeholder="如：想看罗汉松造型树，预算5万左右"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                提交中...
              </>
            ) : (
              <>
                <Calendar className="mr-2 h-4 w-4" />
                确认预约
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
