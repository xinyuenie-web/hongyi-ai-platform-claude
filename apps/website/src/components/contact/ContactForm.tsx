'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { submitInquiry, analyzeGarden, type AIAnalysisResult } from '@/lib/api';
import { formatPrice } from '@hongyi/shared';
import { Send, CheckCircle, Loader2, Camera, X, Sparkles, TreePine, Palette, Wind } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/** Resolve image path: /images/* are served by Next.js, /uploads/* by API server */
function resolveImage(src: string): string {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  if (src.startsWith('/images/')) return src; // Next.js public folder
  return `${API_BASE}${src}`; // uploads etc from backend
}

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
  const [aiLoading, setAiLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
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
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);
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
    setAiLoading(true);

    try {
      // Submit inquiry and run AI analysis in parallel
      const [inquiryRes, aiRes] = await Promise.all([
        submitInquiry({
          ...form,
          photos: photos.length > 0 ? photos : undefined,
        }),
        analyzeGarden({
          message: form.message,
          photos: photos.length > 0 ? photos : undefined,
        }),
      ]);

      if (inquiryRes.success) {
        setSuccess(true);
      } else {
        setError(inquiryRes.error?.message || '提交失败，请稍后重试');
      }

      if (aiRes.success && aiRes.data) {
        setAiResult(aiRes.data);
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
      setAiLoading(false);
    }
  }

  function resetForm() {
    setSuccess(false);
    setAiResult(null);
    setForm({ name: '', phone: '', wechatId: '', message: '' });
    previews.forEach((p) => URL.revokeObjectURL(p));
    setPhotos([]);
    setPreviews([]);
  }

  // Show AI results after successful submission
  if (success && aiResult) {
    return <AIResultPanel result={aiResult} onReset={resetForm} />;
  }

  if (success) {
    return (
      <div className="py-12 text-center">
        <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
        <h3 className="mb-2 text-lg font-bold text-gray-800">留言已提交</h3>
        <p className="text-sm text-gray-500">我们将在24小时内联系您</p>
        <button onClick={resetForm} className="btn-outline mt-6">
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
        <p className="mt-1 text-xs text-gray-400">
          <Sparkles className="mr-1 inline h-3 w-3 text-amber-500" />
          上传庭院照片，AI为您智能匹配方案
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          需求描述 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={4}
          className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
          placeholder="请描述您的需求，如：庭院面积约200平，喜欢中式风格，预算10万左右"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {aiLoading ? 'AI智能分析中...' : '提交中...'}
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            提交并获取AI智能方案
          </>
        )}
      </button>
    </form>
  );
}

/** AI Analysis Result Display Panel */
function AIResultPanel({
  result,
  onReset,
}: {
  result: AIAnalysisResult;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-gradient-to-r from-brand-navy to-blue-700 p-5 text-white">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-300" />
          <h3 className="text-lg font-bold">AI智能方案已生成</h3>
        </div>
        <p className="text-sm leading-relaxed text-blue-100">{result.designSummary}</p>
      </div>

      {/* Recommended Styles */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Palette className="h-4 w-4 text-brand-navy" />
          <h4 className="font-semibold text-gray-800">推荐庭院风格</h4>
        </div>
        <div className="space-y-3">
          {result.recommendedStyles.map((style, i) => (
            <div
              key={style.styleId}
              className={`flex gap-3 rounded-xl border p-3 ${i === 0 ? 'border-amber-300 bg-amber-50' : 'bg-white'}`}
            >
              <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {style.image ? (
                  <Image
                    src={resolveImage(style.image)}
                    alt={style.name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Palette className="h-6 w-6 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{style.name}</span>
                  <span className="rounded-full bg-brand-navy/10 px-2 py-0.5 text-xs font-medium text-brand-navy">
                    匹配度 {style.matchScore}%
                  </span>
                  {i === 0 && (
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
                      最佳推荐
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-gray-500">{style.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Trees */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <TreePine className="h-4 w-4 text-green-600" />
          <h4 className="font-semibold text-gray-800">推荐树木搭配</h4>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {result.recommendedTrees.slice(0, 6).map((tree) => (
            <Link
              key={tree.treeId}
              href={`/trees/${tree.treeId}`}
              className="group overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-square bg-gray-100">
                {tree.coverImage ? (
                  <Image
                    src={resolveImage(tree.coverImage)}
                    alt={tree.name}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <TreePine className="h-8 w-8 text-gray-300" />
                  </div>
                )}
                <div className="absolute right-1 top-1 rounded-full bg-green-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  匹配{tree.matchScore}%
                </div>
              </div>
              <div className="p-2">
                <h5 className="text-sm font-semibold text-gray-800 truncate">{tree.name}</h5>
                <p className="text-xs text-gray-500">
                  高{tree.specs.height}cm 冠{tree.specs.crown}cm
                </p>
                <p className="mt-1 text-sm font-bold text-brand-red">¥{formatPrice(tree.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Feng Shui Tip */}
      <div className="rounded-xl bg-amber-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Wind className="h-4 w-4 text-amber-600" />
          <h4 className="font-semibold text-amber-800">风水建议</h4>
        </div>
        <p className="text-sm leading-relaxed text-amber-700">{result.fengshuiTip}</p>
      </div>

      {/* Success + CTA */}
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
        <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500" />
        <p className="mb-1 text-sm font-semibold text-gray-800">您的留言已同步提交</p>
        <p className="mb-4 text-xs text-gray-500">
          专业顾问将在24小时内联系您，根据AI方案提供一对一深度咨询
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/trees" className="btn-primary text-sm">
            浏览更多树木
          </Link>
          <button onClick={onReset} className="btn-outline text-sm">
            重新提交
          </button>
        </div>
      </div>
    </div>
  );
}
