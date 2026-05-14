'use client';

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getCookie, setCookie, removeCookie } from '@/app/_shared/lib/utils/storage';

// Create axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Queue for pending requests during token refresh
const MAX_QUEUE_SIZE = 100;
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  config: InternalAxiosRequestConfig;
}> = [];

// Process the queue
const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      if (promise.config.headers) {
        promise.config.headers.Authorization = `Bearer ${token}`;
      }
      promise.resolve(axiosInstance(promise.config));
    }
  });
  failedQueue = [];
};

// Request interceptor
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getCookie('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // If error is not 401 or request already retried, reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Add request to queue with size limit
      return new Promise((resolve, reject) => {
        if (failedQueue.length >= MAX_QUEUE_SIZE) {
          reject(new Error('Request queue full'));
          return;
        }
        failedQueue.push({
          resolve,
          reject,
          config: originalRequest,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = getCookie('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Call refresh token endpoint
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/refresh`,
        { refreshToken }
      );

      const { token: newToken, refreshToken: newRefreshToken } = response.data;

      // Update cookies
      setCookie('token', newToken);
      setCookie('refreshToken', newRefreshToken);

      // Update auth header
      axiosInstance.defaults.headers.Authorization = `Bearer ${newToken}`;
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
      }

      // Process queued requests
      processQueue(null, newToken);

      return axiosInstance(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError as Error, null);
      // Clear auth data and redirect to login
      removeCookie('token');
      removeCookie('refreshToken');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default axiosInstance;

// API client methods
export const apiClient = {
  get: <T>(url: string, params?: object) => axiosInstance.get<T>(url, { params }),
  post: <T>(url: string, data?: object) => axiosInstance.post<T>(url, data),
  put: <T>(url: string, data?: object) => axiosInstance.put<T>(url, data),
  patch: <T>(url: string, data?: object) => axiosInstance.patch<T>(url, data),
  delete: <T>(url: string) => axiosInstance.delete<T>(url),
};
