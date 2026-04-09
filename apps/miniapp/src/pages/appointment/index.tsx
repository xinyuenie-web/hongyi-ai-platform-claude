import { useState, useEffect } from 'react';
import { View, Text, Input, Textarea, Picker, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { fetchAvailableSlots, createAppointment } from '../../utils/api';
import './index.scss';

const TYPES = ['远程看树', '视频直播', '实地参观', '专家咨询'];
const TYPE_VALUES = ['view_tree', 'live_stream', 'site_visit', 'consultation'];

export default function AppointmentPage() {
  const [form, setForm] = useState({
    name: '', phone: '', wechatId: '', type: 'view_tree',
    date: '', timeSlot: '', message: '',
  });
  const [typeIndex, setTypeIndex] = useState(0);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Generate next 14 days
  const dates: string[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  useEffect(() => {
    if (form.date) {
      fetchAvailableSlots(form.date).then(res => {
        setSlots(res.data || []);
      }).catch(() => setSlots([]));
    }
  }, [form.date]);

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.date || !form.timeSlot) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }
    setLoading(true);
    try {
      await createAppointment(form);
      setSuccess(true);
      Taro.showToast({ title: '预约成功！', icon: 'success' });
    } catch (err: any) {
      Taro.showToast({ title: err.message || '预约失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View className="success-page">
        <Text className="success-icon">✓</Text>
        <Text className="success-title">预约成功</Text>
        <Text className="success-desc">
          {form.date} {form.timeSlot}
        </Text>
        <Text className="success-sub">我们将在确认后联系您</Text>
        <Button className="btn-primary" onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
          返回首页
        </Button>
      </View>
    );
  }

  return (
    <View className="appointment-page">
      <View className="header">
        <Text className="title">预约看树</Text>
        <Text className="desc">选择时间，远程或实地看真树</Text>
      </View>

      <View className="form-section">
        <View className="form-item">
          <Text className="label">姓名 *</Text>
          <Input placeholder="请输入姓名" value={form.name}
            onInput={e => setForm({...form, name: e.detail.value})} />
        </View>

        <View className="form-item">
          <Text className="label">手机号 *</Text>
          <Input type="number" placeholder="请输入手机号" value={form.phone}
            onInput={e => setForm({...form, phone: e.detail.value})} />
        </View>

        <View className="form-item">
          <Text className="label">微信号</Text>
          <Input placeholder="方便微信联系" value={form.wechatId}
            onInput={e => setForm({...form, wechatId: e.detail.value})} />
        </View>

        <View className="form-item">
          <Text className="label">预约类型 *</Text>
          <Picker mode="selector" range={TYPES} value={typeIndex}
            onChange={e => {
              const idx = Number(e.detail.value);
              setTypeIndex(idx);
              setForm({...form, type: TYPE_VALUES[idx]});
            }}>
            <Text className="picker-text">{TYPES[typeIndex]}</Text>
          </Picker>
        </View>

        <View className="form-item">
          <Text className="label">预约日期 *</Text>
          <Picker mode="selector" range={dates} value={dates.indexOf(form.date)}
            onChange={e => setForm({...form, date: dates[Number(e.detail.value)], timeSlot: ''})}>
            <Text className="picker-text">{form.date || '请选择日期'}</Text>
          </Picker>
        </View>

        {form.date && slots.length > 0 && (
          <View className="form-item">
            <Text className="label">预约时段 *</Text>
            <View className="slots-grid">
              {slots.map((s: any) => (
                <View
                  key={s.time}
                  className={`slot ${form.timeSlot === s.time ? 'active' : ''} ${!s.available ? 'disabled' : ''}`}
                  onClick={() => s.available && setForm({...form, timeSlot: s.time})}
                >
                  <Text className="slot-time">{s.time}</Text>
                  <Text className="slot-remain">{s.available ? `余${s.remaining}位` : '已满'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className="form-item">
          <Text className="label">备注</Text>
          <Textarea placeholder="您的特殊需求..." value={form.message}
            onInput={e => setForm({...form, message: e.detail.value})} />
        </View>

        <Button className="btn-primary" loading={loading} onClick={handleSubmit}>
          确认预约
        </Button>
      </View>
    </View>
  );
}
