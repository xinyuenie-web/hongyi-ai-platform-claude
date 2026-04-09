import { useState, useEffect } from 'react';
import { View, Text, Image, Input, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { fetchTrees, fetchStandardServices, createQuotation } from '../../utils/api';
import './index.scss';

const API = process.env.TARO_APP_API || 'http://localhost:4000';

export default function QuotationPage() {
  const [trees, setTrees] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedTrees, setSelectedTrees] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [quotation, setQuotation] = useState<any>(null);

  useEffect(() => {
    fetchTrees({ limit: 50 }).then(res => setTrees(res.data || [])).catch(() => {});
    fetchStandardServices().then(res => {
      const svcs = res.data || [];
      setServices(svcs);
      setSelectedServices(svcs.map((s: any) => s.name));
    }).catch(() => {});
  }, []);

  const toggleTree = (treeId: string) => {
    setSelectedTrees(prev =>
      prev.includes(treeId) ? prev.filter(id => id !== treeId) : [...prev, treeId]
    );
  };

  const toggleService = (svcName: string) => {
    setSelectedServices(prev =>
      prev.includes(svcName) ? prev.filter(n => n !== svcName) : [...prev, svcName]
    );
  };

  const handleSubmit = async () => {
    if (!name || !phone) {
      Taro.showToast({ title: '请填写联系信息', icon: 'none' }); return;
    }
    if (selectedTrees.length === 0) {
      Taro.showToast({ title: '请至少选择一棵树木', icon: 'none' }); return;
    }
    setLoading(true);
    try {
      const res = await createQuotation({
        treeIds: selectedTrees, name, phone,
        serviceNames: selectedServices,
      });
      setQuotation(res.data);
    } catch (err: any) {
      Taro.showToast({ title: err.message || '报价生成失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  if (quotation) {
    return (
      <ScrollView scrollY className="quotation-result">
        <View className="result-header">
          <Text className="result-title">报价单</Text>
          <Text className="result-no">编号: {quotation.quotationNo}</Text>
        </View>
        <View className="result-section">
          <Text className="section-title">树木明细</Text>
          {(quotation.items || []).map((item: any) => (
            <View key={item.treeId} className="result-item">
              <Text className="item-name">{item.name}</Text>
              <Text className="item-price">¥{item.price.toLocaleString()}</Text>
            </View>
          ))}
          <View className="subtotal">
            <Text>树木小计</Text>
            <Text className="price">¥{quotation.treesSubtotal?.toLocaleString()}</Text>
          </View>
        </View>
        <View className="result-section">
          <Text className="section-title">附加服务</Text>
          {(quotation.services || []).map((svc: any) => (
            <View key={svc.name} className="result-item">
              <Text className="item-name">{svc.name}</Text>
              <Text className="item-price">¥{svc.price.toLocaleString()}</Text>
            </View>
          ))}
          <View className="subtotal">
            <Text>服务小计</Text>
            <Text className="price">¥{quotation.servicesSubtotal?.toLocaleString()}</Text>
          </View>
        </View>
        <View className="total-section">
          <Text className="total-label">报价总计</Text>
          <Text className="total-price">¥{quotation.total?.toLocaleString()}</Text>
        </View>
        <View className="valid-info">
          <Text>有效期至: {quotation.validUntil}</Text>
        </View>
        <Button className="btn-primary" onClick={() => setQuotation(null)}>
          重新选择
        </Button>
        <Button className="btn-secondary" onClick={() => {
          Taro.navigateTo({ url: '/pages/contact/index' });
        }}>
          联系客服下单
        </Button>
      </ScrollView>
    );
  }

  return (
    <ScrollView scrollY className="quotation-page">
      <View className="header">
        <Text className="title">在线报价</Text>
        <Text className="desc">选择树木和服务，一键生成报价单</Text>
      </View>

      <View className="section">
        <Text className="section-title">选择树木 ({selectedTrees.length}棵)</Text>
        <View className="tree-grid">
          {trees.filter(t => t.status === 'available').map((tree: any) => (
            <View
              key={tree.treeId}
              className={`tree-card ${selectedTrees.includes(tree.treeId) ? 'selected' : ''}`}
              onClick={() => toggleTree(tree.treeId)}
            >
              <Image
                src={tree.coverImage?.startsWith('/images') ? tree.coverImage : `${API}${tree.coverImage}`}
                className="tree-img"
                mode="aspectFill"
              />
              <View className="tree-info">
                <Text className="tree-name">{tree.name}</Text>
                <Text className="tree-price">¥{tree.price?.sale?.toLocaleString()}</Text>
              </View>
              {selectedTrees.includes(tree.treeId) && (
                <View className="check-badge">✓</View>
              )}
            </View>
          ))}
        </View>
      </View>

      <View className="section">
        <Text className="section-title">附加服务</Text>
        {services.map((svc: any) => (
          <View key={svc.name} className="service-item" onClick={() => toggleService(svc.name)}>
            <View className={`checkbox ${selectedServices.includes(svc.name) ? 'checked' : ''}`} />
            <View className="service-info">
              <Text className="service-name">{svc.name}</Text>
              <Text className="service-desc">{svc.description}</Text>
            </View>
            <Text className="service-rate">{svc.ratePercent}%</Text>
          </View>
        ))}
      </View>

      <View className="section">
        <Text className="section-title">联系信息</Text>
        <Input placeholder="姓名 *" value={name} onInput={e => setName(e.detail.value)} className="input" />
        <Input type="number" placeholder="手机号 *" value={phone} onInput={e => setPhone(e.detail.value)} className="input" />
      </View>

      <View className="submit-area">
        <Button className="btn-primary" loading={loading} onClick={handleSubmit}>
          生成报价单
        </Button>
      </View>
    </ScrollView>
  );
}
