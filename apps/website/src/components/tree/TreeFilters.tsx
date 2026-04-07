'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

interface TreeFiltersProps {
  speciesList: string[];
  mobile?: boolean;
}

export function TreeFilters({ speciesList, mobile }: TreeFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const currentSpecies = searchParams.get('species') || '';
  const currentSort = searchParams.get('sort') || '';

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page'); // Reset page on filter change
    router.push(`/trees?${params.toString()}`);
    setOpen(false);
  }

  const sortOptions = [
    { value: '', label: '默认排序' },
    { value: 'price_asc', label: '价格从低到高' },
    { value: 'price_desc', label: '价格从高到低' },
    { value: 'newest', label: '最新上架' },
  ];

  const content = (
    <div className="space-y-6">
      {/* Species filter */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">品种筛选</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyFilter('species', '')}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              !currentSpecies ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          {speciesList.map((s) => (
            <button
              key={s}
              onClick={() => applyFilter('species', s)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                currentSpecies === s ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">排序</h3>
        <div className="flex flex-wrap gap-2">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => applyFilter('sort', opt.value)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                currentSort === opt.value ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Mobile: bottom drawer trigger
  if (mobile) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm text-gray-600"
        >
          <SlidersHorizontal className="h-4 w-4" />
          筛选
          {currentSpecies && (
            <span className="rounded-full bg-brand-navy px-2 py-0.5 text-xs text-white">
              {currentSpecies}
            </span>
          )}
        </button>

        {/* Bottom drawer */}
        {open && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">筛选</h2>
                <button onClick={() => setOpen(false)}>
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>
              {content}
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop: sidebar
  return (
    <div className="rounded-xl bg-gray-50 p-5">
      {content}
    </div>
  );
}
