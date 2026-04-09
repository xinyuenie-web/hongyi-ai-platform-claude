import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTree, getTreeList } from '@/lib/api';
import { formatPrice, formatSpecs, TREE_STATUS_MAP, TREE_SPECIES } from '@hongyi/shared';
import { TreeCard } from '@/components/tree/TreeCard';
import { Phone, MapPin, ArrowLeft, Shield, Droplets, Sun } from 'lucide-react';

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const res = await getTree(id).catch(() => null);
  if (!res?.data) return { title: '树木详情' };

  const tree = res.data;
  return {
    title: `${tree.name} | ${tree.species} 造型树`,
    description: `${tree.name}，${tree.species}造型树，高${tree.specs.height}cm，冠幅${tree.specs.crown}cm，价格¥${tree.price.sale}。浏阳红艺花木基地直供，一树一档。`,
    openGraph: {
      images: tree.coverImage ? [tree.coverImage] : [],
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function TreeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const res = await getTree(id).catch(() => null);
  if (!res?.data) notFound();

  const tree = res.data;
  const statusText = TREE_STATUS_MAP[tree.status] || tree.status;
  const speciesInfo = TREE_SPECIES[tree.species];

  // Get similar trees
  const similarRes = await getTreeList({ species: tree.species, limit: 4, status: 'available' }).catch(() => null);
  const similarTrees = (similarRes?.data || []).filter((t) => t.treeId !== tree.treeId).slice(0, 3);

  const allImages = [tree.coverImage, ...tree.images].filter(Boolean);

  return (
    <div className="container-page py-4 md:py-8">
      {/* Back link */}
      <Link
        href="/trees"
        className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-brand-navy"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> 返回列表
      </Link>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Left: Images */}
        <div className="lg:w-1/2">
          {/* Main image */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-gray-100">
            <Image
              src={allImages[0] || '/images/tree-placeholder.jpg'}
              alt={tree.name}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <span className="absolute left-3 top-3 rounded-full bg-brand-green px-3 py-1 text-sm font-medium text-white">
              {statusText}
            </span>
          </div>

          {/* Thumbnails */}
          {allImages.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
              {allImages.map((img, i) => (
                <div
                  key={i}
                  className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 md:h-20 md:w-20"
                >
                  <Image
                    src={img}
                    alt={`${tree.name} ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Info */}
        <div className="flex-1">
          <div className="mb-1 text-xs text-gray-400">{tree.treeId}</div>
          <h1 className="mb-2 text-2xl font-bold text-brand-navy md:text-3xl">{tree.name}</h1>

          {tree.fengshui?.symbol && (
            <p className="mb-4 text-sm text-brand-gold">{tree.fengshui.symbol}</p>
          )}

          {/* Price */}
          <div className="mb-6 rounded-xl bg-red-50 p-4">
            <span className="text-3xl font-bold text-brand-red">
              ¥{formatPrice(tree.price.sale)}
            </span>
            <span className="ml-2 text-sm text-gray-500">产地直供价</span>
          </div>

          {/* Specs table */}
          <div className="mb-6 rounded-xl border">
            <h3 className="border-b px-4 py-3 text-sm font-semibold text-brand-navy">
              树木规格档案
            </h3>
            <div className="divide-y text-sm">
              {(
                [
                  ['品种', tree.species],
                  ['规格', formatSpecs(tree.specs.height, tree.specs.crown)],
                  ['高度', `${tree.specs.height} cm`],
                  ['冠幅', `${tree.specs.crown} cm`],
                  tree.specs.trunkDiameter ? ['胸径', `${tree.specs.trunkDiameter} cm`] : null,
                  tree.age ? ['树龄', `约${tree.age}年`] : null,
                  tree.location ? ['所在基地', tree.location] : null,
                  tree.health?.grade ? ['健康等级', tree.health.grade + '级'] : null,
                ] as (string[] | null)[]
              )
                .filter((row): row is string[] => row !== null)
                .map(([label, value]) => (
                  <div key={label} className="flex justify-between px-4 py-2.5">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-800">{value}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Fengshui */}
          {tree.fengshui && (
            <div className="mb-6 rounded-xl bg-amber-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-brand-gold">风水寓意</h3>
              <p className="text-sm text-gray-700">{tree.fengshui.symbol}</p>
              {tree.fengshui.positions.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  适宜方位：{tree.fengshui.positions.join('、')}
                </p>
              )}
              {tree.fengshui.element && (
                <p className="mt-1 text-xs text-gray-500">五行属性：{tree.fengshui.element}</p>
              )}
            </div>
          )}

          {/* Species info */}
          {speciesInfo && (
            <div className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-brand-navy">品种介绍</h3>
              <p className="text-sm leading-relaxed text-gray-600">{speciesInfo.description}</p>
              <div className="mt-3 flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Droplets className="h-3.5 w-3.5" />
                  养护难度：{'★'.repeat(speciesInfo.careDifficulty)}{'☆'.repeat(5 - speciesInfo.careDifficulty)}
                </span>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/contact" className="btn-primary flex-1 text-center">
              <Phone className="mr-2 h-4 w-4" /> 咨询 / 预约看树
            </Link>
            <a
              href="tel:13607449139"
              className="btn-outline flex-1 text-center"
            >
              电话联系
            </a>
          </div>
        </div>
      </div>

      {/* Mobile fixed bottom bar */}
      <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-3 md:hidden">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <span className="text-xl font-bold text-brand-red">¥{formatPrice(tree.price.sale)}</span>
          </div>
          <a href="tel:13607449139" className="btn-outline px-4 py-2.5 text-sm">
            电话
          </a>
          <Link href="/contact" className="btn-primary px-4 py-2.5 text-sm">
            咨询方案
          </Link>
        </div>
      </div>

      {/* Similar trees */}
      {similarTrees.length > 0 && (
        <section className="mt-12 border-t pt-8">
          <h2 className="mb-4 text-xl font-bold text-brand-navy">同品种推荐</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {similarTrees.map((t) => (
              <TreeCard key={t.treeId} tree={t} />
            ))}
          </div>
        </section>
      )}

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: tree.name,
            description: `${tree.species}造型树，高${tree.specs.height}cm，冠幅${tree.specs.crown}cm`,
            image: allImages,
            sku: tree.treeId,
            offers: {
              '@type': 'Offer',
              price: tree.price.sale,
              priceCurrency: 'CNY',
              availability: tree.status === 'available'
                ? 'https://schema.org/InStock'
                : 'https://schema.org/SoldOut',
            },
            brand: {
              '@type': 'Brand',
              name: '红艺花木',
            },
          }),
        }}
      />
    </div>
  );
}
