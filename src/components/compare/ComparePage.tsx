import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trophy, TrendingUp, TrendingDown, Minus, CalendarIcon } from 'lucide-react';
import { format, subDays, startOfWeek, subWeeks } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { sumMetrics, METRICS, formatMetric } from '@/lib/metrics';
import type { Restaurant, MetricComparison, PeriodType } from '@/types';

const API_BASE = 'http://localhost:8000/api';

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
  funnel: ['impressions', 'impressions_to_menu', 'menu_to_cart', 'cart_to_order'],
  marketing: ['sales_from_ads', 'ad_click_through_rate', 'ads_orders', 'ads_impressions', 'ads_spend', 'ads_roi', 'gross_sales_from_offers', 'orders_with_offers', 'discount_given', 'effective_discount'],
};

export function ComparePage() {
  // Restaurant comparison state
  const [searchParams, setSearchParams] = useSearchParams();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);

  // Date range mode state
  const [compareMode, setCompareMode] = useState<'restaurants' | 'daterange'>('restaurants');
  const [rangeRestaurantId, setRangeRestaurantId] = useState<string>('');
  const [rangeA, setRangeA] = useState<DateRange | undefined>({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: new Date(),
  });
  const [rangeB, setRangeB] = useState<DateRange | undefined>({
    from: startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }),
    to: subDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 1),
  });
  const [rangeMetrics, setRangeMetrics] = useState<{ a: any[]; b: any[] }>({ a: [], b: [] });
  const [isRangeLoading, setIsRangeLoading] = useState(false);

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

  useEffect(() => {
    if (compareMode === 'daterange') {
      fetchRangeComparison();
    }
  }, [compareMode, rangeRestaurantId, rangeA, rangeB]);

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
      const response = await fetch(
        `${API_BASE}/metrics/compare?restaurant_a_id=${restaurantAId}&restaurant_b_id=${restaurantBId}&period_type=${periodType}&period_value=${periodValue || ''}`
      );

      if (response.ok) {
        setComparison(await response.json());
      } else {
        toast.error('Failed to fetch comparison data');
      }
    } catch (error) {
      console.error('Failed to fetch comparison:', error);
      toast.error('Failed to compare restaurants');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRangeComparison = async () => {
    if (!rangeRestaurantId || !rangeA?.from || !rangeB?.from) return;
    setIsRangeLoading(true);
    try {
      const aFrom = format(rangeA.from, 'yyyy-MM-dd');
      const aTo = format(rangeA.to ?? rangeA.from, 'yyyy-MM-dd');
      const bFrom = format(rangeB.from, 'yyyy-MM-dd');
      const bTo = format(rangeB.to ?? rangeB.from, 'yyyy-MM-dd');

      const minDate = aFrom < bFrom ? aFrom : bFrom;
      const maxDate = aTo > bTo ? aTo : bTo;

      const { data, error } = await supabase
        .from('daily_metrics')
        .select('*')
        .eq('restaurant_id', rangeRestaurantId)
        .gte('date', minDate)
        .lte('date', maxDate);

      if (error) throw error;

      const rows = data || [];
      setRangeMetrics({
        a: rows.filter(r => r.date >= aFrom && r.date <= aTo),
        b: rows.filter(r => r.date >= bFrom && r.date <= bTo),
      });
    } catch (err) {
      toast.error('Failed to load range comparison');
    } finally {
      setIsRangeLoading(false);
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

  const formatDateRange = (range: DateRange | undefined): string => {
    if (!range?.from) return 'Pick a date';
    if (!range.to) return format(range.from, 'MMM d, yyyy');
    return `${format(range.from, 'MMM d')} - ${format(range.to, 'MMM d, yyyy')}`;
  };

  const countDays = (range: DateRange | undefined): number => {
    if (!range?.from || !range.to) return 1;
    return Math.round((range.to.getTime() - range.from.getTime()) / 86400000) + 1;
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
      {/* Mode Toggle */}
      <Tabs value={compareMode} onValueChange={(v) => setCompareMode(v as 'restaurants' | 'daterange')}>
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="restaurants" className="flex-1">Restaurant vs Restaurant</TabsTrigger>
          <TabsTrigger value="daterange" className="flex-1">Date Range vs Date Range</TabsTrigger>
        </TabsList>
      </Tabs>

      {compareMode === 'restaurants' && (
        <>
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
                                  ? `\u20b9${m.restaurantAValue.toLocaleString('en-IN')}`
                                  : m.restaurantAValue.toLocaleString('en-IN')
                                : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {typeof m.restaurantBValue === 'number'
                                ? m.metric.includes('rate') || m.metric.includes('roi') || m.metric.includes('discount')
                                  ? `${m.restaurantBValue.toFixed(2)}%`
                                  : m.metric.includes('sales') || m.metric.includes('spend') || m.metric.includes('aov') || m.metric.includes('given')
                                  ? `\u20b9${m.restaurantBValue.toLocaleString('en-IN')}`
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
        </>
      )}

      {compareMode === 'daterange' && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Date Range Comparison</h1>
            <p className="text-muted-foreground">
              Compare the same restaurant across two custom time periods
            </p>
          </div>

          {/* Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4">
                {/* Restaurant selector */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Restaurant</label>
                  <Select value={rangeRestaurantId} onValueChange={setRangeRestaurantId}>
                    <SelectTrigger className="w-full max-w-sm">
                      <SelectValue placeholder="Select a restaurant..." />
                    </SelectTrigger>
                    <SelectContent>
                      {restaurants.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Range pickers */}
                <div className="flex flex-wrap gap-4">
                  {/* Range A */}
                  <div>
                    <label className="text-sm font-medium mb-1 block text-primary">Range A (Current)</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn('w-[260px] justify-start text-left font-normal', !rangeA && 'text-muted-foreground')}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formatDateRange(rangeA)}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={rangeA}
                          onSelect={setRangeA}
                          numberOfMonths={2}
                          disabled={{ after: new Date() }}
                        />
                      </PopoverContent>
                    </Popover>
                    {rangeA?.from && (
                      <p className="text-xs text-muted-foreground mt-1">{countDays(rangeA)} days</p>
                    )}
                  </div>

                  {/* Range B */}
                  <div>
                    <label className="text-sm font-medium mb-1 block text-muted-foreground">Range B (Comparison)</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn('w-[260px] justify-start text-left font-normal', !rangeB && 'text-muted-foreground')}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formatDateRange(rangeB)}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={rangeB}
                          onSelect={setRangeB}
                          numberOfMonths={2}
                          disabled={{ after: new Date() }}
                        />
                      </PopoverContent>
                    </Popover>
                    {rangeB?.from && (
                      <p className="text-xs text-muted-foreground mt-1">{countDays(rangeB)} days</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {rangeRestaurantId && rangeA?.from && rangeB?.from && (
            isRangeLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                </CardContent>
              </Card>
            ) : (() => {
              const totalsA = sumMetrics(rangeMetrics.a);
              const totalsB = sumMetrics(rangeMetrics.b);

              return (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Metric Comparison</CardTitle>
                    <CardDescription>
                      <span className="text-primary font-medium">{formatDateRange(rangeA)}</span>
                      {' '}({countDays(rangeA)} days){' '}
                      vs{' '}
                      <span className="text-muted-foreground font-medium">{formatDateRange(rangeB)}</span>
                      {' '}({countDays(rangeB)} days)
                      {countDays(rangeA) !== countDays(rangeB) && (
                        <Badge variant="outline" className="ml-2 text-orange-500 border-orange-300">
                          Different lengths - totals not directly comparable
                        </Badge>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Metric</TableHead>
                          <TableHead className="text-right text-primary">Range A</TableHead>
                          <TableHead className="text-right text-muted-foreground">Range B</TableHead>
                          <TableHead className="text-right">Change</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {METRICS.filter(m => {
                          const a = totalsA[m.key] ?? 0;
                          const b = totalsB[m.key] ?? 0;
                          return a !== 0 || b !== 0;
                        }).map(m => {
                          const a = totalsA[m.key] ?? 0;
                          const b = totalsB[m.key] ?? 0;
                          const pct = b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null;
                          const improved = pct !== null
                            ? (pct > 0 && m.higherIsBetter) || (pct < 0 && !m.higherIsBetter)
                            : false;
                          return (
                            <TableRow key={m.key}>
                              <TableCell className="font-medium text-sm">{m.label}</TableCell>
                              <TableCell className="text-right font-mono text-sm text-primary">
                                {formatMetric(a, m.format)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                {formatMetric(b, m.format)}
                              </TableCell>
                              <TableCell className="text-right">
                                {pct !== null ? (
                                  <Badge variant={improved ? 'default' : 'destructive'} className="text-xs">
                                    {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })()
          )}

          {!rangeRestaurantId && (
            <Empty className="min-h-[300px]">
              <EmptyHeader>
                <EmptyTitle>Select a restaurant to compare date ranges</EmptyTitle>
                <EmptyDescription>
                  Pick a restaurant above, then choose two date windows to compare
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      )}
    </div>
  );
}
