import axios from 'axios';
import { env } from '@/lib/env';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: env.NEXT_PUBLIC_BACKEND_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get('/admin/dashboard/stats'),
  getRecentActivity: () => api.get('/admin/dashboard/recent-activity'),
  getAnalytics: (period: string) => api.get(`/admin/dashboard/analytics?period=${period}`),
};

// Events API
export const eventsApi = {
  getAll: (params?: { search?: string; format?: string; type?: string; page?: number; limit?: number }) => 
    api.get('/admin/events', { params }),
  getById: (id: string) => api.get(`/admin/events/${id}`),
  create: (data: any) => api.post('/admin/events', data),
  update: (id: string, data: any) => api.put(`/admin/events/${id}`, data),
  delete: (id: string) => api.delete(`/admin/events/${id}`),
  getLeaderboard: (id: string) => api.get(`/admin/events/${id}/leaderboard`),
  updateLeaderboard: (id: string, data: any) => api.put(`/admin/events/${id}/leaderboard`, data),
};

// Teams API
export const teamsApi = {
  getAll: (params?: { search?: string; tier?: string; status?: string; page?: number; limit?: number }) => 
    api.get('/admin/teams', { params }),
  getById: (id: string) => api.get(`/admin/teams/${id}`),
  create: (data: any) => api.post('/admin/teams', data),
  update: (id: string, data: any) => api.put(`/admin/teams/${id}`, data),
  delete: (id: string) => api.delete(`/admin/teams/${id}`),
  verifyRoster: (id: string, data: any) => api.post(`/admin/teams/${id}/verify-roster`, data),
  getRoster: (id: string) => api.get(`/admin/teams/${id}/roster`),
  updateRoster: (id: string, data: any) => api.put(`/admin/teams/${id}/roster`, data),
  ban: (id: string, data: { reasons: string[]; startDate: Date; endDate: Date }) => 
    api.post(`/admin/teams/${id}/ban`, data),
  unban: (id: string) => api.post(`/admin/teams/${id}/unban`),
};

// Players API
export const playersApi = {
  getAll: (params?: { search?: string; team?: string; country?: string; page?: number; limit?: number }) => 
    api.get('/admin/players', { params }),
  getById: (id: string) => api.get(`/admin/players/${id}`),
  create: (data: any) => api.post('/admin/players', data),
  update: (id: string, data: any) => api.put(`/admin/players/${id}`, data),
  delete: (id: string) => api.delete(`/admin/players/${id}`),
  ban: (id: string, reason: string) => api.post(`/admin/players/${id}/ban`, { reason }),
  unban: (id: string) => api.post(`/admin/players/${id}/unban`),
  getStats: (id: string) => api.get(`/admin/players/${id}/stats`),
};

// News API
export const newsApi = {
  getAll: (params?: { search?: string; category?: string; page?: number; limit?: number }) => 
    api.get('/admin/news', { params }),
  getById: (id: string) => api.get(`/admin/news/${id}`),
  create: (data: any) => api.post('/admin/news', data),
  update: (id: string, data: any) => api.put(`/admin/news/${id}`, data),
  delete: (id: string) => api.delete(`/admin/news/${id}`),
  publish: (id: string) => api.post(`/admin/news/${id}/publish`),
  unpublish: (id: string) => api.post(`/admin/news/${id}/unpublish`),
};

// Leaderboards API
export const leaderboardsApi = {
  getAll: (params?: { search?: string; event?: string; type?: string; page?: number; limit?: number }) => 
    api.get('/admin/leaderboards', { params }),
  getById: (id: string) => api.get(`/admin/leaderboards/${id}`),
  create: (data: any) => api.post('/admin/leaderboards', data),
  update: (id: string, data: any) => api.put(`/admin/leaderboards/${id}`, data),
  delete: (id: string) => api.delete(`/admin/leaderboards/${id}`),
  getResults: (id: string) => api.get(`/admin/leaderboards/${id}/results`),
  updateResults: (id: string, data: any) => api.put(`/admin/leaderboards/${id}/results`, data),
  finalize: (id: string) => api.post(`/admin/leaderboards/${id}/finalize`),
};

// Rankings API
export const rankingsApi = {
  getAll: (params?: { search?: string; type?: string; page?: number; limit?: number }) => 
    api.get('/admin/rankings', { params }),
  getById: (id: string) => api.get(`/admin/rankings/${id}`),
  create: (data: any) => api.post('/admin/rankings', data),
  update: (id: string, data: any) => api.put(`/admin/rankings/${id}`, data),
  delete: (id: string) => api.delete(`/admin/rankings/${id}`),
  recalculate: (id: string) => api.post(`/admin/rankings/${id}/recalculate`),
  getMetrics: () => api.get('/admin/rankings/metrics'),
  updateMetrics: (data: any) => api.put('/admin/rankings/metrics', data),
};

