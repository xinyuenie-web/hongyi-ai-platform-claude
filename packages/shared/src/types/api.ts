/** 统一API响应格式 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: PaginationInfo;
}

/** 分页信息 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** 列表查询参数 */
export interface ListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
}

/** 树木列表查询参数 */
export interface TreeListQuery extends ListQuery {
  species?: string;
  minPrice?: number;
  maxPrice?: number;
  status?: string;
  tags?: string;
}
