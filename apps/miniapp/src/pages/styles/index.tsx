import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { fetchGardenStyles } from '../../utils/api';
import './index.scss';

export default function StylesPage() {
  const [styles, setStyles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStyles();
  }, []);

  async function loadStyles() {
    try {
      const res = await fetchGardenStyles();
      setStyles(res.data || []);
    } catch (err) {
      console.error('Failed to load styles', err);
    } finally {
      setLoading(false);
    }
  }

  function goToContact(styleName: string) {
    Taro.navigateTo({
      url: `/pages/contact/index?style=${encodeURIComponent(styleName)}`,
    });
  }

  return (
    <ScrollView scrollY className='styles-page'>
      <View className='page-header'>
        <Text className='page-title'>庭院风格</Text>
        <Text className='page-subtitle'>专业设计团队，打造您的理想庭院</Text>
      </View>

      {loading ? (
        <Text className='loading-text'>加载中...</Text>
      ) : styles.length === 0 ? (
        <View className='empty-container'>
          <Text className='empty-icon'>🏡</Text>
          <Text className='empty-text'>暂无风格数据</Text>
        </View>
      ) : (
        <View className='styles-list'>
          {styles.map((style) => (
            <View key={style._id} className='style-card'>
              {style.coverImage && (
                <Image
                  className='style-image'
                  src={style.coverImage}
                  mode='aspectFill'
                />
              )}
              <View className='style-content'>
                <Text className='style-name'>{style.name}</Text>
                {style.description && (
                  <Text className='style-desc'>{style.description}</Text>
                )}
                {style.features && style.features.length > 0 && (
                  <View className='style-features'>
                    {style.features.slice(0, 4).map((feat: string, idx: number) => (
                      <Text key={idx} className='feature-tag'>{feat}</Text>
                    ))}
                  </View>
                )}
                {style.recommendedTrees && style.recommendedTrees.length > 0 && (
                  <View className='recommended'>
                    <Text className='recommended-label'>推荐树种：</Text>
                    <Text className='recommended-text'>
                      {style.recommendedTrees.slice(0, 5).join('、')}
                    </Text>
                  </View>
                )}
                <View
                  className='style-btn'
                  onClick={() => goToContact(style.name)}
                >
                  <Text className='style-btn-text'>咨询此风格</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      <View className='bottom-spacer' />
    </ScrollView>
  );
}
