'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  User,
  Phone,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Upload,
  CheckCircle,
  Loader2,
  TreePine,
  Palette,
  Camera,
  MessageSquare,
  X,
  Wind,
  ImageIcon,
  RefreshCw,
} from 'lucide-react';
import { getTreeList, generateAIPlan, type AIPlanResult, type AIDesignAdvice } from '@/lib/api';
import { formatPrice } from '@hongyi/shared';
import type { ITree } from '@hongyi/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function resolveImage(src: string): string {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  if (src.startsWith('/images/')) return src;
  return `${API_BASE}${src}`;
}

const STEPS = [
  { label: '基本信息', icon: User },
  { label: '上传庭院', icon: Camera },
  { label: '选择树木', icon: TreePine },
  { label: '需求描述', icon: MessageSquare },
  { label: '生成方案', icon: Sparkles },
];

// 布局偏好选项（互斥单选）
const LAYOUT_OPTIONS = [
  { key: '', label: 'AI智能布局', desc: '由AI根据庭院空间自动推荐' },
  { key: '对称布局', label: '对称布局', desc: '左右对称，庄重大气' },
  { key: '门口两侧', label: '门口两侧', desc: '树木分列大门左右' },
  { key: '沿墙分布', label: '沿墙分布', desc: '沿围墙或边界种植' },
  { key: '均匀分散', label: '均匀分散', desc: '间隔均匀覆盖庭院' },
  { key: '留车位', label: '留出车位', desc: '中间留空方便停车' },
  { key: '注重风水', label: '风水布局', desc: '按风水方位推荐种植' },
];

const QUICK_TAGS = [
  // 庭院基本情况
  '约100平', '约200平', '约300平', '约500平',
  '坐北朝南', '有围墙', '有小孩', '有老人',
  // 地面处理
  '空地铺草皮', '铺青石板路', '铺鹅卵石小径',
  // 风格预算
  '中式风格', '日式风格', '预算10万', '预算20万',
];

