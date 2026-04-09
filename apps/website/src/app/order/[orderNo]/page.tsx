'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  Loader2,
  AlertCircle,
  CreditCard,
  TreePine,
  CircleDot,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { getOrder } from '@/lib/api';
import { formatPrice } from '@hongyi/shared';
import type { IOrder, OrderStatus, PayStatus } from '@hongyi/shared';

const ORDER_STATUS_MAP: Record<OrderStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: '待付款', color: 'bg-amber-100 text-amber-700', icon: Clock },
  paid: { label: '已付款', color: 'bg-blue-100 text-blue-700', icon: CreditCard },
  preparing: { label: '备货中', color: 'bg-indigo-100 text-indigo-700', icon: Package },
  shipping: { label: '运输中', color: 'bg-cyan-100 text-cyan-700', icon: Truck },
  delivered: { label: '已送达', color: 'bg-green-100 text-green-700', icon: MapPin },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-500', icon: XCircle },
  refunded: { label: '已退款', color: 'bg-red-100 text-red-700', icon: RotateCcw },
};

const PAY_STATUS_MAP: Record<PayStatus, { label: string; color: string }> = {
  unpaid: { label: '未支付', color: 'bg-amber-100 text-amber-700' },
  paid: { label: '已支付', color: 'bg-green-100 text-green-700' },
  refunding: { label: '退款中', color: 'bg-orange-100 text-orange-700' },
  refunded: { label: '已退款', color: 'bg-red-100 text-red-700' },
};

const LOGISTICS_STEP_ICONS: Record<string, React.ElementType> = {
  default: CircleDot,
  paid: CreditCard,
  preparing: Package,
  excavation: TreePine,
  packaging: Package,
  shipping: Truck,
  delivered: MapPin,
  completed: CheckCircle,
  planting: TreePine,
};

function getStepIcon(step: string): React.ElementType {
  const key = Object.keys(LOGISTICS_STEP_ICONS).find((k) =>
    step.toLowerCase().includes(k)
  );
  return key ? LOGISTICS_STEP_ICONS[key] : LOGISTICS_STEP_ICONS.default;
}

export default function OrderTrackingPage() {
  const params = useParams();
  const orderNo = params.orderNo as string;

  const [order, setOrder] = useState<IOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderNo) return;
    setLoading(true);
    getOrder(orderNo)
      .then((res) => {
        if (res.success && res.data) {
          setOrder(res.data);
        } else {
          setError(res.error?.message || '订单不存在或已过期');
        }
      })
      .catch(() => setError('网络错误，无法获取订单信息'))
      .finally(() => setLoading(false));
  }, [orderNo]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-brand-navy" />
          <p className="text-sm text-gray-500">加载订单信息...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <h2 className="mb-2 text-lg font-bold text-gray-800">订单未找到</h2>
          <p className="text-sm text-gray-500">{error || '请检查订单号是否正确'}</p>
          <p className="mt-2 font-mono text-sm text-gray-400">订单号：{orderNo}</p>
        </div>
      </div>
    );
  }

  const statusInfo = ORDER_STATUS_MAP[order.status] || ORDER_STATUS_MAP.pending;
  const payInfo = PAY_STATUS_MAP[order.payStatus] || PAY_STATUS_MAP.unpaid;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-brand-navy py-8 md:py-12">
        <div className="container-page text-center text-white">
          <StatusIcon className="mx-auto mb-3 h-10 w-10 text-brand-gold" />
          <h1 className="text-xl font-bold md:text-2xl">{statusInfo.label}</h1>
          <p className="mt-1 font-mono text-sm text-gray-300">订单号：{order.orderNo}</p>
        </div>
      </section>

      <div className="container-page -mt-4 max-w-2xl space-y-5 pb-12">
        {/* Order Status Card */}
        <div className="rounded-2xl bg-white p-5 shadow-sm md:p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-500">订单信息</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">订单状态</span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">支付状态</span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${payInfo.color}`}>
                {payInfo.label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">订单金额</span>
              <span className="text-lg font-bold text-brand-red">
                ¥{formatPrice(order.totalAmount)}
              </span>
            </div>
            {order.createdAt && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">下单时间</span>
                <span className="text-gray-700">
                  {new Date(order.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tree IDs */}
        <div className="rounded-2xl bg-white p-5 shadow-sm md:p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500">
            <TreePine className="h-4 w-4 text-brand-green" />
            订单树木
          </h3>
          <div className="flex flex-wrap gap-2">
            {order.treeIds.map((id) => (
              <span
                key={id}
                className="rounded-full bg-brand-green/10 px-3 py-1.5 text-xs font-medium text-brand-green"
              >
                {id}
              </span>
            ))}
          </div>
        </div>

        {/* Shipping Address */}
        <div className="rounded-2xl bg-white p-5 shadow-sm md:p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500">
            <MapPin className="h-4 w-4 text-brand-navy" />
            收货地址
          </h3>
          <p className="text-sm text-gray-800">{order.shippingAddress}</p>
        </div>

        {/* Logistics Timeline */}
        <div className="rounded-2xl bg-white p-5 shadow-sm md:p-6">
          <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-gray-500">
            <Truck className="h-4 w-4 text-brand-navy" />
            物流追踪
          </h3>

          {order.logistics.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <Clock className="mx-auto mb-2 h-8 w-8" />
              <p className="text-sm">暂无物流信息</p>
              <p className="mt-1 text-xs">订单确认后将更新物流状态</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute bottom-0 left-[17px] top-0 w-0.5 bg-gray-200" />

              <div className="space-y-0">
                {order.logistics
                  .slice()
                  .reverse()
                  .map((node, i) => {
                    const isFirst = i === 0;
                    const StepIcon = getStepIcon(node.step);
                    return (
                      <div key={i} className="relative flex gap-4 pb-6 last:pb-0">
                        {/* Icon */}
                        <div
                          className={`relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                            isFirst
                              ? 'bg-brand-navy text-white shadow-md shadow-brand-navy/30'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          <StepIcon className="h-4 w-4" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 pt-1">
                          <p
                            className={`text-sm font-semibold ${
                              isFirst ? 'text-brand-navy' : 'text-gray-700'
                            }`}
                          >
                            {node.step}
                          </p>
                          <p className="mt-0.5 text-sm text-gray-500">{node.description}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            {new Date(node.timestamp).toLocaleString('zh-CN')}
                          </p>

                          {/* Media */}
                          {node.media && node.media.length > 0 && (
                            <div className="mt-2 flex gap-2">
                              {node.media.map((url, j) => (
                                <div
                                  key={j}
                                  className="h-16 w-16 overflow-hidden rounded-lg bg-gray-100"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={`${node.step} 照片${j + 1}`}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* After Sale Note */}
        {order.afterSaleNote && (
          <div className="rounded-2xl bg-amber-50 p-5 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
              <Phone className="h-4 w-4" />
              售后备注
            </h3>
            <p className="text-sm text-amber-700">{order.afterSaleNote}</p>
          </div>
        )}

        {/* Help */}
        <div className="rounded-2xl border border-dashed border-gray-300 p-5 text-center">
          <p className="text-sm text-gray-500">
            有问题？请联系客服或通过微信咨询
          </p>
        </div>
      </div>
    </div>
  );
}
