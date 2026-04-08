import type { ApiResponse, ITree, IGardenStyleConfig, TreeListQuery } from '@hongyi/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`;
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

  const url = `${API_BASE}/api/v1/inquiries`;
  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: '网络请求失败' } }));
    return { success: false, error: error.error || { code: 'NETWORK_ERROR', message: '网络请求失败' } };
  }
  return res.json();
}
