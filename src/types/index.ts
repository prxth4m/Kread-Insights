// User types
export type UserRole = 'admin' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

// Restaurant types
export type RestaurantStatus = 'active' | 'inactive';
export type Platform = 'zomato' | 'swiggy';

export interface Restaurant {
  id: string;
  name: string;
  displayName: string;
  status: RestaurantStatus;
  isArchived: boolean;
  archivedAt: string | null;
  archivedBy: string | null;
  archiveReason: string | null;
  platform: Platform;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantWithMetrics extends Restaurant {
  sales?: number;
  orders?: number;
  aov?: number;
  roi?: number;
  adSpend?: number;
  lastActiveDate?: string;
}

// Metric types
export interface DailyMetrics {
  id: string;
  restaurantId: string;
  date: string;
  // Sales Overview
  sales: number;
  deliveredOrders: number;
  averageOrderValue: number;
  // Customer Funnel
  impressions: number;
  menuToOrder: number;
  menuToCart: number;
  cartToOrder: number;
  // Marketing
  salesFromAds: number;
  adClickThroughRate: number;
  adsOrders: number;
  adsImpressions: number;
  adsSpend: number;
  adsRoi: number;
  grossSalesFromOffers: number;
  ordersWithOffers: number;
  discountGiven: number;
  effectiveDiscount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyAggregate {
  id: string;
  restaurantId: string;
  periodStart: string;
  periodEnd: string;
  weekNumber: number;
  year: number;
  // Sales Overview
  sales: number;
  deliveredOrders: number;
  averageOrderValue: number;
  // Customer Funnel
  impressions: number;
  menuToOrder: number;
  menuToCart: number;
  cartToOrder: number;
  // Marketing
  salesFromAds: number;
  adClickThroughRate: number;
  adsOrders: number;
  adsImpressions: number;
  adsSpend: number;
  adsRoi: number;
  grossSalesFromOffers: number;
  ordersWithOffers: number;
  discountGiven: number;
  effectiveDiscount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyAggregate {
  id: string;
  restaurantId: string;
  periodStart: string;
  periodEnd: string;
  month: number;
  year: number;
  // Sales Overview
  sales: number;
  deliveredOrders: number;
  averageOrderValue: number;
  // Customer Funnel
  impressions: number;
  menuToOrder: number;
  menuToCart: number;
  cartToOrder: number;
  // Marketing
  salesFromAds: number;
  adClickThroughRate: number;
  adsOrders: number;
  adsImpressions: number;
  adsSpend: number;
  adsRoi: number;
  grossSalesFromOffers: number;
  ordersWithOffers: number;
  discountGiven: number;
  effectiveDiscount: number;
  createdAt: string;
  updatedAt: string;
}

// Alert types
export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  restaurantId: string;
  restaurantName?: string;
  metricName: string;
  severity: AlertSeverity;
  currentValue: number;
  previousValue: number;
  percentageDrop: number;
  detectedAt: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

// Upload types
export type UploadStatus = 'pending' | 'processing' | 'processed' | 'failed';

export interface UploadedFile {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  rowCount: number;
  status: UploadStatus;
  errorDetails: string | null;
}

export interface UploadSummary {
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  restaurantsMatched: number;
  anomaliesDetected: number;
  errors: string[];
}

// Report types
export type ReportType = 'daily' | 'weekly' | 'fortnightly' | 'monthly';
export type ReportFormat = 'pdf' | 'xlsx' | 'csv';

export interface Report {
  id: string;
  generatedBy: string;
  reportType: ReportType;
  periodStart: string;
  periodEnd: string;
  restaurantIds: string[];
  format: ReportFormat;
  filePath: string | null;
  generatedAt: string;
}

// Comparison types
export type PeriodType = 'daily' | 'weekly' | 'monthly';

export interface Comparison {
  id: string;
  createdBy: string;
  restaurantAId: string;
  restaurantBId: string;
  periodType: PeriodType;
  periodValue: string;
  createdAt: string;
}

export interface MetricComparison {
  metric: string;
  label: string;
  restaurantAValue: number;
  restaurantBValue: number;
  absoluteDifference: number;
  percentageDifference: number;
  winner: 'A' | 'B' | 'tie';
}

// Audit log types
export type AuditAction =
  | 'restaurant_created'
  | 'restaurant_edited'
  | 'restaurant_archived'
  | 'restaurant_restored'
  | 'restaurant_deleted'
  | 'file_uploaded'
  | 'report_generated'
  | 'alert_acknowledged';

export type AuditTargetType = 'restaurant' | 'file' | 'report' | 'alert';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  targetName?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// Dashboard KPI types
export interface KPIValue {
  current: number;
  previous: number;
  absoluteChange: number;
  percentageChange: number;
  trend: 'up' | 'down' | 'neutral';
}

export interface DashboardKPIs {
  totalRestaurants: KPIValue;
  totalSales: KPIValue;
  totalOrders: KPIValue;
  averageAOV: KPIValue;
  averageROI: KPIValue;
  totalAdSpend: KPIValue;
  totalOfferSales: KPIValue;
  activeAlerts: KPIValue;
}

// Period comparison types
export interface PeriodComparison {
  label: string;
  value: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  previousPeriodStart: string;
  previousPeriodEnd: string;
}

// Ranking types
export type RankingCategory =
  | 'top_performers'
  | 'bottom_performers'
  | 'most_improved'
  | 'highest_roi'
  | 'best_funnel'
  | 'strongest_growth';

export interface RestaurantRanking {
  rank: number;
  restaurantId: string;
  restaurantName: string;
  metricValue: number;
  changeFromPrevious: number;
  trend: 'up' | 'down' | 'neutral';
}
