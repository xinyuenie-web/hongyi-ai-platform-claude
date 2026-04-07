/** 树木售卖状态 */
export type TreeStatus = 'available' | 'reserved' | 'sold' | 'maintenance' | 'archived';

/** 树木规格 */
export interface TreeSpecs {
  /** 高度 (cm) */
  height: number;
  /** 冠幅 (cm) */
  crown: number;
  /** 胸径 (cm) */
  trunkDiameter?: number;
  /** 土球直径 (cm) */
  rootBall?: number;
}

/** 树木价格 */
export interface TreePrice {
  /** 售价 (元) */
  sale: number;
  /** 挖树费 (元) */
  excavation?: number;
  /** 包装费 (元) */
  packaging?: number;
}

/** 风水属性 */
export interface FengshuiInfo {
  /** 寓意 */
  symbol: string;
  /** 适宜方位 */
  positions: string[];
  /** 五行属性 */
  element?: string;
}

/** 健康等级 */
export interface HealthInfo {
  /** 等级 A/B/C */
  grade: 'A' | 'B' | 'C';
  /** 检测报告 */
  report?: string;
  /** 检测日期 */
  inspectedAt?: string;
}

/** 生长记录 */
export interface GrowthLog {
  date: string;
  image?: string;
  note: string;
}

/** 树木档案完整接口 */
export interface ITree {
  _id?: string;
  /** 树木编号 HY0001-HY9999 */
  treeId: string;
  /** 树木名称 */
  name: string;
  /** 品种/品类 */
  species: string;
  /** 树龄 (年) */
  age?: number;
  /** 规格 */
  specs: TreeSpecs;
  /** 价格 */
  price: TreePrice;
  /** 封面照片 URL */
  coverImage: string;
  /** 详情照片 URLs */
  images: string[];
  /** 视频 URL */
  video?: string;
  /** 360度全景 URL */
  video360?: string;
  /** 风水属性 */
  fengshui?: FengshuiInfo;
  /** 健康信息 */
  health?: HealthInfo;
  /** 生长日志 */
  growthLogs: GrowthLog[];
  /** 养护指南 */
  careGuide?: string;
  /** 标签 */
  tags: string[];
  /** 所在位置 */
  location?: string;
  /** 二维码 */
  qrCode?: string;
  /** 售卖状态 */
  status: TreeStatus;
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
}

/** 创建树木的输入类型 */
export type CreateTreeInput = Omit<ITree, '_id' | 'createdAt' | 'updatedAt'>;

/** 更新树木的输入类型 */
export type UpdateTreeInput = Partial<CreateTreeInput>;
