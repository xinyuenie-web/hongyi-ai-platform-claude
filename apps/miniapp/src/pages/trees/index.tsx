import { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, Input, ScrollView, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { fetchTrees, fetchSpeciesList } from '../../utils/api';
import './index.scss';

export default function TreesPage() {
  const [trees, setTrees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [species, setSpecies] = useState('');
  const [speciesList, setSpeciesList] = useState<string[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadSpecies();
  }, []);

  useEffect(() => {
    loadTrees(1, true);
  }, [search, species]);

  async function loadSpecies() {
    try {
      const res = await fetchSpeciesList();
      setSpeciesList(res.data || []);
    } catch (err) {
      console.error('Failed to load species', err);
    }
  }

  async function loadTrees(p: number, reset = false) {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetchTrees({
        page: p,
        limit: 10,
        search: search || undefined,
        species: species || undefined,
      });
      const newTrees = res.data || [];
      setTrees(reset ? newTrees : [...trees, ...newTrees]);
      setPage(p);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to load trees', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function handleScrollToLower() {
    if (page < totalPages && !loadingMore) {
      loadTrees(page + 1);
    }
  }

  function goToDetail(id: string) {
    Taro.navigateTo({ url: `/pages/tree-detail/index?id=${id}` });
  }

  function handleSpeciesChange(e) {
    const idx = e.detail.value;
    setSpecies(idx === 0 ? '' : speciesList[idx - 1] || '');
  }

  const speciesOptions = ['全部品种', ...speciesList];

  return (
    <View className='trees-page'>
      {/* Search & Filter Bar */}
      <View className='filter-bar'>
        <View className='search-box'>
          <Text className='search-icon'>🔍</Text>
          <Input
            className='search-input'
            placeholder='搜索树木名称...'
            value={search}
            onInput={(e) => setSearch(e.detail.value)}
            confirmType='search'
          />
        </View>
        <Picker
          mode='selector'
          range={speciesOptions}
          onChange={handleSpeciesChange}
        >
          <View className='filter-btn'>
            <Text className='filter-btn-text'>
              {species || '品种筛选'}
            </Text>
            <Text className='filter-arrow'>▼</Text>
          </View>
        </Picker>
      </View>

      {/* Tree List */}
      <ScrollView
        scrollY
        className='tree-list'
        onScrollToLower={handleScrollToLower}
      >
        {loading ? (
          <Text className='loading-text'>加载中...</Text>
        ) : trees.length === 0 ? (
          <View className='empty-container'>
            <Text className='empty-icon'>🌲</Text>
            <Text className='empty-text'>暂无符合条件的树木</Text>
          </View>
        ) : (
          <>
            {trees.map((tree) => (
              <View
                key={tree._id}
                className='tree-item'
                onClick={() => goToDetail(tree._id)}
              >
                <Image
                  className='tree-item-image'
                  src={tree.images?.[0] || ''}
                  mode='aspectFill'
                />
                <View className='tree-item-info'>
                  <Text className='tree-item-name'>
                    {tree.name || tree.species}
                  </Text>
                  <Text className='tree-item-species'>{tree.species}</Text>
                  <View className='tree-item-specs'>
                    {tree.specs?.height && (
                      <Text className='spec-tag'>高{tree.specs.height}cm</Text>
                    )}
                    {tree.specs?.diameter && (
                      <Text className='spec-tag'>径{tree.specs.diameter}cm</Text>
                    )}
                    {tree.specs?.crown && (
                      <Text className='spec-tag'>冠{tree.specs.crown}cm</Text>
                    )}
                  </View>
                  <View className='tree-item-bottom'>
                    <Text className='tree-item-price'>
                      ¥{tree.price?.toLocaleString() || '面议'}
                    </Text>
                    <Text className='tree-item-location'>
                      {tree.location || ''}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            {loadingMore && (
              <Text className='loading-text'>加载更多...</Text>
            )}
            {page >= totalPages && trees.length > 0 && (
              <Text className='end-text'>— 已加载全部 —</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
