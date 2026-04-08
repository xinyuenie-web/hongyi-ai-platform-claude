'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { submitInquiry } from '@/lib/api';
import { Send, CheckCircle, Loader2, Camera, X } from 'lucide-react';

export function ContactForm() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    wechatId: '',
    message: '',
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 5) {
      setError('最多上传5张照片');
      return;
    }
    setError('');
    const newPhotos = [...photos, ...files];
    setPhotos(newPhotos);
    // Generate previews
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(previews[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) return setError('请输入您的姓名');
    if (!form.phone.trim()) return setError('请输入手机号');
    if (!form.message.trim()) return setError('请输入留言内容');

    setLoading(true);
    try {
      const res = await submitInquiry({
        ...form,
        photos: photos.length > 0 ? photos : undefined,
      });
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
            previews.forEach((p) => URL.revokeObjectURL(p));
            setPhotos([]);
            setPreviews([]);
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

      {/* Photo Upload */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          庭院照片 <span className="text-xs text-gray-400">（可选，最多5张）</span>
        </label>
        <div className="flex flex-wrap gap-3">
          {previews.map((src, i) => (
            <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-lg border">
              <Image src={src} alt={`庭院照片${i + 1}`} fill className="object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {photos.length < 5 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 transition-colors hover:border-brand-navy hover:text-brand-navy"
            >
              <Camera className="mb-1 h-5 w-5" />
              <span className="text-xs">上传照片</span>
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoSelect}
          className="hidden"
        />
        <p className="mt-1 text-xs text-gray-400">上传庭院照片，AI为您智能匹配方案</p>
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
