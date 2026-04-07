/** 庭院风格 */
export type GardenStyle = 'modern' | 'chinese' | 'european' | 'japanese' | 'tuscan';

/** 方案状态 */
export type DesignStatus = 'generating' | 'completed' | 'revised' | 'archived';

/** 庭院风格配置 */
export interface IGardenStyleConfig {
  _id?: string;
  /** 风格编号 TY01-TY05 */
  styleId: string;
  /** 风格名称 */
  name: string;
  /** 风格类型 */
  type: GardenStyle;
  /** 参考图片 */
  image?: string;
  /** 描述 */
  description: string;
  /** 核心风格关键词 */
  keywords: string[];
  /** 核心庭院元素 */
  elements: string;
  /** 建筑搭配要点 */
  architectureNotes: string;
  /** 适用场景 */
  suitableScenes: string;
  /** 整体氛围 */
  atmosphere: string;
}

/** AI方案记录 */
export interface IDesign {
  _id?: string;
  /** 客户ID */
  customerId: string;
  /** 上传的庭院照片 */
  originalImages: string[];
  /** 选择的风格 */
  style: GardenStyle;
  /** 选中的树木IDs */
  treeIds: string[];
  /** 生成的效果图 */
  renderedImages: string[];
  /** 布局数据 (JSON) */
  layoutData?: Record<string, unknown>;
  /** 方案报告PDF */
  reportPDF?: string;
  /** 方案状态 */
  status: DesignStatus;
  /** AI分析结果 */
  aiAnalysis?: string;
  createdAt?: string;
  updatedAt?: string;
}
