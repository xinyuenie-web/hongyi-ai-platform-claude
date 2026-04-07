import type { Metadata } from 'next';
import { getTreeList, getSpeciesList } from '@/lib/api';
import { TreeCard } from '@/components/tree/TreeCard';
import { TreeFilters } from '@/components/tree/TreeFilters';
import { TreePine } from 'lucide-react';

export const metadata: Metadata = {
  title: '精品造型树木',
  description:
    '红艺花木精品造型树木产品中心。罗汉松、黑松、五针松、榆树桩、红花檵木、对接白蜡、紫薇、大阪松、黄杨、枸骨等高端造型树木，每棵树都有唯一身份档案。',
};

export const revalidate = 1800; // 30 min

interface PageProps {
  searchParams: {
    species?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    page?: string;
  };
}

export default async function TreesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || '1');

  const [treesRes, speciesRes] = await Promise.all([
    getTreeList({
      page,
      limit: 12,
      species: params.species,
      minPrice: params.minPrice ? Number(params.minPrice) : undefined,
      maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
      sort: params.sort,
      status: 'available',
    }).catch(() => null),
    getSpeciesList().catch(() => null),
  ]);

  const trees = treesRes?.data || [];
  const speciesList = speciesRes?.data || [];
  const pagination = treesRes?.pagination;

  return (
    <div className="container-page py-6 md:py-10">
      <h1 className="mb-2 text-2xl font-bold text-brand-navy md:text-3xl">精品造型树木</h1>
      <p className="mb-6 text-sm text-gray-500">
        每棵树都有唯一身份档案 · 基地实拍 · 产地直供
      </p>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Filters - desktop sidebar */}
        <aside className="hidden w-60 flex-shrink-0 lg:block">
          <TreeFilters speciesList={speciesList} />
        </aside>

        {/* Tree grid */}
        <div className="flex-1">
          {/* Mobile filter bar */}
          <div className="mb-4 lg:hidden">
            <TreeFilters speciesList={speciesList} mobile />
          </div>

          {trees.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4">
                {trees.map((tree) => (
                  <TreeCard key={tree.treeId} tree={tree} />
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                    <a
                      key={p}
                      href={`/trees?${new URLSearchParams({
                        ...params,
                        page: String(p),
                      }).toString()}`}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm ${
                        p === page
                          ? 'bg-brand-navy text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {p}
                    </a>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-gray-400">
              <TreePine className="mx-auto mb-3 h-12 w-12" />
              <p>暂无匹配的树木，试试其他筛选条件</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
