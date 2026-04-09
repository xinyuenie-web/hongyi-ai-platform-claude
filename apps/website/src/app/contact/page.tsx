import type { Metadata } from 'next';
import { ContactForm } from '@/components/contact/ContactForm';
import { Phone, MapPin, MessageCircle, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: '联系我们',
  description: '联系红艺花木，获取专属庭院造型花木方案。微信/电话：13607449139',
};

export default function ContactPage() {
  return (
    <div className="container-page py-6 md:py-12">
      <h1 className="mb-2 text-2xl font-bold text-brand-navy md:text-3xl">联系我们</h1>
      <p className="mb-8 text-sm text-gray-500">
        获取专属庭院方案，或直接咨询选树建议
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Contact info */}
        <div>
          <div className="mb-8 space-y-4">
            {[
              {
                icon: Phone,
                title: '电话 / 微信',
                content: '聂先生 13607449139',
                sub: '微信同号，随时咨询',
              },
              {
                icon: MessageCircle,
                title: '微信公众号',
                content: '红艺花木',
                sub: '关注获取最新资讯和优惠',
              },
              {
                icon: MapPin,
                title: '基地地址',
                content: '湖南省浏阳市',
                sub: '百亩基地，欢迎实地参观',
              },
              {
                icon: Clock,
                title: '服务时间',
                content: '全年无休 8:00 - 20:00',
                sub: '紧急事宜可随时联系',
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-4 rounded-xl bg-gray-50 p-4">
                <item.icon className="h-6 w-6 flex-shrink-0 text-brand-green" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                  <p className="text-sm text-brand-navy">{item.content}</p>
                  <p className="text-xs text-gray-400">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* WeChat QR */}
          <div className="rounded-xl bg-green-50 p-6 text-center">
            <img
              src="/images/wechat-qr.jpg"
              alt="聂兴富微信二维码"
              className="mx-auto mb-3 h-40 w-40 rounded-xl object-cover"
            />
            <p className="text-sm font-medium text-green-700">扫码添加微信</p>
            <p className="text-xs text-green-600">获取专属庭院方案</p>
          </div>
        </div>

        {/* Contact form */}
        <div>
          <div className="rounded-xl border p-6">
            <h2 className="mb-4 text-lg font-bold text-brand-navy">在线留言</h2>
            <p className="mb-6 text-sm text-gray-500">
              留下您的信息，我们将在24小时内联系您
            </p>
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
