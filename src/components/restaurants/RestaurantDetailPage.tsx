import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getAuthToken } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import type { Restaurant, DailyMetrics, Alert as AlertType, PeriodType } from '@/types';

const API_BASE = 'http://localhost:8000/api';

interface MetricCardProps {
  label: string;
  current: number;
  previous?: number;
  format?: 'currency' | 'number' | 'percent';
  trend?: 'up' | 'down' | 'neutral';
}

function MetricCard({ label, current, previous, format = 'number', trend }: MetricCardProps) {
  const formatValue = (val: number) => {
    if (format === 'currency') return `₹${val.toLocaleString('en-IN')}`;
    if (format === 'percent') return `${val.toFixed(2)}%`;
    return val.toLocaleString('en-IN');
  };

  const percentageChange = previous && previous !== 0 ? ((current - previous) / previous) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-sm">{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold">{formatValue(current)}</div>
        {previous !== undefined && previous !== 0 && (
          <div className="flex items-center gap-1 mt-1">
            {trend === 'up' ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : trend === 'down' ? (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ) : null}
            <span
              className={`text-xs ${
                trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
              }`}
            >
              {percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              vs {formatValue(previous)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [metrics, setMetrics] = useState<DailyMetrics[]>([]);
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [periodType, setPeriodType] = useState<PeriodType>('daily');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (id) {
      fetchRestaurantData();
    }
  }, [id, periodType]);

  const fetchRestaurantData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const token = getAuthToken();

      // Fetch restaurant details
      const restaurantRes = await fetch(`${API_BASE}/restaurants/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (restaurantRes.ok) {
        setRestaurant(await restaurantRes.json());
      } else {
        toast.error('Restaurant not found');
        navigate('/restaurants');
        return;
      }

      // Fetch metrics
      const metricsRes = await fetch(
        `${API_BASE}/metrics/restaurant/${id}?period_type=${periodType}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics || []);
      }

      // Fetch alerts for this restaurant
      const alertsRes = await fetch(`${API_BASE}/alerts/restaurant/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch restaurant data:', error);
      toast.error('Failed to load restaurant data');
    } finally {
      setIsLoading(false);
    }
  };

  const latestMetrics = metrics[0];
  const previousMetrics = metrics[1];

  // Calculate trends
  const getTrend = (current: number, previous: number) => {
    if (!previous || previous === 0) return 'neutral';
    return current > previous ? 'up' : current < previous ? 'down' : 'neutral';
  };

  // Prepare chart data
  const chartData = metrics.slice().reverse().map((m) => ({
    period: periodType === 'daily' ? m.date : periodType === 'weekly' ? `W${m}` : `${m}`,
    sales: Number(m.sales) || 0,
    orders: m.deliveredOrders || 0,
    aov: Number(m.averageOrderValue) || 0,
  }));

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return <div>Restaurant not found</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/restaurants')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{restaurant.displayName}</h1>
            <p className="text-muted-foreground">{restaurant.name}</p>
          </div>
          <Badge variant={restaurant.status === 'active' ? 'default' : 'secondary'}>
            {restaurant.status}
          </Badge>
          <Badge variant="outline">{restaurant.platform}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Alerts */}
      {alerts.filter((a) => !a.acknowledged).length > 0 && (
        <div className="grid gap-2">
          {alerts
            .filter((a) => !a.acknowledged)
            .slice(0, 3)
            .map((alert) => (
              <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{alert.metricName} dropped {alert.percentageDrop}%</AlertTitle>
                <AlertDescription>
                  Current: {alert.currentValue} | Previous: {alert.previousValue}
                </AlertDescription>
              </Alert>
            ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="funnel">Customer Funnel</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Sales"
              current={Number(latestMetrics?.sales) || 0}
              previous={Number(previousMetrics?.sales)}
              format="currency"
              trend={getTrend(Number(latestMetrics?.sales) || 0, Number(previousMetrics?.sales) || 0)}
            />
            <MetricCard
              label="Orders"
              current={latestMetrics?.deliveredOrders || 0}
              previous={previousMetrics?.deliveredOrders}
              trend={getTrend(latestMetrics?.deliveredOrders || 0, previousMetrics?.deliveredOrders || 0)}
            />
            <MetricCard
              label="AOV"
              current={Number(latestMetrics?.averageOrderValue) || 0}
              previous={Number(previousMetrics?.averageOrderValue)}
              format="currency"
              trend={getTrend(Number(latestMetrics?.averageOrderValue) || 0, Number(previousMetrics?.averageOrderValue) || 0)}
            />
            <MetricCard
              label="ROI"
              current={Number(latestMetrics?.adsRoi) || 0}
              previous={Number(previousMetrics?.adsRoi)}
              format="percent"
              trend={getTrend(Number(latestMetrics?.adsRoi) || 0, Number(previousMetrics?.adsRoi) || 0)}
            />
          </div>

          {/* Sales Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  sales: { label: 'Sales', color: 'var(--chart-1)' },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tickLine={false} axisLine={false} />
                    <YAxis
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="var(--color-sales)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Total Sales"
              current={Number(latestMetrics?.sales) || 0}
              previous={Number(previousMetrics?.sales)}
              format="currency"
              trend={getTrend(Number(latestMetrics?.sales) || 0, Number(previousMetrics?.sales) || 0)}
            />
            <MetricCard
              label="Delivered Orders"
              current={latestMetrics?.deliveredOrders || 0}
              previous={previousMetrics?.deliveredOrders}
              trend={getTrend(latestMetrics?.deliveredOrders || 0, previousMetrics?.deliveredOrders || 0)}
            />
            <MetricCard
              label="Average Order Value"
              current={Number(latestMetrics?.averageOrderValue) || 0}
              previous={Number(previousMetrics?.averageOrderValue)}
              format="currency"
              trend={getTrend(Number(latestMetrics?.averageOrderValue) || 0, Number(previousMetrics?.averageOrderValue) || 0)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Orders Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  orders: { label: 'Orders', color: 'var(--chart-2)' },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Impressions"
              current={latestMetrics?.impressions || 0}
              previous={previousMetrics?.impressions}
              trend={getTrend(latestMetrics?.impressions || 0, previousMetrics?.impressions || 0)}
            />
            <MetricCard
              label="Menu to Order"
              current={Number(latestMetrics?.menuToOrder) || 0}
              previous={Number(previousMetrics?.menuToOrder)}
              format="percent"
              trend={getTrend(Number(latestMetrics?.menuToOrder) || 0, Number(previousMetrics?.menuToOrder) || 0)}
            />
            <MetricCard
              label="Menu to Cart"
              current={Number(latestMetrics?.menuToCart) || 0}
              previous={Number(previousMetrics?.menuToCart)}
              format="percent"
              trend={getTrend(Number(latestMetrics?.menuToCart) || 0, Number(previousMetrics?.menuToCart) || 0)}
            />
            <MetricCard
              label="Cart to Order"
              current={Number(latestMetrics?.cartToOrder) || 0}
              previous={Number(previousMetrics?.cartToOrder)}
              format="percent"
              trend={getTrend(Number(latestMetrics?.cartToOrder) || 0, Number(previousMetrics?.cartToOrder) || 0)}
            />
          </div>
        </TabsContent>

        <TabsContent value="marketing" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Sales from Ads"
              current={Number(latestMetrics?.salesFromAds) || 0}
              previous={Number(previousMetrics?.salesFromAds)}
              format="currency"
              trend={getTrend(Number(latestMetrics?.salesFromAds) || 0, Number(previousMetrics?.salesFromAds) || 0)}
            />
            <MetricCard
              label="Ad Spend"
              current={Number(latestMetrics?.adsSpend) || 0}
              previous={Number(previousMetrics?.adsSpend)}
              format="currency"
              trend={getTrend(Number(latestMetrics?.adsSpend) || 0, Number(previousMetrics?.adsSpend) || 0)}
            />
            <MetricCard
              label="Ads ROI"
              current={Number(latestMetrics?.adsRoi) || 0}
              previous={Number(previousMetrics?.adsRoi)}
              format="percent"
              trend={getTrend(Number(latestMetrics?.adsRoi) || 0, Number(previousMetrics?.adsRoi) || 0)}
            />
            <MetricCard
              label="Orders with Offers"
              current={latestMetrics?.ordersWithOffers || 0}
              previous={previousMetrics?.ordersWithOffers}
              trend={getTrend(latestMetrics?.ordersWithOffers || 0, previousMetrics?.ordersWithOffers || 0)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard
              label="Gross Sales from Offers"
              current={Number(latestMetrics?.grossSalesFromOffers) || 0}
              previous={Number(previousMetrics?.grossSalesFromOffers)}
              format="currency"
              trend={getTrend(Number(latestMetrics?.grossSalesFromOffers) || 0, Number(previousMetrics?.grossSalesFromOffers) || 0)}
            />
            <MetricCard
              label="Effective Discount"
              current={Number(latestMetrics?.effectiveDiscount) || 0}
              previous={Number(previousMetrics?.effectiveDiscount)}
              format="percent"
              trend={getTrend(Number(latestMetrics?.effectiveDiscount) || 0, Number(previousMetrics?.effectiveDiscount) || 0)}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
