import { useEffect, useState } from 'react';
import { View, Text, Image, Swiper, SwiperItem, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { fetchTree } from '../../utils/api';
import './index.scss';

export default function TreeDetailPage() {
  const router = useRouter();
  const [tree, setTree] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const id = router.params.id;
    if (id) {
      loadTree(id);
    }
  }, []);

  async function loadTree(id: string) {
    try {
      const res = await fetchTree(id);
      setTree(res.data);
      Taro.setNavigationBarTitle({
        title: res.data?.name || res.data?.species || '树木详情',
      });
    } catch (err) {
      console.error('Failed to load tree', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }

  function handleContact() {
    Taro.navigateTo({
      url: `/pages/contact/index?treeId=${tree?._id}&treeName=${encodeURIComponent(tree?.name || tree?.species || '')}`,
    });
  }

  function handleCall() {
    Taro.makePhoneCall({ phoneNumber: '13800138000' }).catch(() => {});
  }

  function previewImage(current: string) {
    Taro.previewImage({
      current,
      urls: tree?.images || [current],
    });
  }

  if (loading) {
    return (
      <View className='detail-page'>
        <Text className='loading-text'>加载中...</Text>
      </View>
    );
  }

  if (!tree) {
    return (
      <View className='detail-page'>
        <Text className='empty-text'>未找到树木信息</Text>
      </View>
    );
  }

  const images = tree.images || [];

  return (
    <ScrollView scrollY className='detail-page'>
      {/* Image Swiper */}
      {images.length > 0 ? (
        <View className='swiper-container'>
          <Swiper
            className='image-swiper'
            indicatorDots={false}
            circular
            autoplay
            interval={4000}
            onChange={(e) => setCurrentSlide(e.detail.current)}
          >
            {images.map((img: string, idx: number) => (
              <SwiperItem key={idx}>
                <Image
                  className='swiper-image'
                  src={img}
                  mode='aspectFill'
                  onClick={() => previewImage(img)}
                />
              </SwiperItem>
            ))}
          </Swiper>
          <View className='swiper-indicator'>
            <Text className='indicator-text'>
              {currentSlide + 1}/{images.length}
            </Text>
          </View>
        </View>
      ) : (
        <View className='no-image'>
          <Text className='no-image-text'>暂无图片</Text>
        </View>
      )}

      {/* Basic Info */}
      <View className='info-card'>
        <View className='price-row'>
          <Text className='price'>¥{tree.price?.toLocaleString() || '面议'}</Text>
          {tree.originalPrice && tree.originalPrice > tree.price && (
            <Text className='original-price'>¥{tree.originalPrice.toLocaleString()}</Text>
          )}
        </View>
        <Text className='tree-name'>{tree.name || tree.species}</Text>
        <Text className='tree-species'>{tree.species}</Text>
        {tree.description && (
          <Text className='tree-desc'>{tree.description}</Text>
        )}
      </View>

      {/* Specs */}
      <View className='specs-card'>
        <Text className='card-title'>规格参数</Text>
        <View className='specs-grid'>
          {tree.specs?.height && (
            <View className='spec-item'>
              <Text className='spec-label'>高度</Text>
              <Text className='spec-value'>{tree.specs.height}cm</Text>
            </View>
          )}
          {tree.specs?.diameter && (
            <View className='spec-item'>
              <Text className='spec-label'>地径</Text>
              <Text className='spec-value'>{tree.specs.diameter}cm</Text>
            </View>
          )}
          {tree.specs?.crown && (
            <View className='spec-item'>
              <Text className='spec-label'>冠幅</Text>
              <Text className='spec-value'>{tree.specs.crown}cm</Text>
            </View>
          )}
          {tree.specs?.branchPoint && (
            <View className='spec-item'>
              <Text className='spec-label'>分枝点</Text>
              <Text className='spec-value'>{tree.specs.branchPoint}cm</Text>
            </View>
          )}
          {tree.age && (
            <View className='spec-item'>
              <Text className='spec-label'>树龄</Text>
              <Text className='spec-value'>{tree.age}年</Text>
            </View>
          )}
          {tree.location && (
            <View className='spec-item'>
              <Text className='spec-label'>产地</Text>
              <Text className='spec-value'>{tree.location}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Tags */}
      {tree.tags && tree.tags.length > 0 && (
        <View className='tags-card'>
          <Text className='card-title'>特征标签</Text>
          <View className='tags-list'>
            {tree.tags.map((tag: string, idx: number) => (
              <Text key={idx} className='tag-item'>{tag}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Bottom CTA */}
      <View className='bottom-bar'>
        <View className='bottom-call' onClick={handleCall}>
          <Text className='call-icon'>📞</Text>
          <Text className='call-text'>电话</Text>
        </View>
        <View className='bottom-inquiry' onClick={handleContact}>
          <Text className='inquiry-text'>立即咨询</Text>
        </View>
      </View>

      {/* Spacer for bottom bar */}
      <View style={{ height: '140px' }} />
    </ScrollView>
  );
}
