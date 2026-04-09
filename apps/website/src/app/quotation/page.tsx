'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  FileText,
  CheckCircle,
  Loader2,
  User,
  Phone,
  ShoppingCart,
  Wrench,
  TreePine,
  Printer,
} from 'lucide-react';
import { getTreeList, getStandardServices, createQuotation } from '@/lib/api';
import { formatPrice } from '@hongyi/shared';
import type { ITree, IQuotation } from '@hongyi/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function resolveImage(src: string): string {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  if (src.startsWith('/images/')) return src;
  return `${API_BASE}${src}`;
}

interface ServiceOption {
  name: string;
  description: string;
  price: number;
  ratePercent?: number;
}

export default function QuotationPage() {
  const [trees, setTrees] = useState<ITree[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedTreeIds, setSelectedTreeIds] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');
  const [quotation, setQuotation] = useState<IQuotation | null>(null);

  useEffect(() => {
    Promise.all([
      getTreeList({ status: 'available', limit: 100 }).catch(() => null),
      getStandardServices().catch(() => null),
    ]).then(([treesRes, servicesRes]) => {
      if (treesRes?.success && treesRes.data) setTrees(treesRes.data);
      if (servicesRes?.success && servicesRes.data) setServices(servicesRes.data);
      setDataLoading(false);
    });
  }, []);

  function toggleTree(treeId: string) {
    setSelectedTreeIds((prev) =>
      prev.includes(treeId) ? prev.filter((id) => id !== treeId) : [...prev, treeId]
    );
  }

  function toggleService(name: string) {
    setSelectedServices((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (selectedTreeIds.length === 0) return setError('请至少选择一棵树木');
    if (!form.name.trim()) return setError('请输入您的姓名');
    if (!form.phone.trim()) return setError('请输入手机号');
    if (!/^1[3-9]\d{9}$/.test(form.phone)) return setError('请输入正确的手机号');

    setLoading(true);
    try {
      const res = await createQuotation({
        treeIds: selectedTreeIds,
        name: form.name,
        phone: form.phone,
        serviceNames: selectedServices.length > 0 ? selectedServices : undefined,
      });
      if (res.success && res.data) {
        setQuotation(res.data);
      } else {
        setError(res.error?.message || '报价生成失败，请稍后重试');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  // Quotation Result View
  if (quotation) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="container-page max-w-3xl">
          {/* Quotation Document */}
          <div id="quotation-doc" className="rounded-2xl bg-white shadow-sm">
            {/* Header */}
            <div className="rounded-t-2xl bg-brand-navy p-6 text-white md:p-8">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold md:text-2xl">红艺花木 - 报价单</h1>
                  <p className="mt-1 text-sm text-gray-300">专业造型花木一站式服务</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-mono text-brand-gold">{quotation.quotationNo}</p>
                  <p className="mt-1 text-gray-300">
                    有效期至：{new Date(quotation.validUntil).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8">
              {/* Customer Info */}
              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-500">客户信息</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p>
                    <span className="text-gray-500">姓名：</span>
                    <span className="font-medium">{quotation.name}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">电话：</span>
                    <span className="font-medium">{quotation.phone}</span>
                  </p>
                </div>
              </div>

              {/* Trees Table */}
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                <TreePine className="h-4 w-4 text-brand-green" />
                树木明细
              </h3>
              <div className="mb-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="px-3 py-2.5 font-medium text-gray-500">树木名称</th>
                      <th className="px-3 py-2.5 font-medium text-gray-500">品种</th>
                      <th className="px-3 py-2.5 text-right font-medium text-gray-500">单价</th>
                      <th className="px-3 py-2.5 text-center font-medium text-gray-500">数量</th>
                      <th className="px-3 py-2.5 text-right font-medium text-gray-500">小计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.items.map((item, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-3 py-3 font-medium text-gray-800">{item.name}</td>
                        <td className="px-3 py-3 text-gray-500">{item.species}</td>
                        <td className="px-3 py-3 text-right text-gray-700">
                          ¥{formatPrice(item.price)}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-700">{item.quantity}</td>
                        <td className="px-3 py-3 text-right font-medium text-gray-800">
                          ¥{formatPrice(item.price * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="px-3 py-2.5 text-right font-medium text-gray-500">
                        树木小计
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-800">
                        ¥{formatPrice(quotation.treesSubtotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Services Table */}
              {quotation.services.length > 0 && (
                <>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <Wrench className="h-4 w-4 text-brand-gold" />
                    附加服务
                  </h3>
                  <div className="mb-6 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 text-left">
                          <th className="px-3 py-2.5 font-medium text-gray-500">服务名称</th>
                          <th className="px-3 py-2.5 font-medium text-gray-500">说明</th>
                          <th className="px-3 py-2.5 text-right font-medium text-gray-500">费用</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quotation.services.map((svc, i) => (
                          <tr key={i} className="border-b">
                            <td className="px-3 py-3 font-medium text-gray-800">{svc.name}</td>
                            <td className="px-3 py-3 text-gray-500">{svc.description}</td>
                            <td className="px-3 py-3 text-right font-medium text-gray-800">
                              ¥{formatPrice(svc.price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50">
                          <td colSpan={2} className="px-3 py-2.5 text-right font-medium text-gray-500">
                            服务小计
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-gray-800">
                            ¥{formatPrice(quotation.servicesSubtotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}

              {/* Grand Total */}
              <div className="rounded-xl border-2 border-brand-navy/20 bg-brand-navy/5 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">报价总计</p>
                    {quotation.discount && quotation.discount > 0 && (
                      <p className="mt-1 text-xs text-brand-green">
                        已优惠 ¥{formatPrice(quotation.discount)}
                      </p>
                    )}
                  </div>
                  <p className="text-3xl font-bold text-brand-red">
                    ¥{formatPrice(quotation.total)}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 border-t pt-4 text-xs text-gray-400">
                <p>* 报价有效期至 {new Date(quotation.validUntil).toLocaleDateString('zh-CN')}，逾期需重新报价</p>
                <p className="mt-1">* 价格包含树木本体费用，运输及安装费用根据实际情况另行计算</p>
                <p className="mt-1">* 浏阳红艺造型花木有限公司 | 联系电话：请咨询客服</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => window.print()}
              className="btn-primary"
            >
              <Printer className="mr-2 h-4 w-4" />
              打印/保存PDF
            </button>
            <button
              onClick={() => {
                setQuotation(null);
                setSelectedTreeIds([]);
                setSelectedServices([]);
                setForm({ name: '', phone: '' });
              }}
              className="btn-outline"
            >
              重新报价
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-brand-navy py-10 md:py-14">
        <div className="container-page text-center text-white">
          <FileText className="mx-auto mb-3 h-10 w-10 text-brand-gold" />
          <h1 className="text-2xl font-bold md:text-3xl">在线报价</h1>
          <p className="mt-2 text-sm text-gray-300">选择心仪的树木和服务，即时生成专属报价单</p>
        </div>
      </section>

      <div className="container-page -mt-6 max-w-4xl pb-12">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Select Trees */}
          <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-brand-navy">
              <ShoppingCart className="h-5 w-5" />
              第一步：选择树木
            </h2>
            <p className="mb-5 text-sm text-gray-500">点击选择您想要的树木（可多选）</p>

            {dataLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand-navy" />
                <span className="text-sm text-gray-500">加载树木数据...</span>
              </div>
            ) : trees.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <TreePine className="mx-auto mb-2 h-10 w-10" />
                <p className="text-sm">暂无可报价树木</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {trees.map((tree) => {
                  const selected = selectedTreeIds.includes(tree.treeId);
                  return (
                    <button
                      key={tree.treeId}
                      type="button"
                      onClick={() => toggleTree(tree.treeId)}
                      className={`group relative overflow-hidden rounded-xl border-2 text-left transition-all ${
                        selected
                          ? 'border-brand-navy ring-2 ring-brand-navy/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Check indicator */}
                      {selected && (
                        <div className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-white">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      )}

                      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                        <Image
                          src={resolveImage(tree.coverImage) || '/images/tree-placeholder.jpg'}
                          alt={tree.name}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        />
                      </div>
                      <div className="p-2.5">
                        <p className="truncate text-sm font-semibold text-gray-800">{tree.name}</p>
                        <p className="text-xs text-gray-500">{tree.species} · {tree.treeId}</p>
                        <p className="mt-1 text-sm font-bold text-brand-red">
                          ¥{formatPrice(tree.price.sale)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedTreeIds.length > 0 && (
              <p className="mt-4 text-sm text-brand-navy">
                已选择 <span className="font-bold">{selectedTreeIds.length}</span> 棵树木
              </p>
            )}
          </div>

          {/* Step 2: Select Services */}
          <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-brand-navy">
              <Wrench className="h-5 w-5" />
              第二步：附加服务（选填）
            </h2>
            <p className="mb-5 text-sm text-gray-500">根据需要选择配套服务</p>

            {services.length === 0 ? (
              <p className="text-sm text-gray-400">暂无可选服务</p>
            ) : (
              <div className="space-y-3">
                {services.map((svc) => {
                  const selected = selectedServices.includes(svc.name);
                  return (
                    <button
                      key={svc.name}
                      type="button"
                      onClick={() => toggleService(svc.name)}
                      className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                        selected
                          ? 'border-brand-gold bg-brand-gold/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border-2 transition-all ${
                          selected
                            ? 'border-brand-gold bg-brand-gold text-white'
                            : 'border-gray-300'
                        }`}
                      >
                        {selected && <CheckCircle className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{svc.name}</p>
                        <p className="text-xs text-gray-500">{svc.description}</p>
                      </div>
                      <p className="text-sm font-bold text-brand-gold">{svc.ratePercent || svc.price ? `${svc.ratePercent || 0}%` : ''}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 3: Customer Info */}
          <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-brand-navy">
              <User className="h-5 w-5" />
              第三步：填写信息
            </h2>
            <p className="mb-5 text-sm text-gray-500">用于生成报价单</p>

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
          </div>

          {error && (
            <p className="text-center text-sm text-red-500">{error}</p>
          )}

          <div className="text-center">
            <button type="submit" disabled={loading} className="btn-gold px-12">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成报价中...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  生成报价单
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