export default function AIPlanPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    styleId: '',
    treeIds: [] as string[],
    message: '',
    layoutPref: '',
  });
  const [gardenPhoto, setGardenPhoto] = useState<File | null>(null);
  const [gardenPreview, setGardenPreview] = useState<string>('');
  const [trees, setTrees] = useState<ITree[]>([]);
  const [treesLoading, setTreesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIPlanResult | null>(null);
  const [error, setError] = useState('');
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load trees
  useEffect(() => {
    getTreeList({ status: 'available', limit: 50 })
      .then((res) => {
        if (res.success && res.data) setTrees(res.data);
      })
      .catch(() => {})
      .finally(() => setTreesLoading(false));
  }, []);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (gardenPreview) URL.revokeObjectURL(gardenPreview);
    setGardenPhoto(file);
    setGardenPreview(URL.createObjectURL(file));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePhoto() {
    if (gardenPreview) URL.revokeObjectURL(gardenPreview);
    setGardenPhoto(null);
    setGardenPreview('');
  }

  function toggleTree(treeId: string) {
    setForm((prev) => ({
      ...prev,
      treeIds: prev.treeIds.includes(treeId)
        ? prev.treeIds.filter((id) => id !== treeId)
        : prev.treeIds.length < 10
          ? [...prev.treeIds, treeId]
          : prev.treeIds,
    }));
  }

  function toggleTag(tag: string) {
    setForm((prev) => {
      const current = prev.message;
      if (current.includes(tag)) {
        return { ...prev, message: current.replace(tag, '').replace(/\s{2,}/g, ' ').trim() };
      }
      return { ...prev, message: current ? `${current} ${tag}` : tag };
    });
  }

  function canAdvance(): boolean {
    switch (step) {
      case 0: return !!form.name.trim() && /^1[3-9]\d{9}$/.test(form.phone);
      case 1: return !!gardenPhoto;
      case 2: return form.treeIds.length > 0;
      case 3: return true; // message is optional
      default: return false;
    }
  }

  function getStepError(): string {
    switch (step) {
      case 0:
        if (!form.name.trim()) return '请输入您的姓名';
        if (!form.phone.trim()) return '请输入手机号';
        if (!/^1[3-9]\d{9}$/.test(form.phone)) return '请输入正确的手机号';
        return '';
      case 1: return !gardenPhoto ? '请上传一张庭院照片' : '';
      case 2: return form.treeIds.length === 0 ? '请至少选择一棵树木' : '';
      default: return '';
    }
  }

  function handleNext() {
    const err = getStepError();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    if (step < 4) setStep(step + 1);
  }

  function handleBack() {
    setError('');
    if (step > 0) setStep(step - 1);
  }

  async function handleGenerate() {
    if (!gardenPhoto) return;
    setLoading(true);
    setError('');

    try {
      // Merge layoutPref into message for backend processing
      const fullMessage = [form.layoutPref, form.message].filter(Boolean).join(' ');
      const res = await generateAIPlan({
        ...form,
        message: fullMessage,
        gardenPhoto,
      });

      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error?.message || 'AI方案生成失败，请稍后重试');
      }
    } catch (e: any) {
      setError(`网络错误: ${e?.message || '请稍后重试'}`);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setStep(0);
    setForm({ name: '', phone: '', styleId: '', treeIds: [], message: '', layoutPref: '' });
    removePhoto();
    setError('');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-r from-brand-navy to-blue-800 py-8 md:py-12">
        <div className="container-page text-center text-white">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-amber-300" />
          <h1 className="text-2xl font-bold md:text-3xl">免费AI庭院方案</h1>
          <p className="mt-2 text-sm text-blue-200">
            上传庭院照片 + 选择心仪树木 → AI秒生效果图
          </p>
        </div>
      </section>

      {/* Progress Bar */}
      <div className="container-page -mt-4 max-w-2xl">
        <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step || !!result;
              return (
                <div key={i} className="flex flex-1 flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      isDone
                        ? 'bg-green-500 text-white'
                        : isActive
                          ? 'bg-brand-navy text-white'
                          : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {isDone ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span
                    className={`mt-1 text-[10px] ${
                      isActive ? 'font-semibold text-brand-navy' : 'text-gray-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="container-page max-w-2xl pb-12 pt-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm md:p-8">
          {/* Step 0: Basic Info */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="mb-4 text-lg font-bold text-brand-navy">填写基本信息</h2>
                <p className="mb-6 text-sm text-gray-500">
                  方便我们为您提供一对一的专业顾问服务
                </p>
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-gray-700">
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
                <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-gray-700">
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
          )}

          {/* Step 1: Upload Garden Photo */}
          {step === 1 && (
            <div>
              <h2 className="mb-2 text-lg font-bold text-brand-navy">上传庭院照片</h2>
              <p className="mb-5 text-sm text-gray-500">
                请上传一张庭院/别墅的正面照片（含房屋和门前空地），AI将在此基础上添加树木
              </p>
              {gardenPreview ? (
                <div className="relative">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-gray-100">
                    <Image
                      src={gardenPreview}
                      alt="庭院照片"
                      fill
                      className="object-cover"
                      sizes="100vw"
                    />
                  </div>
                  <button
                    onClick={removePhoto}
                    className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <p className="mt-3 text-center text-sm text-green-600">
                    <CheckCircle className="mr-1 inline h-4 w-4" />
                    照片已上传，点击"下一步"继续
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-16 text-gray-400 transition-colors hover:border-brand-navy hover:text-brand-navy"
                >
                  <Upload className="mb-3 h-12 w-12" />
                  <span className="text-sm font-medium">点击上传庭院照片</span>
                  <span className="mt-1 text-xs">支持 JPG / PNG，建议横版拍摄</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Step 2: Select Trees */}
          {step === 2 && (
            <div>
              <h2 className="mb-2 text-lg font-bold text-brand-navy">选择心仪树木</h2>
              <p className="mb-5 text-sm text-gray-500">
                选择想要种在庭院中的树木（最多10棵，效果图展示前3棵），已选
                <span className="font-semibold text-brand-green"> {form.treeIds.length} </span>棵
              </p>
              {treesLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  加载树木列表...
                </div>
              ) : trees.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-400">暂无树木数据，请稍后重试</p>
              ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {trees.map((tree) => {
                  const selected = form.treeIds.includes(tree.treeId);
                  return (
                    <button
                      key={tree.treeId}
                      type="button"
                      onClick={() => toggleTree(tree.treeId)}
                      className={`group overflow-hidden rounded-xl border-2 text-left transition-all ${
                        selected
                          ? 'border-brand-green ring-2 ring-brand-green/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="relative aspect-square bg-gray-100">
                        {tree.coverImage ? (
                          <Image
                            src={resolveImage(tree.coverImage)}
                            alt={tree.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, 33vw"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <TreePine className="h-8 w-8 text-gray-300" />
                          </div>
                        )}
                        {selected && (
                          <div className="absolute right-2 top-2 rounded-full bg-brand-green p-1">
                            <CheckCircle className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <h3 className="truncate text-xs font-semibold text-gray-800">{tree.name}</h3>
                        <p className="text-xs text-gray-400">{tree.species} · {tree.treeId}</p>
                        <p className="mt-1 text-sm font-bold text-brand-red">
                          ¥{formatPrice(tree.price.sale)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              )}
            </div>
          )}

          {/* Step 3: Description + Layout Preference */}
          {step === 3 && (
            <div>
              <h2 className="mb-2 text-lg font-bold text-brand-navy">描述您的需求</h2>
              <p className="mb-4 text-sm text-gray-500">
                选择布局方式和庭院情况，帮助AI生成更精准的方案
              </p>

              {/* Layout Preference Selector */}
              <div className="mb-5">
                <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <TreePine className="h-4 w-4 text-brand-green" />
                  树木布局方式
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {LAYOUT_OPTIONS.map((opt) => {
                    const active = form.layoutPref === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setForm({ ...form, layoutPref: opt.key })}
                        className={`rounded-xl border-2 p-2.5 text-left transition-all ${
                          active
                            ? 'border-brand-green bg-brand-green/5 ring-1 ring-brand-green/20'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className={`text-xs font-bold ${active ? 'text-brand-green' : 'text-gray-700'}`}>
                          {opt.label}
                        </p>
                        <p className="mt-0.5 text-[10px] text-gray-400">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Tags */}
              <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <Palette className="h-4 w-4 text-purple-500" />
                庭院情况与偏好
              </label>
              <div className="mb-4 flex flex-wrap gap-2">
                {QUICK_TAGS.map((tag) => {
                  const active = form.message.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        active
                          ? 'border-brand-navy bg-brand-navy/10 text-brand-navy'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              {/* Free text */}
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={3}
                className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                placeholder="其他补充说明（选填）..."
              />
            </div>
          )}

          {/* Step 5: Generate / Result */}
          {step === 4 && !result && (
            <div className="text-center">
              <h2 className="mb-4 text-lg font-bold text-brand-navy">AI方案生成</h2>

              {/* Summary */}
              <div className="mb-6 space-y-2 rounded-xl bg-gray-50 p-4 text-left text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">姓名</span>
                  <span className="font-medium text-gray-800">{form.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">庭院照片</span>
                  <span className="font-medium text-green-600">已上传</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">选择树木</span>
                  <span className="font-medium text-gray-800">{form.treeIds.length} 棵</span>
                </div>
                {form.layoutPref && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">布局方式</span>
                    <span className="font-medium text-brand-green">{LAYOUT_OPTIONS.find(o => o.key === form.layoutPref)?.label || form.layoutPref}</span>
                  </div>
                )}
                {form.message && (
                  <div className="border-t pt-2">
                    <span className="text-gray-500">需求描述：</span>
                    <p className="mt-1 text-gray-700">{form.message}</p>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="py-8">
                  <div className="relative mx-auto mb-4 h-20 w-20">
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-brand-navy/20 border-t-brand-navy"></div>
                    <Sparkles className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-amber-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">AI正在为您设计庭院效果图...</p>
                  <div className="mx-auto mt-3 max-w-xs space-y-1.5 text-xs text-gray-400">
                    <p>1. AI分析庭院空间与树木搭配...</p>
                    <p>2. 智能抠图并合成真树到照片中...</p>
                    {form.message.includes('草皮') || form.message.includes('石板') || form.message.includes('鹅卵石') ? (
                      <p>3. 铺设地面效果...</p>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs text-gray-300">预计需要15-30秒，请耐心等待</p>
                </div>
              ) : (
                <button
                  onClick={handleGenerate}
                  className="btn-primary w-full py-4 text-base"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  AI生成庭院效果图
                </button>
              )}
            </div>
          )}

          {/* Result Display */}
          {step === 4 && result && (
            <div className="space-y-6">
              {/* Customer Input Summary: Garden Photo + Selected Trees */}
              <div className="rounded-xl border-2 border-brand-navy/20 bg-gray-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Camera className="h-5 w-5 text-brand-navy" />
                  <h3 className="text-sm font-bold text-brand-navy">您的输入</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Uploaded Garden Photo */}
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-gray-500">上传的庭院照片</p>
                    {gardenPreview && (
                      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-white">
                        <Image
                          src={gardenPreview}
                          alt="您上传的庭院照片"
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 50vw"
                        />
                      </div>
                    )}
                  </div>
                  {/* Selected Trees */}
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-gray-500">
                      选择的真树（{form.treeIds.length} 棵）
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {trees
                        .filter((t) => form.treeIds.includes(t.treeId))
                        .map((tree) => (
                          <div key={tree.treeId} className="overflow-hidden rounded-lg border bg-white">
                            <div className="relative aspect-square">
                              {tree.coverImage ? (
                                <Image
                                  src={resolveImage(tree.coverImage)}
                                  alt={tree.name}
                                  fill
                                  className="object-cover"
                                  sizes="80px"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center bg-gray-100">
                                  <TreePine className="h-4 w-4 text-gray-300" />
                                </div>
                              )}
                            </div>
                            <p className="truncate px-1 py-0.5 text-center text-[10px] font-medium text-gray-700">
                              {tree.name}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                  {/* 需求描述 */}
                  {form.message && (
                    <div className="sm:col-span-2 border-t pt-3 mt-2">
                      <p className="mb-1 text-xs font-medium text-gray-500">需求描述</p>
                      <p className="text-sm text-gray-700 bg-white rounded-lg border p-2.5">
                        {form.message}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Generated Image */}
              {result.generatedImage && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-brand-navy" />
                    <h3 className="text-lg font-bold text-brand-navy">AI生成效果图</h3>
                  </div>
                  <button
                    onClick={() => setFullscreenImage(result.generatedImage)}
                    className="relative w-full overflow-hidden rounded-xl border-2 border-brand-navy/20"
                  >
                    <div className="relative aspect-square bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={result.generatedImage}
                        alt="AI生成的庭院效果图"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-center">
                      <span className="text-xs text-white">点击查看大图</span>
                    </div>
                  </button>
                </div>
              )}

              {!result.generatedImage && (
                <div className="rounded-xl bg-amber-50 p-4 text-center">
                  <ImageIcon className="mx-auto mb-2 h-8 w-8 text-amber-400" />
                  <p className="text-sm font-medium text-amber-800">AI图像生成暂时不可用</p>
                  <p className="mt-1 text-xs text-amber-600">方案分析已完成，效果图功能稍后恢复</p>
                  {(result as any).imageError && (
                    <p className="mt-2 text-xs text-red-500">错误详情: {(result as any).imageError}</p>
                  )}
                </div>
              )}

              {/* AI Analysis Results (Seed-2.0-pro) — preferred */}
              {result.aiAnalysis && (
                <>
                  {/* Design Summary */}
                  <div className="rounded-xl bg-gradient-to-r from-brand-navy to-blue-700 p-5 text-white">
                    <div className="mb-2 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-300" />
                      <h3 className="font-bold">AI智能设计方案</h3>
                      <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-200">AI深度分析</span>
                    </div>
                    <p className="text-sm leading-relaxed text-blue-100">
                      {result.aiAnalysis.designSummary}
                    </p>
                  </div>

                  {/* Space Analysis */}
                  {result.aiAnalysis.spaceAnalysis && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Camera className="h-4 w-4 text-blue-600" />
                        <h4 className="font-semibold text-blue-800">庭院空间分析</h4>
                      </div>
                      <p className="text-sm leading-relaxed text-blue-700">
                        {result.aiAnalysis.spaceAnalysis}
                      </p>
                    </div>
                  )}

                  {/* Tree Placement */}
                  {result.aiAnalysis.treePlacement?.length > 0 && (
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <TreePine className="h-4 w-4 text-green-600" />
                        <h4 className="font-semibold text-gray-800">树木布局方案</h4>
                      </div>
                      <div className="space-y-3">
                        {result.aiAnalysis.treePlacement.map((item, i) => (
                          <div key={i} className="rounded-xl border bg-white p-4">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                                {i + 1}
                              </span>
                              <span className="text-sm font-semibold text-gray-800">{item.treeName}</span>
                            </div>
                            <p className="ml-8 text-sm text-brand-navy">{item.position}</p>
                            <p className="ml-8 mt-1 text-xs text-gray-500">{item.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Style Advice */}
                  {result.aiAnalysis.styleAdvice && (
                    <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Palette className="h-4 w-4 text-purple-600" />
                        <h4 className="font-semibold text-purple-800">风格设计建议</h4>
                      </div>
                      <p className="text-sm leading-relaxed text-purple-700">
                        {result.aiAnalysis.styleAdvice}
                      </p>
                    </div>
                  )}

                  {/* Feng Shui */}
                  {result.aiAnalysis.fengshuiTip && (
                    <div className="rounded-xl bg-amber-50 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Wind className="h-4 w-4 text-amber-600" />
                        <h4 className="font-semibold text-amber-800">风水建议</h4>
                      </div>
                      <p className="text-sm leading-relaxed text-amber-700">
                        {result.aiAnalysis.fengshuiTip}
                      </p>
                    </div>
                  )}

                  {/* Budget */}
                  {result.aiAnalysis.budgetEstimate && (
                    <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-lg">💰</span>
                        <h4 className="font-semibold text-green-800">预算估算</h4>
                      </div>
                      <p className="text-sm leading-relaxed text-green-700">
                        {result.aiAnalysis.budgetEstimate}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Fallback: Rule-based Analysis (when AI analysis unavailable) */}
              {!result.aiAnalysis && result.analysis && (
                <>
                  {/* Design Summary */}
                  <div className="rounded-xl bg-gradient-to-r from-brand-navy to-blue-700 p-5 text-white">
                    <div className="mb-2 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-300" />
                      <h3 className="font-bold">AI智能方案</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-blue-100">
                      {result.analysis.designSummary}
                    </p>
                  </div>

                  {/* Feng Shui Tip */}
                  {result.analysis.fengshuiTip && (
                    <div className="rounded-xl bg-amber-50 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Wind className="h-4 w-4 text-amber-600" />
                        <h4 className="font-semibold text-amber-800">风水建议</h4>
                      </div>
                      <p className="text-sm leading-relaxed text-amber-700">
                        {result.analysis.fengshuiTip}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* CTA Buttons */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button onClick={handleReset} className="btn-outline flex-1">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  重新生成
                </button>
                <Link href="/contact" className="btn-primary flex-1 text-center">
                  <Phone className="mr-2 h-4 w-4" />
                  联系专家顾问
                </Link>
              </div>
            </div>
          )}

          {/* Error */}
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

          {/* Navigation Buttons */}
          {step < 4 && (
            <div className="mt-6 flex gap-3">
              {step > 0 && (
                <button onClick={handleBack} className="btn-outline flex-1">
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  上一步
                </button>
              )}
              <button
                onClick={handleNext}
                className="btn-primary flex-1"
              >
                {step === 3 ? '确认并生成' : '下一步'}
                <ChevronRight className="ml-1 h-4 w-4" />
              </button>
            </div>
          )}

          {step === 4 && !result && !loading && (
            <div className="mt-4">
              <button onClick={handleBack} className="btn-outline w-full">
                <ChevronLeft className="mr-1 h-4 w-4" />
                返回修改
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Image Modal */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <button className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white">
            <X className="h-6 w-6" />
          </button>
          <div className="relative max-h-[90vh] max-w-[90vw]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullscreenImage}
              alt="AI效果图大图"
              className="max-h-[90vh] w-auto rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
