/** 预约类型 */
export type AppointmentType = 'view_tree' | 'live_stream' | 'site_visit' | 'consultation';

/** 预约状态 */
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

/** 预约看树 */
export interface IAppointment {
  _id?: string;
  /** 客户姓名 */
  name: string;
  /** 手机号 */
  phone: string;
  /** 微信号 */
  wechatId?: string;
  /** 预约类型 */
  type: AppointmentType;
  /** 预约日期 */
  date: string;
  /** 预约时段 */
  timeSlot: string;
  /** 感兴趣的树木IDs */
  treeIds?: string[];
  /** 备注 */
  message?: string;
  /** 状态 */
  status: AppointmentStatus;
  /** 管理员备注 */
  adminNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 报价请求 */
export interface IQuotation {
  _id?: string;
  /** 报价编号 */
  quotationNo: string;
  /** 客户信息 */
  name: string;
  phone: string;
  /** 选择的树木 */
  items: QuotationItem[];
  /** 附加服务 */
  services: QuotationService[];
  /** 小计 - 树木 */
  treesSubtotal: number;
  /** 小计 - 服务 */
  servicesSubtotal: number;
  /** 总计 */
  total: number;
  /** 优惠 */
  discount?: number;
  /** 状态 */
  status: 'draft' | 'sent' | 'accepted' | 'expired';
  /** 有效期至 */
  validUntil: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuotationItem {
  treeId: string;
  name: string;
  species: string;
  price: number;
  quantity: number;
}

export interface QuotationService {
  name: string;
  description: string;
  price: number;
}
