/** 内容类型 */
export type ContentType = 'article' | 'case' | 'knowledge' | 'announcement';

/** CMS内容 */
export interface IContent {
  _id?: string;
  /** 内容类型 */
  type: ContentType;
  /** 标题 */
  title: string;
  /** URL别名 */
  slug: string;
  /** 摘要 */
  summary?: string;
  /** 内容 (Markdown) */
  content: string;
  /** 封面图 */
  coverImage?: string;
  /** 标签 */
  tags: string[];
  /** SEO元数据 */
  seoMeta?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  /** 发布状态 */
  published: boolean;
  /** 发布时间 */
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
