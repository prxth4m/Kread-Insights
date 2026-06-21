import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Store,
  IndianRupee,
  ShoppingCart,
  BarChart3,
  AlertTriangle,
  Percent,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { getAuthToken } from '@/context/AuthContext';
import type { Alert as AlertType } from '@/types';

const API_BASE = 'http://localhost:8000/api';

interface KPICardProps {
  title: string;
  value: string | number;
  previousValue?: string | number;
  change?: {
    absolute: number;
    percentage: number;
    trend: 'up' | 'down' | 'neutral';
  };
  icon?: React.ReactNode;
  isLoading?: boolean;
  format?: 'currency' | 'number' | 'percent';
}

function KPICard({ title, value, previousValue, change, icon, isLoading, format = 'number' }: KPICardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;
    if (format === 'currency') return `₹${val.toLocaleString('en-IN')}`;
    if (format === 'percent') return `${val}%`;
    return val.toLocaleString('en-IN');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription className="text-sm">{title}</CardDescription>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(value)}</div>
        {change && (
          <div className="flex items-center gap-1 mt-1">
            {change.trend === 'up' ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : change.trend === 'down' ? (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ) : null}
            <span
              className={`text-xs ${
                change.trend === 'up'
                  ? 'text-emerald-500'
                  : change.trend === 'down'
                  ? 'text-red-500'
                  : 'text-muted-foreground'
              }`}
            >
              {change.percentage > 0 ? '+' : ''}{change.percentage.toFixed(1)}%
            </span>
            {previousValue !== undefined && (
              <span className="text-xs text-muted-foreground ml-1">
                vs {formatValue(previousValue)}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RankingItem {
  rank: number;
  restaurant_id: string;
  restaurant_name: string;
  metric_value: number;
}

function RankingsCard({ title, rankings, isLoading, metric }: { title: string; rankings: RankingItem[]; isLoading: boolean; metric: string }) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-full mb-2" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>By {metric}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rankings.map((item) => (
            <div
              key={item.restaurant_id}
              className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer"
              onClick={() => navigate(`/restaurants/${item.restaurant_id}`)}
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="w-6 justify-center">
                  {item.rank}
                </Badge>
                <span className="text-sm font-medium truncate max-w-[150px]">
                  {item.restaurant_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  ₹{item.metric_value.toLocaleString('en-IN')}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState<Record<string, any>>({});
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [topPerformers, setTopPerformers] = useState<RankingItem[]>([]);
  const [bottomPerformers, setBottomPerformers] = useState<RankingItem[]>([]);
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [dateValue] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchDashboardData();
  }, [periodType, dateValue]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const token = getAuthToken();

      // Fetch overview metrics
      const metricsRes = await fetch(
        `${API_BASE}/metrics/overview?period_type=${periodType}&date_value=${dateValue}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setKpis(data.kpis || {});
      }

      // Fetch alerts
      const alertsRes = await fetch(`${API_BASE}/alerts/?limit=10`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }

      // Fetch rankings
      const topRes = await fetch(
        `${API_BASE}/metrics/rankings?category=top_performers&metric=sales&period_type=${periodType}&limit=5`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (topRes.ok) {
        const data = await topRes.json();
        setTopPerformers(data.rankings || []);
      }

      const bottomRes = await fetch(
        `${API_BASE}/metrics/rankings?category=bottom_performers&metric=sales&period_type=${periodType}&limit=5`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (bottomRes.ok) {
        const data = await bottomRes.json();
        setBottomPerformers(data.rankings || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">
            Monitor restaurant performance across all locations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as typeof periodType)}>
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

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Restaurants"
          value={kpis.total_restaurants?.current || 0}
          icon={<Store className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Sales"
          value={kpis.total_sales?.current || 0}
          previousValue={kpis.total_sales?.previous}
          change={kpis.total_sales?.change}
          icon={<IndianRupee className="h-4 w-4" />}
          format="currency"
          isLoading={isLoading}
        />
        <KPICard
          title="Total Orders"
          value={kpis.total_orders?.current || 0}
          previousValue={kpis.total_orders?.previous}
          change={kpis.total_orders?.change}
          icon={<ShoppingCart className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Average AOV"
          value={kpis.average_aov?.current || 0}
          previousValue={kpis.average_aov?.previous}
          change={kpis.average_aov?.change}
          icon={<BarChart3 className="h-4 w-4" />}
          format="currency"
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Average ROI"
          value={kpis.average_roi?.current || 0}
          previousValue={kpis.average_roi?.previous}
          change={kpis.average_roi?.change}
          icon={<Percent className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Ad Spend"
          value={kpis.total_ad_spend?.current || 0}
          previousValue={kpis.total_ad_spend?.previous}
          change={kpis.total_ad_spend?.change}
          icon={<Activity className="h-4 w-4" />}
          format="currency"
          isLoading={isLoading}
        />
        <KPICard
          title="Total Offer Sales"
          value={kpis.total_offer_sales?.current || 0}
          previousValue={kpis.total_offer_sales?.previous}
          change={kpis.total_offer_sales?.change}
          icon={<IndianRupee className="h-4 w-4" />}
          format="currency"
          isLoading={isLoading}
        />
        <KPICard
          title="Active Alerts"
          value={kpis.active_alerts?.current || 0}
          icon={<AlertTriangle className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>

      {/* Rankings & Alerts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <RankingsCard
          title="Top Performers"
          rankings={topPerformers}
          isLoading={isLoading}
          metric="Sales"
        />
        <RankingsCard
          title="Weakest Performers"
          rankings={bottomPerformers}
          isLoading={isLoading}
          metric="Sales"
        />

        {/* Alerts Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Alerts</CardTitle>
            <CardDescription>
              {alerts.length} active anomalies detected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
                  <AlertTriangle className="h-8 w-8 mb-2 opacity-50" />
                  <p>No active alerts</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="text-sm flex items-center gap-2">
                        {alert.restaurantName || 'Restaurant'}
                        <Badge variant={getSeverityColor(alert.severity)} className="text-xs">
                          {alert.severity}
                        </Badge>
                      </AlertTitle>
                      <AlertDescription className="text-xs">
                        {alert.metricName} dropped {alert.percentageDrop}%
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
