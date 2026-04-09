import { useState, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { fetchCareGuides } from '../../utils/api';
import './index.scss';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
const SEASON_NAMES = { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' };
const SEASON_COLORS = { spring: '#22c55e', summer: '#f59e0b', autumn: '#ef4444', winter: '#3b82f6' };

export default function CarePage() {
  const [guides, setGuides] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeSeason, setActiveSeason] = useState<typeof SEASONS[number]>('spring');

  // Determine current season
  useEffect(() => {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) setActiveSeason('spring');
    else if (month >= 6 && month <= 8) setActiveSeason('summer');
    else if (month >= 9 && month <= 11) setActiveSeason('autumn');
    else setActiveSeason('winter');
  }, []);

  useEffect(() => {
    fetchCareGuides().then(res => setGuides(res.data || [])).catch(() => {});
  }, []);

  return (
    <ScrollView scrollY className="care-page">
      <View className="header">
        <Text className="title">AI养护指南</Text>
        <Text className="desc">10大树种专业养护知识库</Text>
      </View>

      {/* Season tabs */}
      <View className="season-tabs">
        {SEASONS.map(s => (
          <View
            key={s}
            className={`season-tab ${activeSeason === s ? 'active' : ''}`}
            style={activeSeason === s ? { borderColor: SEASON_COLORS[s], color: SEASON_COLORS[s] } : {}}
            onClick={() => setActiveSeason(s)}
          >
            <Text>{SEASON_NAMES[s]}</Text>
          </View>
        ))}
      </View>

      {/* Species cards */}
      {guides.map((guide: any) => (
        <View key={guide.species} className="species-card">
          <View className="species-header" onClick={() => setExpanded(expanded === guide.species ? null : guide.species)}>
            <Text className="species-name">{guide.species}</Text>
            <Text className="expand-icon">{expanded === guide.species ? '−' : '+'}</Text>
          </View>

          <Text className="species-overview">{guide.overview}</Text>

          {/* Current season care */}
          <View className="care-block" style={{ borderLeftColor: SEASON_COLORS[activeSeason] }}>
            <Text className="care-title">{SEASON_NAMES[activeSeason]}养护要点</Text>
            <Text className="care-text">{guide.seasonal?.[activeSeason]}</Text>
          </View>

          {expanded === guide.species && (
            <View className="expanded-content">
              <View className="care-item">
                <Text className="care-label">💧 浇水</Text>
                <Text className="care-text">{guide.watering}</Text>
              </View>
              <View className="care-item">
                <Text className="care-label">🌱 施肥</Text>
                <Text className="care-text">{guide.fertilizing}</Text>
              </View>
              <View className="care-item">
                <Text className="care-label">✂️ 修剪</Text>
                <Text className="care-text">{guide.pruning}</Text>
              </View>
              <View className="care-item">
                <Text className="care-label">🛡️ 防虫</Text>
                <Text className="care-text">{guide.pestControl}</Text>
              </View>
              {guide.tips?.length > 0 && (
                <View className="tips-block">
                  <Text className="care-label">💡 小贴士</Text>
                  {guide.tips.map((tip: string, i: number) => (
                    <Text key={i} className="tip-item">· {tip}</Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
