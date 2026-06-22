export type MetricFormat = 'currency' | 'number' | 'percent';
export type MetricGroup = 'sales' | 'funnel' | 'marketing';

export type MetricKey =
  | 'sales' | 'delivered_orders' | 'average_order_value'
  | 'impressions' | 'impressions_to_menu' | 'menu_to_cart' | 'cart_to_order'
  | 'sales_from_ads' | 'ad_click_through_rate' | 'ads_orders' | 'ads_impressions'
  | 'ads_spend' | 'ads_roi' | 'ads_menu_opens'
  | 'gross_sales_from_offers' | 'orders_with_offers' | 'discount_given' | 'effective_discount'
  | 'market_share' | 'average_rating' | 'rated_orders' | 'bad_orders'
  | 'rejected_orders' | 'kpt_delayed_orders' | 'poor_rated_orders'
  | 'total_complaints' | 'lost_sales' | 'online_pct' | 'offline_hours'
  | 'kpt_minutes' | 'for_accuracy'
  | 'menu_opens' | 'cart_builds' | 'placed_orders'
  | 'new_user_orders' | 'repeat_user_orders' | 'lapsed_user_orders'
  | 'lunch_orders' | 'dinner_orders' | 'snacks_orders'
  | 'breakfast_orders' | 'late_night_orders'
  | 'non_refunded_complaints' | 'complaints_poor_packaging'
  | 'complaints_poor_quality' | 'complaints_wrong_order'
  | 'complaints_missing_items' | 'self_logs_other_ors';

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  format: MetricFormat;
  higherIsBetter: boolean;
  group: MetricGroup;
  csvColumn: string; // exact string from "Metric" column in Zomato CSV
  derived?: boolean; // true = not in CSV, computed from other metrics
}

