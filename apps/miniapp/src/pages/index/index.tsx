import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Swiper, SwiperItem } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { fetchTrees, fetchTreeStats } from '../../utils/api';
import './index.scss';

export default function IndexPage() {
  const [featuredTrees, setFeaturedTrees] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [treesRes, statsRes] = await Promise.all([
        fetchTrees({ limit: 6, sort: '-createdAt' }),
        fetchTreeStats().catch(() => null),
      ]);
      setFeaturedTrees(treesRes.data || []);
      if (statsRes) setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to load home data', err);
    } finally {
      setLoading(false);
    }
  }

  function goToTrees() {
    Taro.switchTab({ url: '/pages/trees/index' });
  }

  function goToTreeDetail(id: string) {
    Taro.navigateTo({ url: `/pages/tree-detail/index?id=${id}` });
  }

  function goToContact() {
    Taro.navigateTo({ url: '/pages/contact/index' });
  }

  return (
    <ScrollView scrollY className='home-page'>
      {/* Hero Banner */}
      <View className='hero'>
        <View className='hero-overlay'>
          <Text className='hero-title'>红艺花木</Text>
          <Text className='hero-subtitle'>11年专业苗木 / AI智能方案</Text>
          <View className='hero-stats'>
            {stats && (
              <>
                <View className='stat-item'>
                  <Text className='stat-num'>{stats.totalTrees || 0}</Text>
                  <Text className='stat-label'>精品树木</Text>
                </View>
                <View className='stat-item'>
                  <Text className='stat-num'>{stats.totalSpecies || 0}</Text>
                  <Text className='stat-label'>树种品类</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View className='actions'>
        <View className='action-item' onClick={goToTrees}>
          <View className='action-icon action-icon-tree'>
            <Text className='icon-text'>🌳</Text>
          </View>
          <Text className='action-label'>精品树木</Text>
        </View>
        <View className='action-item' onClick={() => Taro.switchTab({ url: '/pages/styles/index' })}>
          <View className='action-icon action-icon-style'>
            <Text className='icon-text'>🏡</Text>
          </View>
          <Text className='action-label'>庭院风格</Text>
        </View>
        <View className='action-item' onClick={goToContact}>
          <View className='action-icon action-icon-ai'>
            <Text className='icon-text'>🤖</Text>
          </View>
          <Text className='action-label'>AI方案</Text>
        </View>
        <View className='action-item' onClick={goToContact}>
          <View className='action-icon action-icon-contact'>
            <Text className='icon-text'>📞</Text>
          </View>
          <Text className='action-label'>联系我们</Text>
        </View>
      </View>

      {/* Featured Trees */}
      <View className='section'>
        <View className='section-header'>
          <Text className='section-title'>精选树木</Text>
          <Text className='section-more' onClick={goToTrees}>查看全部 &gt;</Text>
        </View>

        {loading ? (
          <Text className='loading-text'>加载中...</Text>
        ) : featuredTrees.length === 0 ? (
          <Text className='empty-text'>暂无树木数据</Text>
        ) : (
          <View className='tree-grid'>
            {featuredTrees.map((tree) => (
              <View
                key={tree._id}
                className='tree-card'
                onClick={() => goToTreeDetail(tree._id)}
              >
                <Image
                  className='tree-image'
                  src={tree.images?.[0] || ''}
                  mode='aspectFill'
                />
                <View className='tree-info'>
                  <Text className='tree-name'>{tree.name || tree.species}</Text>
                  <Text className='tree-specs'>
                    {tree.specs?.height ? `高${tree.specs.height}cm` : ''}
                    {tree.specs?.diameter ? ` 径${tree.specs.diameter}cm` : ''}
                  </Text>
                  <Text className='tree-price'>
                    ¥{tree.price?.toLocaleString() || '面议'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* AI Section */}
      <View className='ai-section'>
        <View className='ai-content'>
          <Text className='ai-title'>AI智能庭院方案</Text>
          <Text className='ai-desc'>
            上传您的庭院照片，AI为您定制专属绿化方案
          </Text>
          <View className='ai-btn' onClick={goToContact}>
            <Text className='ai-btn-text'>立即咨询</Text>
          </View>
        </View>
      </View>

      <View className='footer'>
        <Text className='footer-text'>红艺花木 · 11年专业品质</Text>
      </View>
    </ScrollView>
  );
}
