'use client';

import { useState } from 'react';
import { submitInquiry } from '@/lib/api';
import { Send, CheckCircle, Loader2 } from 'lucide-react';

export function ContactForm() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    wechatId: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) return setError('请输入您的姓名');
    if (!form.phone.trim()) return setError('请输入手机号');
    if (!form.message.trim()) return setError('请输入留言内容');

    setLoading(true);
    try {
      const res = await submitInquiry(form);
      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error?.message || '提交失败，请稍后重试');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="py-12 text-center">
        <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
        <h3 className="mb-2 text-lg font-bold text-gray-800">留言已提交</h3>
        <p className="text-sm text-gray-500">我们将在24小时内联系您</p>
        <button
          onClick={() => {
            setSuccess(false);
            setForm({ name: '', phone: '', wechatId: '', message: '' });
          }}
          className="btn-outline mt-6"
        >
          继续留言
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
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
        <label className="mb-1 block text-sm font-medium text-gray-700">
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

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">微信号</label>
        <input
          type="text"
          value={form.wechatId}
          onChange={(e) => setForm({ ...form, wechatId: e.target.value })}
          className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
          placeholder="方便我们通过微信联系您"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          留言内容 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={4}
          className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
          placeholder="请描述您的需求，如庭院面积、喜欢的风格、预算等"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        {loading ? '提交中...' : '提交留言'}
      </button>
    </form>
  );
}
