import { useState } from 'react';
import { View, Text, Input, Textarea, Button } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { submitInquiry } from '../../utils/api';
import './index.scss';

export default function ContactPage() {
  const router = useRouter();
  const treeId = router.params.treeId || '';
  const treeName = router.params.treeName ? decodeURIComponent(router.params.treeName) : '';
  const styleName = router.params.style ? decodeURIComponent(router.params.style) : '';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [wechat, setWechat] = useState('');
  const [message, setMessage] = useState(
    treeName
      ? `我对"${treeName}"感兴趣，希望了解详情。`
      : styleName
        ? `我对"${styleName}"庭院风格感兴趣，希望咨询方案。`
        : ''
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) {
      Taro.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!phone.trim() || !/^1\d{10}$/.test(phone.trim())) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    if (!message.trim()) {
      Taro.showToast({ title: '请输入咨询内容', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      await submitInquiry({
        name: name.trim(),
        phone: phone.trim(),
        wechat: wechat.trim() || undefined,
        message: message.trim(),
        treeId: treeId || undefined,
      });

      Taro.showModal({
        title: '提交成功',
        content: '您的咨询已提交，我们会尽快与您联系！',
        showCancel: false,
        confirmText: '好的',
        confirmColor: '#1F3864',
        success: () => {
          Taro.navigateBack().catch(() => {
            Taro.switchTab({ url: '/pages/index/index' });
          });
        },
      });
    } catch (err: any) {
      Taro.showToast({
        title: err.message || '提交失败，请重试',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleCall() {
    Taro.makePhoneCall({ phoneNumber: '13800138000' }).catch(() => {});
  }

  return (
    <View className='contact-page'>
      {/* Header */}
      <View className='contact-header'>
        <Text className='header-title'>咨询留言</Text>
        <Text className='header-desc'>
          留下您的联系方式，专业团队为您服务
        </Text>
      </View>

      {/* Form */}
      <View className='form-card'>
        {(treeName || styleName) && (
          <View className='context-info'>
            <Text className='context-label'>
              咨询项目：{treeName || `${styleName}风格`}
            </Text>
          </View>
        )}

        <View className='form-item'>
          <Text className='form-label'>
            姓名 <Text className='required'>*</Text>
          </Text>
          <Input
            className='form-input'
            placeholder='请输入您的姓名'
            value={name}
            onInput={(e) => setName(e.detail.value)}
            maxlength={20}
          />
        </View>

        <View className='form-item'>
          <Text className='form-label'>
            手机号 <Text className='required'>*</Text>
          </Text>
          <Input
            className='form-input'
            placeholder='请输入您的手机号'
            type='number'
            value={phone}
            onInput={(e) => setPhone(e.detail.value)}
            maxlength={11}
          />
        </View>

        <View className='form-item'>
          <Text className='form-label'>微信号</Text>
          <Input
            className='form-input'
            placeholder='选填，方便微信联系'
            value={wechat}
            onInput={(e) => setWechat(e.detail.value)}
            maxlength={30}
          />
        </View>

        <View className='form-item'>
          <Text className='form-label'>
            咨询内容 <Text className='required'>*</Text>
          </Text>
          <Textarea
            className='form-textarea'
            placeholder='请描述您的需求，如树种偏好、庭院面积、预算范围等'
            value={message}
            onInput={(e) => setMessage(e.detail.value)}
            maxlength={500}
            autoHeight
          />
          <Text className='char-count'>{message.length}/500</Text>
        </View>

        <Button
          className='submit-btn'
          onClick={handleSubmit}
          disabled={submitting}
          loading={submitting}
        >
          {submitting ? '提交中...' : '提交咨询'}
        </Button>
      </View>

      {/* Quick Contact */}
      <View className='quick-contact'>
        <Text className='quick-title'>其他联系方式</Text>
        <View className='contact-methods'>
          <View className='contact-method' onClick={handleCall}>
            <Text className='method-icon'>📞</Text>
            <View className='method-info'>
              <Text className='method-label'>电话咨询</Text>
              <Text className='method-value'>138-0013-8000</Text>
            </View>
          </View>
          <View className='contact-method'>
            <Text className='method-icon'>💬</Text>
            <View className='method-info'>
              <Text className='method-label'>微信咨询</Text>
              <Text className='method-value'>hongyi_huamu</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
