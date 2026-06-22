import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { sumMetrics, METRICS } from '@/lib/metrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import type { Restaurant, MetricComparison, PeriodType, DailyMetrics } from '@/types';

interface ComparisonResult {
  restaurants: {
    a: Restaurant;
    b: Restaurant;
  };
  period: {
    type: string;
    value: string;
  };
  comparisons: MetricComparison[];
  summary: string;
  wins: { a: number; b: number };
}

const METRIC_GROUPS = {
  sales: ['sales', 'delivered_orders', 'average_order_value'],
  funnel: ['impressions', 'menu_to_order', 'menu_to_cart', 'cart_to_order'],
  marketing: ['sales_from_ads', 'ad_click_through_rate', 'ads_orders', 'ads_impressions', 'ads_spend', 'ads_roi', 'gross_sales_from_offers', 'orders_with_offers', 'discount_given', 'effective_discount'],
};

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);

  // Get initial values from URL params
  const restaurantAId = searchParams.get('a') || '';
  const restaurantBId = searchParams.get('b') || '';
  const periodType = (searchParams.get('period') || 'daily') as PeriodType;
  const periodValue = searchParams.get('value') || '';

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (restaurantAId && restaurantBId) {
      fetchComparison();
    }
  }, [restaurantAId, restaurantBId, periodType, periodValue]);

  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('is_archived', false)
        .order('name');

      if (error) throw error;
      setRestaurants(data || []);
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
    }
  };

  const fetchComparison = async () => {
    setIsLoading(true);
    try {
      // Fetch restaurant data
      const { data: restaurantA } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantAId)
        .single();

      const { data: restaurantB } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantBId)
        .single();

      if (!restaurantA || !restaurantB) {
        toast.error('Failed to fetch restaurant data');
        setIsLoading(false);
        return;
      }

      // Determine date range based on period type and value
      let startDate: string;
      let endDate: string;
      let displayValue: string;

      if (periodType === 'daily') {
        startDate = periodValue;
        endDate = periodValue;
        displayValue = periodValue;
      } else if (periodType === 'weekly') {
        // periodValue is expected to be in format "YYYY-Www" (e.g., "2024-W01")
        const [year, week] = periodValue.split('-W');
        const yearNum = parseInt(year);
        const weekNum = parseInt(week);
        const jan4 = new Date(yearNum, 0, 4);
        const dayOfWeek = jan4.getDay() || 7;
        const weekStart = new Date(jan4);
        weekStart.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNum - 1) * 7);
        startDate = weekStart.toISOString().split('T')[0];
        endDate = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        displayValue = periodValue;
      } else {
        // monthly - periodValue expected to be in format "YYYY-MM"
        const [year, month] = periodValue.split('-');
        startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        endDate = `${year}-${month}-${lastDay}`;
        displayValue = periodValue;
      }

      // Fetch metrics for restaurant A
      const { data: metricsA, error: errorA } = await supabase
        .from('daily_metrics')
        .select('*')
        .eq('restaurant_id', restaurantAId)
        .gte('date', startDate)
        .lte('date', endDate);

      // Fetch metrics for restaurant B
      const { data: metricsB, error: errorB } = await supabase
        .from('daily_metrics')
        .select('*')
        .eq('restaurant_id', restaurantBId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (errorA || errorB) throw new Error('Failed to fetch metrics');

      // Convert metric keys from snake_case to camelCase for sumMetrics
      const convertToCamelCase = (metricsArray: DailyMetrics[]): Record<string, unknown>[] => {
        return metricsArray.map(m => {
          const camelCased: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(m)) {
            // Convert snake_case to camelCase
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            camelCased[camelKey] = value;
          }
          return camelCased;
        });
      };

      const summedA = sumMetrics(convertToCamelCase(metricsA || []));
      const summedB = sumMetrics(convertToCamelCase(metricsB || []));

      // Build comparison array
      const comparisons: MetricComparison[] = [];
      let winsA = 0;
      let winsB = 0;

      for (const metric of METRICS) {
        const valA = summedA[metric.key] ?? 0;
        const valB = summedB[metric.key] ?? 0;

        const absoluteDifference = valB - valA;
        const percentageDifference = valA !== 0
          ? ((valB - valA) / Math.abs(valA)) * 100
          : 0;

        let winner: 'A' | 'B' | 'tie' = 'tie';
        if (metric.higherIsBetter) {
          if (valA > valB) {
            winner = 'A';
            winsA++;
          } else if (valB > valA) {
            winner = 'B';
            winsB++;
          }
        } else {
          if (valA < valB) {
            winner = 'A';
            winsA++;
          } else if (valB < valA) {
            winner = 'B';
            winsB++;
          }
        }

        comparisons.push({
          metric: metric.key,
          label: metric.label,
          restaurantAValue: valA,
          restaurantBValue: valB,
          absoluteDifference,
          percentageDifference,
          winner,
        });
      }

      const summary = winsA > winsB
        ? `${restaurantA.display_name} is performing better across ${winsA} metrics`
        : winsB > winsA
        ? `${restaurantB.display_name} is performing better across ${winsB} metrics`
        : 'Both restaurants are evenly matched';

      setComparison({
        restaurants: {
          a: restaurantA,
          b: restaurantB,
        },
        period: {
          type: periodType,
          value: displayValue,
        },
        comparisons,
        summary,
        wins: { a: winsA, b: winsB },
      });
    } catch (error) {
      console.error('Failed to fetch comparison:', error);
      toast.error('Failed to compare restaurants');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRestaurant = (key: 'a' | 'b', value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    setSearchParams(params);
  };

  const handlePeriodChange = (type: PeriodType) => {
    const params = new URLSearchParams(searchParams);
    params.set('period', type);
    setSearchParams(params);
  };

  // Group comparisons for display
  const groupedComparisons = useMemo(() => {
    if (!comparison?.comparisons) return {};

    const groups: Record<string, MetricComparison[]> = {};
    comparison.comparisons.forEach((c) => {
      let group = 'other';
      for (const [g, metrics] of Object.entries(METRIC_GROUPS)) {
        if (metrics.includes(c.metric)) {
          group = g;
          break;
        }
      }
      if (!groups[group]) groups[group] = [];
      groups[group].push(c);
    });

    return groups;
  }, [comparison]);

  // Chart data
  const chartData = useMemo(() => {
    if (!comparison?.comparisons) return [];
    return comparison.comparisons.slice(0, 6).map((c) => ({
      metric: c.label,
      [comparison.restaurants.a.displayName]: c.restaurantAValue,
      [comparison.restaurants.b.displayName]: c.restaurantBValue,
    }));
  }, [comparison]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compare Restaurants</h1>
        <p className="text-muted-foreground">
          Compare performance metrics between two restaurants
        </p>
      </div>

      {/* Restaurant Selectors */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Restaurant A</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={restaurantAId}
              onValueChange={(v) => handleSelectRestaurant('a', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select restaurant..." />
              </SelectTrigger>
              <SelectContent>
                {restaurants
                  .filter((r) => r.id !== restaurantBId)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.displayName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Period</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={periodType} onValueChange={(v) => handlePeriodChange(v as PeriodType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Restaurant B</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={restaurantBId}
              onValueChange={(v) => handleSelectRestaurant('b', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select restaurant..." />
              </SelectTrigger>
              <SelectContent>
                {restaurants
                  .filter((r) => r.id !== restaurantAId)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.displayName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Results */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !comparison ? (
        <Empty className="min-h-[400px]">
          <EmptyHeader>
            <EmptyTitle>Select Two Restaurants</EmptyTitle>
            <EmptyDescription>
              Choose two restaurants above to compare their performance metrics
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Comparison Summary</CardTitle>
              <CardDescription>
                {comparison.period.type === 'daily' ? 'Date: ' : comparison.period.type === 'weekly' ? 'Week: ' : 'Month: '}
                {comparison.period.value}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{comparison.wins.a}</div>
                    <div className="text-sm text-muted-foreground">metrics won</div>
                  </div>
                  <Badge>{comparison.restaurants.a.displayName}</Badge>
                </div>

                <div className="text-muted-foreground">vs</div>

                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{comparison.restaurants.b.displayName}</Badge>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{comparison.wins.b}</div>
                    <div className="text-sm text-muted-foreground">metrics won</div>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mt-4">{comparison.summary}</p>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Visual Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={chartData.reduce((acc, d) => {
                  Object.keys(d).forEach((k) => {
                    if (k !== 'metric') {
                      acc[k] = { label: k, color: comparison.restaurants.a.displayName === k ? 'var(--chart-1)' : 'var(--chart-2)' };
                    }
                  });
                  return acc;
                }, {} as Record<string, { label: string; color: string }>)}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis dataKey="metric" type="category" tickLine={false} axisLine={false} width={120} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey={comparison.restaurants.a.displayName} fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey={comparison.restaurants.b.displayName} fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Metric Tables by Group */}
          {Object.entries(groupedComparisons).map(([group, metrics]) => (
            <Card key={group}>
              <CardHeader>
                <CardTitle className="capitalize">{group === 'sales' ? 'Sales Overview' : group === 'funnel' ? 'Customer Funnel' : 'Marketing'}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead className="text-right">{comparison.restaurants.a.displayName}</TableHead>
                      <TableHead className="text-right">{comparison.restaurants.b.displayName}</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-center">Winner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.map((m) => (
                      <TableRow key={m.metric}>
                        <TableCell className="font-medium">{m.label}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {typeof m.restaurantAValue === 'number'
                            ? m.metric.includes('rate') || m.metric.includes('roi') || m.metric.includes('discount')
                              ? `${m.restaurantAValue.toFixed(2)}%`
                              : m.metric.includes('sales') || m.metric.includes('spend') || m.metric.includes('aov') || m.metric.includes('given')
                              ? `₹${m.restaurantAValue.toLocaleString('en-IN')}`
                              : m.restaurantAValue.toLocaleString('en-IN')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {typeof m.restaurantBValue === 'number'
                            ? m.metric.includes('rate') || m.metric.includes('roi') || m.metric.includes('discount')
                              ? `${m.restaurantBValue.toFixed(2)}%`
                              : m.metric.includes('sales') || m.metric.includes('spend') || m.metric.includes('aov') || m.metric.includes('given')
                              ? `₹${m.restaurantBValue.toLocaleString('en-IN')}`
                              : m.restaurantBValue.toLocaleString('en-IN')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <div className="flex items-center justify-end gap-1">
                            {m.absoluteDifference > 0 ? (
                              <TrendingUp className="h-3 w-3 text-emerald-500" />
                            ) : m.absoluteDifference < 0 ? (
                              <TrendingDown className="h-3 w-3 text-red-500" />
                            ) : (
                              <Minus className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span
                              className={
                                m.absoluteDifference > 0
                                  ? 'text-emerald-500'
                                  : m.absoluteDifference < 0
                                  ? 'text-red-500'
                                  : 'text-muted-foreground'
                              }
                            >
                              {m.absoluteDifference > 0 ? '+' : ''}{m.absoluteDifference.toFixed(0)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span
                            className={
                              m.percentageDifference > 0
                                ? 'text-emerald-500'
                                : m.percentageDifference < 0
                                ? 'text-red-500'
                                : 'text-muted-foreground'
                            }
                          >
                            {m.percentageDifference > 0 ? '+' : ''}{m.percentageDifference.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {m.winner === 'A' ? (
                            <Badge className="bg-primary text-primary-foreground">
                              <Trophy className="h-3 w-3 mr-1" />
                              A
                            </Badge>
                          ) : m.winner === 'B' ? (
                            <Badge variant="secondary">
                              <Trophy className="h-3 w-3 mr-1" />
                              B
                            </Badge>
                          ) : (
                            <Badge variant="outline">Tie</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
