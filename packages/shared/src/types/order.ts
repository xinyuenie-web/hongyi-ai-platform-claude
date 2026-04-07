/** 订单状态 */
export type OrderStatus = 'pending' | 'paid' | 'preparing' | 'shipping' | 'delivered' | 'completed' | 'cancelled' | 'refunded';

/** 支付状态 */
export type PayStatus = 'unpaid' | 'paid' | 'refunding' | 'refunded';

/** 物流节点 */
export interface LogisticsNode {
  /** 节点名称 */
  step: string;
  /** 状态描述 */
  description: string;
  /** 照片/视频 */
  media?: string[];
  /** 时间 */
  timestamp: string;
}

/** 订单 */
export interface IOrder {
  _id?: string;
  /** 订单号 */
  orderNo: string;
  /** 客户ID */
  customerId: string;
  /** 关联方案ID */
  designId?: string;
  /** 树木IDs */
  treeIds: string[];
  /** 总金额 (分) */
  totalAmount: number;
  /** 支付状态 */
  payStatus: PayStatus;
  /** 订单状态 */
  status: OrderStatus;
  /** 收货地址 */
  shippingAddress: string;
  /** 物流追踪 */
  logistics: LogisticsNode[];
  /** 售后备注 */
  afterSaleNote?: string;
  createdAt?: string;
  updatedAt?: string;
}
