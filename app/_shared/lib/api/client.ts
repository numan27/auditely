import { apiClient } from './axios';

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  register: (email: string, password: string, name: string) =>
    apiClient.post('/auth/register', { email, password, name }),
  logout: () => apiClient.post('/auth/logout'),
  refreshToken: (refreshToken: string) =>
    apiClient.post('/auth/refresh', { refreshToken }),
  me: () => apiClient.get('/auth/me'),
};

// User API
export const userApi = {
  getProfile: () => apiClient.get('/user/profile'),
  updateProfile: (data: { name?: string; email?: string; avatar?: string }) =>
    apiClient.put('/user/profile', data),
  changePassword: (oldPassword: string, newPassword: string) =>
    apiClient.post('/user/change-password', { oldPassword, newPassword }),
};
