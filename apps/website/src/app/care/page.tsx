'use client';

import { useState, useEffect } from 'react';
import {
  Leaf,
  Droplets,
  Scissors,
  Bug,
  Loader2,
  TreePine,
  Sun,
  Snowflake,
  CloudRain,
  Wind,
  Lightbulb,
  Sprout,
} from 'lucide-react';
import { getCareGuides, type CareGuide } from '@/lib/api';

const SEASON_TABS = [
  { key: 'spring', label: '春', icon: Sprout, color: 'text-green-600 bg-green-50 border-green-200' },
  { key: 'summer', label: '夏', icon: Sun, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { key: 'autumn', label: '秋', icon: Wind, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { key: 'winter', label: '冬', icon: Snowflake, color: 'text-blue-600 bg-blue-50 border-blue-200' },
] as const;

type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';

const CARE_FIELDS = [
  { key: 'watering' as const, label: '浇水', icon: Droplets, color: 'text-blue-500' },
  { key: 'fertilizing' as const, label: '施肥', icon: Leaf, color: 'text-green-500' },
  { key: 'pruning' as const, label: '修剪', icon: Scissors, color: 'text-amber-600' },
  { key: 'pestControl' as const, label: '病虫害防治', icon: Bug, color: 'text-red-500' },
];

export default function CarePage() {
  const [guides, setGuides] = useState<CareGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSeasons, setActiveSeasons] = useState<Record<number, SeasonKey>>({});

  useEffect(() => {
    getCareGuides()
      .then((res) => {
        if (res.success && res.data) {
          setGuides(res.data);
          // Default all cards to current season
          const month = new Date().getMonth();
          let defaultSeason: SeasonKey = 'spring';
          if (month >= 2 && month <= 4) defaultSeason = 'spring';
          else if (month >= 5 && month <= 7) defaultSeason = 'summer';
          else if (month >= 8 && month <= 10) defaultSeason = 'autumn';
          else defaultSeason = 'winter';

          const defaults: Record<number, SeasonKey> = {};
          res.data.forEach((_, i) => {
            defaults[i] = defaultSeason;
          });
          setActiveSeasons(defaults);
        } else {
          setError(res.error?.message || '获取养护指南失败');
        }
      })
      .catch(() => setError('网络错误，无法加载数据'))
      .finally(() => setLoading(false));
  }, []);

  function setSeasonForCard(cardIndex: number, season: SeasonKey) {
    setActiveSeasons((prev) => ({ ...prev, [cardIndex]: season }));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-[#1F3864] py-10 md:py-16">
        <div className="container-page text-center text-white">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#BF8F00]/20">
            <TreePine className="h-8 w-8 text-[#BF8F00]" />
          </div>
          <h1 className="text-2xl font-bold md:text-3xl">AI 树木养护指南</h1>
          <p className="mt-2 text-sm text-gray-300 md:text-base">
            基于AI智能分析，为您提供专业的四季养护建议
          </p>
          <div className="mt-5 flex items-center justify-center gap-6">
            {SEASON_TABS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex flex-col items-center gap-1">
                  <Icon className="h-5 w-5 text-gray-300" />
                  <span className="text-xs text-gray-400">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="container-page -mt-4 max-w-4xl pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="mr-2 h-6 w-6 animate-spin text-[#1F3864]" />
            <span className="text-sm text-gray-500">加载养护指南...</span>
          </div>
        ) : error ? (
          <div className="py-20 text-center">
            <CloudRain className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        ) : guides.length === 0 ? (
          <div className="py-20 text-center">
            <TreePine className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p className="text-sm text-gray-500">养护指南即将上线，敬请期待</p>
          </div>
        ) : (
          <div className="space-y-6">
            {guides.map((guide, cardIndex) => {
              const activeSeason: SeasonKey = (activeSeasons[cardIndex] as SeasonKey) || 'spring';
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const guideAny = guide as any;
              const seasonData = (guideAny.seasons || guideAny.seasonal)?.[activeSeason] || {} as Record<string, string>;
              const activeTab = SEASON_TABS.find((t) => t.key === activeSeason)!;

              return (
                <div
                  key={cardIndex}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm"
                >
                  {/* Card Header */}
                  <div className="border-b bg-gradient-to-r from-[#1F3864] to-[#2a4a7a] p-5 md:p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                        <TreePine className="h-5 w-5 text-[#BF8F00]" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">{guide.species}</h2>
                        <p className="mt-0.5 text-xs text-gray-300">{guide.overview}</p>
                      </div>
                    </div>
                  </div>

                  {/* Season Tabs */}
                  <div className="flex border-b">
                    {SEASON_TABS.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeSeason === tab.key;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setSeasonForCard(cardIndex, tab.key)}
                          className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-all ${
                            isActive
                              ? 'border-b-2 border-[#1F3864] bg-[#1F3864]/5 text-[#1F3864]'
                              : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {tab.label}季
                        </button>
                      );
                    })}
                  </div>

                  {/* Season Care Content */}
                  <div className="p-5 md:p-6">
                    {/* Season summary text */}
                    {typeof seasonData === 'string' && (
                      <div className="mb-4 rounded-xl border-l-4 border-brand-gold bg-amber-50 p-4">
                        <p className="text-sm leading-relaxed text-gray-700">{seasonData}</p>
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {CARE_FIELDS.map((field) => {
                        const Icon = field.icon;
                        const value = (guide as any)?.[field.key] || (typeof seasonData === 'object' ? seasonData?.[field.key] : undefined);
                        if (!value) return null;
                        return (
                          <div
                            key={field.key}
                            className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${field.color}`} />
                              <h4 className="text-sm font-semibold text-gray-800">{field.label}</h4>
                            </div>
                            <p className="text-sm leading-relaxed text-gray-600">{value}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tips */}
                  {guide.tips && guide.tips.length > 0 && (
                    <div className="border-t bg-[#BF8F00]/5 p-5 md:p-6">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#BF8F00]">
                        <Lightbulb className="h-4 w-4" />
                        养护小贴士
                      </h4>
                      <ul className="space-y-2">
                        {guide.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#BF8F00]/10 text-xs font-bold text-[#BF8F00]">
                              {i + 1}
                            </span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-10 rounded-2xl bg-gradient-to-r from-[#1F3864] to-[#2a4a7a] p-6 text-center text-white md:p-8">
          <h3 className="mb-2 text-lg font-bold">需要专业养护建议？</h3>
          <p className="mb-5 text-sm text-gray-300">
            红艺花木提供终身养护支持，AI管家24小时在线
          </p>
          <a href="/contact" className="btn-gold">
            联系专业顾问
          </a>
        </div>
      </div>
    </div>
  );
}
