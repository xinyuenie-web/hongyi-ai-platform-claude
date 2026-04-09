import Taro from '@tarojs/taro';

const BASE_URL = process.env.TARO_APP_API || 'http://localhost:4000';

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: Record<string, string>;
}

async function request<T = any>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {} } = options;
  try {
    const res = await Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...header,
      },
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return res.data;
    }
    throw new Error(res.data?.message || `请求失败 (${res.statusCode})`);
  } catch (err: any) {
    if (err.message) {
      throw err;
    }
    throw new Error('网络请求失败，请检查网络连接');
  }
}

// ==================== Trees ====================

export interface TreeListParams {
  page?: number;
  limit?: number;
  species?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}

export function fetchTrees(params: TreeListParams = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== '' && val !== null) {
      query.append(key, String(val));
    }
  });
  const qs = query.toString();
  return request<{ data: any[]; total: number; page: number; totalPages: number }>({
    url: `/api/v1/trees${qs ? `?${qs}` : ''}`,
  });
}

export function fetchTree(treeId: string) {
  return request<{ data: any }>({
    url: `/api/v1/trees/${treeId}`,
  });
}

export function fetchSpeciesList() {
  return request<{ data: string[] }>({
    url: '/api/v1/trees/meta/species',
  });
}

export function fetchTreeStats() {
  return request<{ data: any }>({
    url: '/api/v1/trees/meta/stats',
  });
}

// ==================== Garden Styles ====================

export function fetchGardenStyles() {
  return request<{ data: any[] }>({
    url: '/api/v1/garden-styles',
  });
}

export function fetchGardenStyle(styleId: string) {
  return request<{ data: any }>({
    url: `/api/v1/garden-styles/${styleId}`,
  });
}

// ==================== Inquiries ====================

export interface InquiryData {
  name: string;
  phone: string;
  wechat?: string;
  message: string;
  treeId?: string;
}

export function submitInquiry(data: InquiryData) {
  return request<{ data: any }>({
    url: '/api/v1/inquiries',
    method: 'POST',
    data,
  });
}

// ==================== Appointments ====================

export function fetchAvailableSlots(date: string) {
  return request<{ data: any[] }>({
    url: `/api/v1/appointments/available-slots?date=${date}`,
  });
}

export function createAppointment(data: {
  name: string; phone: string; wechatId?: string;
  type: string; date: string; timeSlot: string;
  treeIds?: string[]; message?: string;
}) {
  return request<{ data: any }>({
    url: '/api/v1/appointments',
    method: 'POST',
    data,
  });
}

// ==================== Quotations ====================

export function createQuotation(data: {
  treeIds: string[]; name: string; phone: string;
  serviceNames?: string[];
}) {
  return request<{ data: any }>({
    url: '/api/v1/quotations',
    method: 'POST',
    data,
  });
}

export function fetchQuotation(quotationNo: string) {
  return request<{ data: any }>({
    url: `/api/v1/quotations/${quotationNo}`,
  });
}

export function fetchStandardServices() {
  return request<{ data: any[] }>({
    url: '/api/v1/quotations/services/list',
  });
}

// ==================== Orders ====================

export function createOrder(data: {
  treeIds: string[]; name: string; phone: string;
  shippingAddress: string;
}) {
  return request<{ data: any }>({
    url: '/api/v1/orders',
    method: 'POST',
    data,
  });
}

export function fetchOrder(orderNo: string) {
  return request<{ data: any }>({
    url: `/api/v1/orders/${orderNo}`,
  });
}

// ==================== AI ====================

export function analyzeGarden(data: { message: string }) {
  return request<{ data: any }>({
    url: '/api/v1/ai/analyze-garden',
    method: 'POST',
    data,
  });
}

export function fetchCareGuides() {
  return request<{ data: any[] }>({
    url: '/api/v1/ai/care',
  });
}

export function fetchCarePlan(species: string) {
  return request<{ data: any }>({
    url: `/api/v1/ai/care/${encodeURIComponent(species)}`,
  });
}

// ==================== Health ====================

export function checkHealth() {
  return request<{ status: string }>({
    url: '/api/health',
  });
}
