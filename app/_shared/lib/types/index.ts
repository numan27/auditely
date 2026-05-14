// Global TypeScript types

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
  statusCode: number;
}

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Auth types
export interface AuthTokens {
  token: string;
  refreshToken: string;
  expiresIn?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

// Theme types
export type Theme = 'light' | 'dark' | 'system';

// Button types
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

// Input types
export type InputVariant = 'default' | 'filled' | 'flushed' | 'unstyled';
export type InputSize = 'sm' | 'md' | 'lg';

// Route types
export interface RouteConfig {
  path: string;
  isPublic?: boolean;
  isProtected?: boolean;
  allowedRoles?: string[];
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Form types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
}

// Navigation types
export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  children?: NavItem[];
  isExternal?: boolean;
}

// Meta types
export interface PageMeta {
  title: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  noIndex?: boolean;
}