// Tiers API
export const tiersApi = {
  getAll: (params?: { search?: string; page?: number; limit?: number }) => 
    api.get('/admin/tiers', { params }),
  getById: (id: string) => api.get(`/admin/tiers/${id}`),
  create: (data: any) => api.post('/admin/tiers', data),
  update: (id: string, data: any) => api.put(`/admin/tiers/${id}`, data),
  delete: (id: string) => api.delete(`/admin/tiers/${id}`),
  getMetrics: () => api.get('/admin/tiers/metrics'),
  updateMetrics: (data: any) => api.put('/admin/tiers/metrics', data),
};

// Shop API
export const shopApi = {
  getAll: (params?: { search?: string; category?: string; status?: string; page?: number; limit?: number }) => 
    api.get('/admin/shop', { params }),
  getById: (id: string) => api.get(`/admin/shop/${id}`),
  create: (data: any) => api.post('/admin/shop', data),
  update: (id: string, data: any) => api.put(`/admin/shop/${id}`, data),
  delete: (id: string) => api.delete(`/admin/shop/${id}`),
  updateStock: (id: string, stock: number) => api.put(`/admin/shop/${id}/stock`, { stock }),
  getOrders: (params?: { search?: string; status?: string; page?: number; limit?: number }) => 
    api.get('/admin/shop/orders', { params }),
  updateOrderStatus: (orderId: string, status: string) => api.put(`/admin/shop/orders/${orderId}/status`, { status }),
};

// Infractions API
export const infractionsApi = {
  getAll: (params?: { search?: string; type?: string; status?: string; page?: number; limit?: number }) => 
    api.get('/admin/infractions', { params }),
  getById: (id: string) => api.get(`/admin/infractions/${id}`),
  create: (data: any) => api.post('/admin/infractions', data),
  update: (id: string, data: any) => api.put(`/admin/infractions/${id}`, data),
  resolve: (id: string, resolution: string) => api.post(`/admin/infractions/${id}/resolve`, { resolution }),
  appeal: (id: string, appealData: any) => api.post(`/admin/infractions/${id}/appeal`, appealData),
};

// Drafts API
export const draftsApi = {
  getAll: (params?: { search?: string; type?: string; page?: number; limit?: number }) => 
    api.get('/admin/drafts', { params }),
  getById: (id: string) => api.get(`/admin/drafts/${id}`),
  create: (data: any) => api.post('/admin/drafts', data),
  update: (id: string, data: any) => api.put(`/admin/drafts/${id}`, data),
  delete: (id: string) => api.delete(`/admin/drafts/${id}`),
  publish: (id: string) => api.post(`/admin/drafts/${id}/publish`),
};

// History API
export const historyApi = {
  getAll: (params?: { search?: string; action?: string; user?: string; page?: number; limit?: number }) => 
    api.get('/admin/history', { params }),
  getByUser: (userId: string, params?: { page?: number; limit?: number }) => 
    api.get(`/admin/history/user/${userId}`, { params }),
  getByAction: (action: string, params?: { page?: number; limit?: number }) => 
    api.get(`/admin/history/action/${action}`, { params }),
};

// Upload API
export const uploadApi = {
  uploadImage: (file: File, type: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    return api.post('/admin/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadDocument: (file: File, type: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    return api.post('/admin/upload/document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteFile: (fileId: string) => api.delete(`/admin/upload/${fileId}`),
};

// Partner API
export const partnerApi = {
  getRosterVerification: (params?: { teams?: string[]; tournament?: string }) => 
    api.get('/admin/partner/roster-verification', { params }),
  verifyRoster: (data: any) => api.post('/admin/partner/roster-verification', data),
  getPartnerStats: () => api.get('/admin/partner/stats'),
};

// Match Results API
export const matchResultsApi = {
  getAll: (params?: { search?: string; event?: string; status?: string; page?: number; limit?: number }) => 
    api.get('/admin/match-results', { params }),
  getById: (id: string) => api.get(`/admin/match-results/${id}`),
  create: (data: any) => api.post('/admin/match-results', data),
  update: (id: string, data: any) => api.put(`/admin/match-results/${id}`, data),
  delete: (id: string) => api.delete(`/admin/match-results/${id}`),
  approve: (id: string) => api.post(`/admin/match-results/${id}/approve`),
  reject: (id: string, reason: string) => api.post(`/admin/match-results/${id}/reject`, { reason }),
};

export default api;