export const METRICS: MetricDefinition[] = [
  // Sales
  { key: 'sales', label: 'Sales (Rs)', format: 'currency', higherIsBetter: true, group: 'sales', csvColumn: 'Sales (Rs)' },
  { key: 'delivered_orders', label: 'Delivered Orders', format: 'number', higherIsBetter: true, group: 'sales', csvColumn: 'Delivered orders' },
  { key: 'average_order_value', label: 'Average Order Value', format: 'currency', higherIsBetter: true, group: 'sales', csvColumn: '', derived: true },
  { key: 'market_share', label: 'Market Share', format: 'percent', higherIsBetter: true, group: 'sales', csvColumn: 'Market share (%)' },
  { key: 'average_rating', label: 'Average Rating', format: 'number', higherIsBetter: true, group: 'sales', csvColumn: 'Average rating' },
  { key: 'rated_orders', label: 'Rated Orders', format: 'number', higherIsBetter: true, group: 'sales', csvColumn: 'Rated orders' },
  { key: 'bad_orders', label: 'Bad Orders', format: 'number', higherIsBetter: false, group: 'sales', csvColumn: 'Bad orders' },
  { key: 'rejected_orders', label: 'Rejected Orders', format: 'number', higherIsBetter: false, group: 'sales', csvColumn: 'Rejected orders' },
  { key: 'kpt_delayed_orders', label: 'KPT+10 Delayed Orders', format: 'number', higherIsBetter: false, group: 'sales', csvColumn: 'KPT+10 delayed orders' },
  { key: 'poor_rated_orders', label: 'Poor Rated Orders', format: 'number', higherIsBetter: false, group: 'sales', csvColumn: 'Poor rated orders' },
  { key: 'total_complaints', label: 'Total Complaints', format: 'number', higherIsBetter: false, group: 'sales', csvColumn: 'Total complaints' },
  { key: 'non_refunded_complaints', label: 'Non-Refunded Complaints', format: 'number', higherIsBetter: false, group: 'sales', csvColumn: 'Non-refunded complaints' },
  { key: 'complaints_poor_packaging', label: 'Complaints - Poor Packaging', format: 'number', higherIsBetter: false, group: 'sales', csvColumn: 'Total complaints - Poor packaging' },
  { key: 'complaints_poor_quality', label: 'Complaints - Poor Quality', format: 'number', higherIsBetter: false, group: 'sales', csvColumn: 'Total complaints - Poor quality' },
  { key: 'complaints_wrong_order', label: 'Complaints - Wrong Order', format: 'number', higherIsBetter: false, group: 'sales', csvColumn: 'Total complaints - Wrong order' },
  { key: 'complaints_missing_items', label: 'Complaints - Missing Items', format: 'number', higherIsBetter: false, group: 'sales', csvColumn: 'Total complaints - Missing items' },
  { key: 'self_logs_other_ors', label: 'Self Logs Other ORs', format: 'number', higherIsBetter: false, group: 'sales', csvColumn: 'Self logs other ors' },
  { key: 'lost_sales', label: 'Lost Sales (Rs)', format: 'currency', higherIsBetter: false, group: 'sales', csvColumn: 'Lost sales (Rs)' },
  { key: 'online_pct', label: 'Online %', format: 'percent', higherIsBetter: true, group: 'sales', csvColumn: 'Online %' },
  { key: 'offline_hours', label: 'Offline Hours', format: 'number', higherIsBetter: false, group: 'sales', csvColumn: 'Offline time (in hours)' },
  { key: 'kpt_minutes', label: 'KPT (minutes)', format: 'number', higherIsBetter: false, group: 'sales', csvColumn: 'KPT (in minutes)' },
  { key: 'for_accuracy', label: 'FOR Accuracy', format: 'percent', higherIsBetter: true, group: 'sales', csvColumn: 'FOR accuracy (%)' },
  // Funnel
  { key: 'impressions', label: 'Impressions', format: 'number', higherIsBetter: true, group: 'funnel', csvColumn: 'Impressions' },
  { key: 'impressions_to_menu', label: 'Impressions to Menu', format: 'percent', higherIsBetter: true, group: 'funnel', csvColumn: 'Impressions to menu (%)' },
  { key: 'menu_to_cart', label: 'Menu to Cart', format: 'percent', higherIsBetter: true, group: 'funnel', csvColumn: 'Menu to cart (%)' },
  { key: 'cart_to_order', label: 'Cart to Order', format: 'percent', higherIsBetter: true, group: 'funnel', csvColumn: 'Cart to orders (%)' },
  { key: 'menu_opens', label: 'Menu Opens', format: 'number', higherIsBetter: true, group: 'funnel', csvColumn: 'Menu opens' },
  { key: 'cart_builds', label: 'Cart Builds', format: 'number', higherIsBetter: true, group: 'funnel', csvColumn: 'Cart builds' },
  { key: 'placed_orders', label: 'Placed Orders', format: 'number', higherIsBetter: true, group: 'funnel', csvColumn: 'Placed Orders' },
  { key: 'new_user_orders', label: 'New User Orders', format: 'number', higherIsBetter: true, group: 'funnel', csvColumn: 'New user orders' },
  { key: 'repeat_user_orders', label: 'Repeat User Orders', format: 'number', higherIsBetter: true, group: 'funnel', csvColumn: 'Repeat user orders' },
  { key: 'lapsed_user_orders', label: 'Lapsed User Orders', format: 'number', higherIsBetter: false, group: 'funnel', csvColumn: 'Lapsed user orders' },
  { key: 'lunch_orders', label: 'Lunch Orders', format: 'number', higherIsBetter: true, group: 'funnel', csvColumn: 'Lunch orders' },
  { key: 'dinner_orders', label: 'Dinner Orders', format: 'number', higherIsBetter: true, group: 'funnel', csvColumn: 'Dinner orders' },
  { key: 'snacks_orders', label: 'Snacks Orders', format: 'number', higherIsBetter: true, group: 'funnel', csvColumn: 'Snacks orders' },
  { key: 'breakfast_orders', label: 'Breakfast Orders', format: 'number', higherIsBetter: true, group: 'funnel', csvColumn: 'Breakfast orders' },
  { key: 'late_night_orders', label: 'Late Night Orders', format: 'number', higherIsBetter: true, group: 'funnel', csvColumn: 'Late night orders' },
  // Marketing
  { key: 'sales_from_ads', label: 'Sales from Ads (Rs)', format: 'currency', higherIsBetter: true, group: 'marketing', csvColumn: 'Sales from ads (Rs)' },
  { key: 'ad_click_through_rate', label: 'Ads CTR', format: 'percent', higherIsBetter: true, group: 'marketing', csvColumn: 'Ads CTR (%)' },
  { key: 'ads_orders', label: 'Ads Orders', format: 'number', higherIsBetter: true, group: 'marketing', csvColumn: 'Ads orders' },
  { key: 'ads_impressions', label: 'Ads Impressions', format: 'number', higherIsBetter: true, group: 'marketing', csvColumn: 'Ads impressions' },
  { key: 'ads_spend', label: 'Ads Spend (Rs)', format: 'currency', higherIsBetter: false, group: 'marketing', csvColumn: 'Ads spend (Rs)' },
  { key: 'ads_roi', label: 'Ads ROI', format: 'number', higherIsBetter: true, group: 'marketing', csvColumn: 'Ads ROI' },
  { key: 'ads_menu_opens', label: 'Ads Menu Opens', format: 'number', higherIsBetter: true, group: 'marketing', csvColumn: 'Ads menu opens' },
  { key: 'gross_sales_from_offers', label: 'Gross Sales from Offers (Rs)', format: 'currency', higherIsBetter: true, group: 'marketing', csvColumn: 'Gross sales from offers (Rs)' },
  { key: 'orders_with_offers', label: 'Orders with Offers', format: 'number', higherIsBetter: true, group: 'marketing', csvColumn: 'Orders with offers' },
  { key: 'discount_given', label: 'Discount Given (Rs)', format: 'currency', higherIsBetter: false, group: 'marketing', csvColumn: 'Discount given (Rs)' },
  { key: 'effective_discount', label: 'Effective Discount', format: 'percent', higherIsBetter: false, group: 'marketing', csvColumn: 'Effective discount (%)' },
];

