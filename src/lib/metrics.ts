export interface MetricDefinition {
  key: string;
  label: string;
  format: 'number' | 'currency' | 'percent' | 'decimal';
  higherIsBetter: boolean;
  group: 'sales' | 'funnel' | 'marketing' | 'quality' | 'ordering';
}

export const METRICS: MetricDefinition[] = [
  // Sales Overview
  { key: 'sales', label: 'Total Sales', format: 'currency', higherIsBetter: true, group: 'sales' },
  { key: 'delivered_orders', label: 'Delivered Orders', format: 'number', higherIsBetter: true, group: 'sales' },
  { key: 'average_order_value', label: 'Average Order Value', format: 'currency', higherIsBetter: true, group: 'sales' },

  // Customer Funnel
  { key: 'impressions', label: 'Impressions', format: 'number', higherIsBetter: true, group: 'funnel' },
  { key: 'impressions_to_menu', label: 'Impressions to Menu', format: 'number', higherIsBetter: true, group: 'funnel' },
  { key: 'menu_to_cart', label: 'Menu to Cart', format: 'number', higherIsBetter: true, group: 'funnel' },
  { key: 'cart_to_order', label: 'Cart to Order', format: 'number', higherIsBetter: true, group: 'funnel' },

  // Marketing
  { key: 'sales_from_ads', label: 'Sales from Ads', format: 'currency', higherIsBetter: true, group: 'marketing' },
  { key: 'ad_click_through_rate', label: 'Ad Click-Through Rate', format: 'percent', higherIsBetter: true, group: 'marketing' },
  { key: 'ads_orders', label: 'Ads Orders', format: 'number', higherIsBetter: true, group: 'marketing' },
  { key: 'ads_impressions', label: 'Ads Impressions', format: 'number', higherIsBetter: true, group: 'marketing' },
  { key: 'ads_spend', label: 'Ads Spend', format: 'currency', higherIsBetter: false, group: 'marketing' },
  { key: 'ads_roi', label: 'Ads ROI', format: 'percent', higherIsBetter: true, group: 'marketing' },
  { key: 'gross_sales_from_offers', label: 'Gross Sales from Offers', format: 'currency', higherIsBetter: true, group: 'marketing' },
  { key: 'orders_with_offers', label: 'Orders with Offers', format: 'number', higherIsBetter: true, group: 'marketing' },
  { key: 'discount_given', label: 'Discount Given', format: 'currency', higherIsBetter: false, group: 'marketing' },
  { key: 'effective_discount', label: 'Effective Discount', format: 'percent', higherIsBetter: false, group: 'marketing' },

  // Quality
  { key: 'average_rating', label: 'Average Rating', format: 'decimal', higherIsBetter: true, group: 'quality' },
  { key: 'rated_orders', label: 'Rated Orders', format: 'number', higherIsBetter: true, group: 'quality' },
  { key: 'bad_orders', label: 'Bad Orders', format: 'number', higherIsBetter: false, group: 'quality' },
  { key: 'rejected_orders', label: 'Rejected Orders', format: 'number', higherIsBetter: false, group: 'quality' },
  { key: 'kpt_delayed_orders', label: 'KPT Delayed Orders', format: 'number', higherIsBetter: false, group: 'quality' },
  { key: 'poor_rated_orders', label: 'Poor Rated Orders', format: 'number', higherIsBetter: false, group: 'quality' },
  { key: 'total_complaints', label: 'Total Complaints', format: 'number', higherIsBetter: false, group: 'quality' },

  // Ordering Patterns
  { key: 'placed_orders', label: 'Placed Orders', format: 'number', higherIsBetter: true, group: 'ordering' },
  { key: 'new_user_orders', label: 'New User Orders', format: 'number', higherIsBetter: true, group: 'ordering' },
  { key: 'repeat_user_orders', label: 'Repeat User Orders', format: 'number', higherIsBetter: true, group: 'ordering' },
  { key: 'lapsed_user_orders', label: 'Lapsed User Orders', format: 'number', higherIsBetter: true, group: 'ordering' },
  { key: 'lunch_orders', label: 'Lunch Orders', format: 'number', higherIsBetter: true, group: 'ordering' },
  { key: 'dinner_orders', label: 'Dinner Orders', format: 'number', higherIsBetter: true, group: 'ordering' },
  { key: 'snacks_orders', label: 'Snacks Orders', format: 'number', higherIsBetter: true, group: 'ordering' },
  { key: 'breakfast_orders', label: 'Breakfast Orders', format: 'number', higherIsBetter: true, group: 'ordering' },
  { key: 'late_night_orders', label: 'Late Night Orders', format: 'number', higherIsBetter: true, group: 'ordering' },
];

export function sumMetrics(rows: any[]): Record<string, number> {
  const totals: Record<string, number> = {};

  if (!rows || rows.length === 0) return totals;

  rows.forEach(row => {
    Object.keys(row).forEach(key => {
      if (typeof row[key] === 'number' || typeof row[key] === 'string') {
        const val = Number(row[key]);
        if (!isNaN(val) && key !== 'id' && key !== 'restaurant_id') {
          totals[key] = (totals[key] || 0) + val;
        }
      }
    });
  });

  return totals;
}

export function formatMetric(value: number, format: MetricDefinition['format']): string {
  switch (format) {
    case 'currency':
      return `\u20b9${value.toLocaleString('en-IN')}`;
    case 'percent':
      return `${value.toFixed(2)}%`;
    case 'decimal':
      return value.toFixed(2);
    case 'number':
    default:
      return value.toLocaleString('en-IN');
  }
}

// Map from camelCase TypeScript keys to snake_case database columns
export const metricKeyMap: Record<string, string> = {
  sales: 'sales',
  deliveredOrders: 'delivered_orders',
  averageOrderValue: 'average_order_value',
  impressions: 'impressions',
  impressionsToMenu: 'impressions_to_menu',
  menuToCart: 'menu_to_cart',
  cartToOrder: 'cart_to_order',
  salesFromAds: 'sales_from_ads',
  adClickThroughRate: 'ad_click_through_rate',
  adsOrders: 'ads_orders',
  adsImpressions: 'ads_impressions',
  adsSpend: 'ads_spend',
  adsRoi: 'ads_roi',
  grossSalesFromOffers: 'gross_sales_from_offers',
  ordersWithOffers: 'orders_with_offers',
  discountGiven: 'discount_given',
  effectiveDiscount: 'effective_discount',
  averageRating: 'average_rating',
  ratedOrders: 'rated_orders',
  badOrders: 'bad_orders',
  rejectedOrders: 'rejected_orders',
  kptDelayedOrders: 'kpt_delayed_orders',
  poorRatedOrders: 'poor_rated_orders',
  totalComplaints: 'total_complaints',
  placedOrders: 'placed_orders',
  newUserOrders: 'new_user_orders',
  repeatUserOrders: 'repeat_user_orders',
  lapsedUserOrders: 'lapsed_user_orders',
  lunchOrders: 'lunch_orders',
  dinnerOrders: 'dinner_orders',
  snacksOrders: 'snacks_orders',
  breakfastOrders: 'breakfast_orders',
  lateNightOrders: 'late_night_orders',
};
