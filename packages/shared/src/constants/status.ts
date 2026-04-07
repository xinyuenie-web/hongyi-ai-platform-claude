/** 树木状态映射 */
export const TREE_STATUS_MAP = {
  available: '在售',
  reserved: '已预订',
  sold: '已售出',
  maintenance: '养护中',
  archived: '已下架',
} as const;

/** 订单状态映射 */
export const ORDER_STATUS_MAP = {
  pending: '待付款',
  paid: '已付款',
  preparing: '备货中',
  shipping: '运输中',
  delivered: '已到货',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
} as const;

/** 客户等级映射 */
export const CUSTOMER_LEVEL_MAP = {
  lead: '线索',
  prospect: '意向客户',
  customer: '成交客户',
  vip: 'VIP客户',
} as const;

/** 庭院风格映射 */
export const GARDEN_STYLE_MAP = {
  modern: '现代简约',
  chinese: '新中式',
  european: '欧式古典',
  japanese: '日式禅意',
  tuscan: '田园托斯卡纳',
} as const;
