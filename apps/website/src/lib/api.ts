import type { ApiResponse, ITree, IGardenStyleConfig, TreeListQuery, IQuotation, IOrder } from '@hongyi/shared';

// SSR (Docker内部): 通过Docker网络直接访问server容器
// 浏览器端: 通过nginx反向代理 (相对路径)
const SERVER_API = process.env.INTERNAL_API_URL || 'http://server:4000';
const CLIENT_API = process.env.NEXT_PUBLIC_API_URL || '';

function getApiBase() {
  return typeof window === 'undefined' ? SERVER_API : CLIENT_API;
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const url = `${getApiBase()}${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: '网络请求失败' } }));
    return { success: false, error: error.error || { code: 'NETWORK_ERROR', message: '网络请求失败' } };
  }

  return res.json();
}

/** Get tree list */
export async function getTreeList(params?: TreeListQuery): Promise<ApiResponse<ITree[]>> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
  }
  const query = searchParams.toString();
  return fetchAPI<ITree[]>(`/api/v1/trees${query ? `?${query}` : ''}`);
}

/** Get single tree */
export async function getTree(treeId: string): Promise<ApiResponse<ITree>> {
  return fetchAPI<ITree>(`/api/v1/trees/${treeId}`);
}

/** Get species list */
export async function getSpeciesList(): Promise<ApiResponse<string[]>> {
  return fetchAPI<string[]>('/api/v1/trees/meta/species');
}

/** Get garden styles */
export async function getGardenStyles(): Promise<ApiResponse<IGardenStyleConfig[]>> {
  return fetchAPI<IGardenStyleConfig[]>('/api/v1/garden-styles');
}

/** AI garden analysis */
export interface AIAnalysisResult {
  recommendedStyles: Array<{
    styleId: string;
    name: string;
    type: string;
    image: string;
    description: string;
    matchScore: number;
    reason: string;
  }>;
  recommendedTrees: Array<{
    treeId: string;
    name: string;
    species: string;
    coverImage: string;
    price: number;
    specs: { height: number; crown: number };
    reason: string;
    matchScore: number;
  }>;
  fengshuiTip: string;
  designSummary: string;
}

export async function analyzeGarden(data: {
  message: string;
  photos?: File[];
}): Promise<ApiResponse<AIAnalysisResult>> {
  const formData = new FormData();
  formData.append('message', data.message);
  if (data.photos) {
    data.photos.forEach((file) => formData.append('photos', file));
  }
  const url = `${getApiBase()}/api/v1/ai/analyze-garden`;
  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: 'AI分析失败' } }));
    return { success: false, error: error.error || { code: 'AI_ERROR', message: 'AI分析失败' } };
  }
  return res.json();
}

/** Get available appointment time slots for a date */
export async function getAvailableSlots(date: string): Promise<ApiResponse<{ time: string; available: boolean; remaining: number }[]>> {
  return fetchAPI<{ time: string; available: boolean; remaining: number }[]>(`/api/v1/appointments/available-slots?date=${date}`);
}

/** Create appointment */
export async function createAppointment(data: {
  name: string;
  phone: string;
  wechatId?: string;
  type: string;
  date: string;
  timeSlot: string;
  treeIds?: string[];
  message?: string;
}): Promise<ApiResponse<{ _id: string; date: string; timeSlot: string; type: string; status: string }>> {
  return fetchAPI(`/api/v1/appointments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Create quotation */
export async function createQuotation(data: {
  treeIds: string[];
  name: string;
  phone: string;
  serviceNames?: string[];
}): Promise<ApiResponse<IQuotation>> {
  return fetchAPI(`/api/v1/quotations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Get quotation by quotationNo */
export async function getQuotation(quotationNo: string): Promise<ApiResponse<IQuotation>> {
  return fetchAPI<IQuotation>(`/api/v1/quotations/${quotationNo}`);
}

/** Get standard services list */
export async function getStandardServices(): Promise<ApiResponse<{ name: string; description: string; price: number }[]>> {
  return fetchAPI(`/api/v1/quotations/services/list`);
}

/** Create order */
export async function createOrder(data: {
  treeIds: string[];
  name: string;
  phone: string;
  shippingAddress: string;
}): Promise<ApiResponse<IOrder>> {
  return fetchAPI(`/api/v1/orders`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Get order by orderNo */
export async function getOrder(orderNo: string): Promise<ApiResponse<IOrder>> {
  return fetchAPI<IOrder>(`/api/v1/orders/${orderNo}`);
}

/** Get AI care guides */
export async function getCareGuides(): Promise<ApiResponse<CareGuide[]>> {
  return fetchAPI<CareGuide[]>('/api/v1/ai/care');
}

export interface CareGuide {
  species: string;
  overview: string;
  seasons: {
    spring: SeasonCare;
    summer: SeasonCare;
    autumn: SeasonCare;
    winter: SeasonCare;
  };
  tips: string[];
}

export interface SeasonCare {
  watering: string;
  fertilizing: string;
  pruning: string;
  pestControl: string;
}

/** Submit inquiry with optional photo uploads */
export async function submitInquiry(data: {
  name: string;
  phone: string;
  wechatId?: string;
  message: string;
  treeId?: string;
  photos?: File[];
}): Promise<ApiResponse<{ id: string }>> {
  const formData = new FormData();
  formData.append('name', data.name);
  formData.append('phone', data.phone);
  if (data.wechatId) formData.append('wechatId', data.wechatId);
  formData.append('message', data.message);
  if (data.treeId) formData.append('treeId', data.treeId);
  if (data.photos) {
    data.photos.forEach((file) => formData.append('photos', file));
  }

  const url = `${getApiBase()}/api/v1/inquiries`;
  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: '网络请求失败' } }));
    return { success: false, error: error.error || { code: 'NETWORK_ERROR', message: '网络请求失败' } };
  }
  return res.json();
}
