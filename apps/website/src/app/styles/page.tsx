import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getGardenStyles } from '@/lib/api';
import { GARDEN_STYLE_MAP } from '@hongyi/shared';

export const metadata: Metadata = {
  title: '庭院风格方案',
  description: '五种经典庭院风格方案：现代简约、新中式、欧式古典、日式禅意、田园托斯卡纳。AI智能匹配，为您的庭院定制专属造型花木方案。',
};

export const revalidate = 3600;

export default async function StylesPage() {
  const res = await getGardenStyles().catch(() => null);
  const styles = res?.data || [];

  return (
    <div className="container-page py-6 md:py-12">
      <h1 className="mb-2 text-2xl font-bold text-brand-navy md:text-3xl">庭院风格方案</h1>
      <p className="mb-8 text-sm text-gray-500">
        五种经典风格，AI智能匹配您的庭院
      </p>

      <div className="space-y-6">
        {styles.map((style, idx) => (
          <div
            key={style.styleId}
            className="overflow-hidden rounded-xl border bg-white"
          >
            <div className={`flex flex-col ${idx % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
              {/* Image */}
              <div className="relative aspect-video bg-gray-100 md:aspect-auto md:w-2/5">
                <Image
                  src={style.image || '/images/tree-placeholder.jpg'}
                  alt={style.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 40vw"
                />
              </div>

              {/* Content */}
              <div className="flex-1 p-5 md:p-8">
                <div className="mb-2 text-xs font-medium text-brand-gold">
                  {style.styleId}
                </div>
                <h2 className="mb-3 text-xl font-bold text-brand-navy">{style.name}</h2>

                {style.keywords.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {style.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-full bg-brand-navy/5 px-2.5 py-0.5 text-xs text-brand-navy"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mb-4 text-sm leading-relaxed text-gray-600">
                  {style.atmosphere}
                </p>

                {style.elements && (
                  <div className="mb-4">
                    <h3 className="mb-1 text-xs font-semibold text-gray-500">核心庭院元素</h3>
                    <p className="text-sm text-gray-700">{style.elements}</p>
                  </div>
                )}

                <Link href="/contact" className="btn-primary text-sm">
                  获取该风格方案
                </Link>
              </div>
            </div>
          </div>
        ))}

        {styles.length === 0 && (
          <div className="py-20 text-center text-gray-400">
            <p>庭院风格方案加载中...</p>
          </div>
        )}
      </div>
    </div>
  );
}
