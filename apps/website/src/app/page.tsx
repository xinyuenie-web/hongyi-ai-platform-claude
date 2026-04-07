import Image from 'next/image';
import Link from 'next/link';
import { TreePine, Camera, Truck, Shield, ArrowRight } from 'lucide-react';
import { getTreeList } from '@/lib/api';
import { TreeCard } from '@/components/tree/TreeCard';

// ISR: revalidate every 1 hour
export const revalidate = 3600;

export default async function HomePage() {
  const treesRes = await getTreeList({ limit: 6, status: 'available' }).catch(() => null);
  const trees = treesRes?.data || [];

  return (
    <>
      {/* ========== Hero Section ========== */}
      <section className="relative overflow-hidden bg-brand-navy">
        {/* Mobile: poster full-width */}
        <div className="relative md:hidden">
          <Image
            src="/images/hero-poster.png"
            alt="AI · 红艺花木 - 高端庭院别墅造型花木解决方案"
            width={800}
            height={1000}
            className="w-full"
            priority
          />
          {/* Gradient overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-brand-navy/90 via-brand-navy/50 to-transparent p-6 pt-20">
            <div className="flex flex-col gap-3">
              <Link href="/contact" className="btn-gold w-full text-center text-base">
                免费AI方案体验
              </Link>
              <Link href="/trees" className="btn-outline w-full border-white text-center text-base text-white hover:bg-white hover:text-brand-navy">
                浏览精品树木
              </Link>
            </div>
          </div>
        </div>

        {/* Desktop: poster left + text right */}
        <div className="container-page hidden md:flex md:items-center md:gap-12 md:py-16 lg:py-20">
          <div className="w-1/2 flex-shrink-0 lg:w-[45%]">
            <Image
              src="/images/hero-poster.png"
              alt="AI · 红艺花木 - 高端庭院别墅造型花木解决方案"
              width={800}
              height={1000}
              className="rounded-2xl shadow-2xl"
              priority
            />
          </div>
          <div className="flex-1 text-white">
            <p className="mb-3 text-sm font-medium tracking-wider text-brand-gold">
              全国首家AI驱动
            </p>
            <h1 className="mb-4 text-4xl font-bold leading-tight lg:text-5xl">
              私家庭院
              <br />
              <span className="text-brand-gold">造型花木</span>
              <br />
              一站式服务商
            </h1>
            <p className="mb-8 text-lg leading-relaxed text-gray-300">
              上传庭院照片，AI秒出设计方案。
              <br />
              看效果 → 选好树 → 下订单 → 全程追踪。
              <br />
              11年专业经验，百亩基地产地直供。
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/contact" className="btn-gold text-base">
                免费AI方案体验
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/trees" className="btn-outline border-white text-base text-white hover:bg-white hover:text-brand-navy">
                浏览精品树木
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========== Trust Metrics ========== */}
      <section className="border-b bg-gray-50 py-6 md:py-8">
        <div className="container-page">
          <div className="flex items-center justify-between gap-4 overflow-x-auto md:justify-center md:gap-16">
            {[
              { num: '11年', label: '专业经验' },
              { num: '100亩', label: '基地直供' },
              { num: 'AI', label: '智能方案' },
              { num: '全程', label: '可视交付' },
            ].map((item) => (
              <div key={item.label} className="flex flex-shrink-0 flex-col items-center">
                <span className="text-xl font-bold text-brand-navy md:text-2xl">{item.num}</span>
                <span className="text-xs text-gray-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== Featured Trees ========== */}
      <section className="py-10 md:py-16">
        <div className="container-page">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-brand-navy md:text-3xl">精品树木</h2>
              <p className="mt-1 text-sm text-gray-500">每棵树都有唯一身份档案，基地实拍</p>
            </div>
            <Link
              href="/trees"
              className="hidden items-center text-sm font-medium text-brand-navy hover:text-brand-gold md:flex"
            >
              查看全部 <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {trees.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
              {trees.map((tree) => (
                <TreeCard key={tree.treeId} tree={tree} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-gray-400">
              <TreePine className="mx-auto mb-3 h-12 w-12" />
              <p>精品树木即将上架，敬请期待</p>
            </div>
          )}

          <Link
            href="/trees"
            className="mt-6 flex items-center justify-center text-sm font-medium text-brand-navy hover:text-brand-gold md:hidden"
          >
            查看全部树木 <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ========== AI Design CTA ========== */}
      <section className="bg-gradient-to-r from-brand-navy to-brand-green-dark py-12 md:py-16">
        <div className="container-page text-center text-white">
          <h2 className="mb-3 text-2xl font-bold md:text-3xl">AI 庭院方案，30秒出图</h2>
          <p className="mx-auto mb-8 max-w-lg text-sm text-gray-300 md:text-base">
            上传一张庭院照片，AI自动分析风水格局，生成多角度效果图，推荐适配树种，一键获取报价。
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/contact" className="btn-gold w-full text-base sm:w-auto">
              <Camera className="mr-2 h-5 w-5" />
              上传照片，免费体验
            </Link>
          </div>
        </div>
      </section>

      {/* ========== Service Flow ========== */}
      <section className="py-10 md:py-16">
        <div className="container-page">
          <h2 className="mb-8 text-center text-2xl font-bold text-brand-navy md:text-3xl">
            服务流程
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {[
              { icon: Camera, title: 'AI出方案', desc: '上传庭院照片，秒生效果图' },
              { icon: TreePine, title: '远程选树', desc: '千里之外，如临基地' },
              { icon: Truck, title: '全程追踪', desc: '像查快递一样查看树木状态' },
              { icon: Shield, title: '终身养护', desc: 'AI管家，买树才是服务的开始' },
            ].map((item) => (
              <div key={item.title} className="rounded-xl bg-gray-50 p-5 text-center">
                <item.icon className="mx-auto mb-3 h-8 w-8 text-brand-green" />
                <h3 className="mb-1 text-sm font-semibold text-brand-navy">{item.title}</h3>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
