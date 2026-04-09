import { useState } from 'react';
import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

export default function MinePage() {
  const [inquiries] = useState<any[]>([]);

  function goToContact() {
    Taro.navigateTo({ url: '/pages/contact/index' });
  }

  function handleCall() {
    Taro.makePhoneCall({ phoneNumber: '13800138000' }).catch(() => {});
  }

  return (
    <ScrollView scrollY className='mine-page'>
      {/* Profile Header */}
      <View className='profile-header'>
        <View className='avatar-placeholder'>
          <Text className='avatar-text'>红</Text>
        </View>
        <View className='profile-info'>
          <Text className='profile-name'>红艺花木用户</Text>
          <Text className='profile-desc'>欢迎使用红艺花木小程序</Text>
        </View>
      </View>

      {/* Menu Items */}
      <View className='menu-section'>
        <View className='menu-item' onClick={goToContact}>
          <Text className='menu-icon'>📝</Text>
          <Text className='menu-label'>我要咨询</Text>
          <Text className='menu-arrow'>&gt;</Text>
        </View>
        <View className='menu-item' onClick={handleCall}>
          <Text className='menu-icon'>📞</Text>
          <Text className='menu-label'>联系客服</Text>
          <Text className='menu-arrow'>&gt;</Text>
        </View>
        <View className='menu-item'>
          <Text className='menu-icon'>📍</Text>
          <Text className='menu-label'>基地地址</Text>
          <Text className='menu-arrow'>&gt;</Text>
        </View>
        <View className='menu-item'>
          <Text className='menu-icon'>ℹ️</Text>
          <Text className='menu-label'>关于我们</Text>
          <Text className='menu-arrow'>&gt;</Text>
        </View>
      </View>

      {/* Inquiry History */}
      <View className='inquiry-section'>
        <Text className='section-title'>咨询记录</Text>

        {inquiries.length === 0 ? (
          <View className='empty-container'>
            <Text className='empty-icon'>📋</Text>
            <Text className='empty-text'>暂无咨询记录</Text>
            <View className='empty-btn' onClick={goToContact}>
              <Text className='empty-btn-text'>去咨询</Text>
            </View>
          </View>
        ) : (
          <View className='inquiry-list'>
            {inquiries.map((item, idx) => (
              <View key={idx} className='inquiry-item'>
                <View className='inquiry-header'>
                  <Text className='inquiry-date'>{item.date}</Text>
                  <Text className='inquiry-status'>{item.status}</Text>
                </View>
                <Text className='inquiry-message'>{item.message}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Company Info */}
      <View className='company-info'>
        <Text className='company-name'>红艺花木</Text>
        <Text className='company-motto'>11年专业苗木 · 品质值得信赖</Text>
        <View className='company-tags'>
          <Text className='company-tag'>精品苗木</Text>
          <Text className='company-tag'>AI智能方案</Text>
          <Text className='company-tag'>专业施工</Text>
          <Text className='company-tag'>售后保障</Text>
        </View>
      </View>
    </ScrollView>
  );
}
