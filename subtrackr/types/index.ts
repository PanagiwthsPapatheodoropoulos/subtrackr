export interface User {
  id: number;
  email: string;
  fullName: string;
  plan: 'FREE' | 'PREMIUM';
}

export interface AuthResponse {
  accessToken: string;
  userId: number;
  email: string;
  fullName: string;
  plan: string;
}

export interface Subscription {
  id: number;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  billingCycle: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  nextBilling: string;
  category?: string;
  color: string;
  iconUrl?: string;
  isActive: boolean;
  isPaused: boolean;
  daysUntilBilling: number;
}

export interface PriceTracker {
  id: number;
  url: string;
  affiliateUrl?: string;
  buyUrl: string;          // resolved: affiliateUrl ?? url
  productName: string;
  targetPrice: number;
  currentPrice?: number;
  lowestPrice?: number;
  highestPrice?: number;
  shopName: string;
  imageUrl?: string;
  belowTarget: boolean;
  lastChecked?: string;
  history: { price: number; date: string; recordedAt?: string }[];
  savingsFromHighest?: number;
}

export interface DashboardData {
  monthlyTotal: number;
  yearlyTotal: number;
  activeSubscriptions: number;
  activeTrackers: number;
  unreadNotifications: number;
  totalSavings: number;
  categoryBreakdown: { category: string; count: number; total: number }[];
  upcomingBillings: Subscription[];
  monthlyTrend: MonthlySpendDto[];
}

export interface AppNotification {
  id: number;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface MonthlySpendDto {
  year: number;
  month: number;
  label: string;
  total: number;
}

export interface PlatformInsights {
  avgMonthlySpend:         number;
  avgSubscriptionsPerUser: number;
  totalActiveUsers:        number;
  popularServices: { name: string; userCount: number; sharePercent: number }[];
  pauseRates:      { category: string; total: number; paused: number; pausePercent: number }[];
  totalActiveTrackers: number;
  avgTargetPriceDrop:  number;
}