// Build O(1) lookup: csvColumn string -> MetricKey
export const CSV_COLUMN_TO_KEY = new Map<string, MetricKey>(
  METRICS.filter(m => !m.derived && m.csvColumn).map(m => [m.csvColumn, m.key])
);

// Build lookup: key -> definition
export const KEY_TO_METRIC = new Map<MetricKey, MetricDefinition>(
  METRICS.map(m => [m.key, m])
);

export function formatMetric(value: number, format: MetricFormat): string {
  if (format === 'currency') return `\u20b9${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  if (format === 'percent') return `${value.toFixed(2)}%`;
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function getMetricByKey(key: MetricKey): MetricDefinition | undefined {
  return KEY_TO_METRIC.get(key);
}

export function getMetricsByGroup(group: MetricGroup): MetricDefinition[] {
  return METRICS.filter(m => m.group === group);
}

export interface MetricTotals {
  [key: string]: number;
}

export function sumMetrics(rows: Record<string, unknown>[]): MetricTotals {
  const result: MetricTotals = {};
  for (const m of METRICS) {
    result[m.key] = 0;
  }
  for (const row of rows) {
    for (const m of METRICS) {
      if (!m.derived) {
        result[m.key] += Number(row[m.key] ?? 0);
      }
    }
  }
  // Derive average_order_value
  result['average_order_value'] = result['delivered_orders'] > 0
    ? result['sales'] / result['delivered_orders']
    : 0;
  return result;
}

export function computePercentageChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function isImprovement(percentageChange: number | null, higherIsBetter: boolean): boolean {
  if (percentageChange === null) return false;
  if (higherIsBetter) return percentageChange > 0;
  return percentageChange < 0;
}
