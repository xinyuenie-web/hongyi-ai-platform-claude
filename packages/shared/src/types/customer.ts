/** 客户来源 */
export type CustomerSource = 'website_form' | 'wechat' | 'miniapp' | 'douyin' | 'xiaohongshu' | 'referral' | 'other';

/** 客户等级 */
export type CustomerLevel = 'lead' | 'prospect' | 'customer' | 'vip';

/** 客户信息 */
export interface ICustomer {
  _id?: string;
  /** 微信 OpenID */
  openid?: string;
  /** 手机号 */
  phone?: string;
  /** 姓名 */
  name: string;
  /** 微信号 */
  wechatId?: string;
  /** 地址 */
  address?: string;
  /** 客户等级 */
  level: CustomerLevel;
  /** 标签 */
  tags: string[];
  /** 来源 */
  source: CustomerSource;
  /** 分配的销售ID */
  assignedSalesId?: string;
  /** 备注 */
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 咨询记录 */
export interface IInquiry {
  _id?: string;
  name: string;
  phone: string;
  wechatId?: string;
  message: string;
  /** 感兴趣的树木ID */
  treeId?: string;
  /** 来源 */
  source: CustomerSource;
  /** 处理状态 */
  status: 'pending' | 'contacted' | 'closed';
  createdAt?: string;
}
