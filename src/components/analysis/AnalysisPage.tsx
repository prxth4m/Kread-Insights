import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrendingUp, TrendingDown, RefreshCw, Loader2 } from 'lucide-react';
import { subDays, subWeeks, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { METRICS, sumMetrics, formatMetric, computePercentageChange, isImprovement, type MetricKey, type MetricDefinition } from '@/lib/metrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  ReferenceArea,
} from 'recharts';
import type { Restaurant } from '@/types';

interface Preset {
  id: string;
  label: string;
  getCurrentRange: () => { start: Date; end: Date };
  getPreviousRange: () => { start: Date; end: Date };
}

const PRESETS: Preset[] = [
  {
    id: 'today-vs-yesterday',
    label: 'Today vs Yesterday',
    getCurrentRange: () => ({ start: startOfDay(new Date()), end: endOfDay(new Date()) }),
    getPreviousRange: () => ({ start: startOfDay(subDays(new Date(), 1)), end: endOfDay(subDays(new Date(), 1)) }),
  },
  {
    id: 'this-vs-last-week',
    label: 'This Week vs Last Week',
    getCurrentRange: () => ({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }) }),
    getPreviousRange: () => ({ start: startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), end: endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }) }),
  },
  {
    id: 'last-7-vs-prior-7',
    label: 'Last 7 Days vs Prior 7',
    getCurrentRange: () => ({ start: startOfDay(subDays(new Date(), 7)), end: endOfDay(new Date()) }),
    getPreviousRange: () => ({ start: startOfDay(subDays(new Date(), 14)), end: endOfDay(subDays(new Date(), 7)) }),
  },
  {
    id: 'this-vs-last-month',
    label: 'This Month vs Last Month',
    getCurrentRange: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }),
    getPreviousRange: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }),
  },
];

interface MetricDelta {
  metric: MetricDefinition;
  current: number;
  previous: number;
  pctChange: number | null;
  isImprovement: boolean;
}

export function AnalysisPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const restaurantId = searchParams.get('restaurantId') || '';
  const presetId = searchParams.get('preset') || 'this-vs-last-week';
  const selectedMetricKey = (searchParams.get('metric') || 'sales') as MetricKey;

  const preset = PRESETS.find(p => p.id === presetId) || PRESETS[1];
  const currentRange = preset.getCurrentRange();
  const previousRange = preset.getPreviousRange();

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (restaurantId) {
      fetchMetrics();
    }
  }, [restaurantId, presetId]);

  const fetchRestaurants = async () => {
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .eq('is_archived', false)
      .order('name');
    setRestaurants(data || []);

    // Auto-select first restaurant if none selected
    if (!restaurantId && data && data.length > 0) {
      setSearchParams(params => {
        params.set('restaurantId', data[0].id);
        return params;
      });
    }
  };

  const fetchMetrics = async () => {
    setIsLoading(true);
    const earliestDate = previousRange.start < currentRange.start ? previousRange.start : currentRange.start;
    const latestDate = previousRange.end > currentRange.end ? previousRange.end : currentRange.end;

    const { data } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('date', earliestDate.toISOString().split('T')[0])
      .lte('date', latestDate.toISOString().split('T')[0])
      .order('date');

    setMetrics(data || []);
    setIsLoading(false);
    setAiInsights(null);
  };

  const currentMetrics = useMemo(() => {
    const start = currentRange.start.toISOString().split('T')[0];
    const end = currentRange.end.toISOString().split('T')[0];
    return metrics.filter(m => m.date >= start && m.date <= end);
  }, [metrics, currentRange]);

  const previousMetrics = useMemo(() => {
    const start = previousRange.start.toISOString().split('T')[0];
    const end = previousRange.end.toISOString().split('T')[0];
    return metrics.filter(m => m.date >= start && m.date <= end);
  }, [metrics, previousRange]);

  const currentTotals = useMemo(() => sumMetrics(currentMetrics), [currentMetrics]);
  const previousTotals = useMemo(() => sumMetrics(previousMetrics), [previousMetrics]);

  const deltas: MetricDelta[] = useMemo(() => {
    return METRICS.map(m => {
      const current = Number(currentTotals[m.key]) || 0;
      const previous = Number(previousTotals[m.key]) || 0;
      const pct = computePercentageChange(current, previous);
      return {
        metric: m,
        current,
        previous,
        pctChange: pct,
        isImprovement: isImprovement(pct, m.higherIsBetter),
      };
    });
  }, [currentTotals, previousTotals]);

  const topImprovements = useMemo(() =>
    deltas
      .filter(d => d.isImprovement && d.pctChange !== null && Math.abs(d.pctChange) >= 3)
      .sort((a, b) => Math.abs(b.pctChange!) - Math.abs(a.pctChange!))
      .slice(0, 5),
    [deltas]);

  const topDeclines = useMemo(() =>
    deltas
      .filter(d => !d.isImprovement && d.pctChange !== null && Math.abs(d.pctChange) >= 3)
      .sort((a, b) => Math.abs(b.pctChange!) - Math.abs(a.pctChange!))
      .slice(0, 5),
    [deltas]);

  const performanceStatus = useMemo(() => {
    if (topImprovements.length > topDeclines.length + 2) return 'Strong Growth';
    if (topDeclines.length > topImprovements.length + 2) return 'Needs Attention';
    return 'Mixed Results';
  }, [topImprovements, topDeclines]);

  const selectedRestaurant = restaurants.find(r => r.id === restaurantId);

  const selectedMetricDef = METRICS.find(m => m.key === selectedMetricKey) || METRICS[0];

  const trendData = useMemo(() => {
    return metrics.map(m => ({
      date: m.date,
      value: Number(m[selectedMetricKey]) || 0,
      isCurrent: m.date >= currentRange.start.toISOString().split('T')[0] && m.date <= currentRange.end.toISOString().split('T')[0],
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [metrics, selectedMetricKey, currentRange, previousRange]);

  const fetchAiInsights = async () => {
    if (!selectedRestaurant) return;
    setAiLoading(true);

    const significantDeltas = deltas
      .filter(d => d.pctChange !== null && Math.abs(d.pctChange) >= 5)
      .map(d => `${d.metric.label}: ${d.current} vs ${d.previous} (${d.pctChange!.toFixed(1)}%)`)
      .join('\n');

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: 'You are a concise restaurant performance analyst. Output only plain text insight sentences, one per line, no formatting.',
          messages: [{
            role: 'user',
            content: `You are a restaurant business analyst. Analyze this performance data for ${selectedRestaurant.displayName} and write 4-5 concise business insights.

Period: ${preset.label}

Metric changes (current vs previous, sorted by magnitude):
${significantDeltas}

Write 4-5 short, plain-English sentences. Each should explain what changed and what it means, identify a pattern, or flag something needing attention. No bullet points, no markdown, no headers. Separate insights with newlines. Keep each under 25 words.`
          }]
        })
      });

      const data = await response.json();
      const text = data.content?.[0]?.text ?? '';
      setAiInsights(text.split('\n').filter(Boolean));
    } catch (error) {
      console.error('Failed to fetch AI insights:', error);
      setAiInsights(['Analysis unavailable at this time.']);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (restaurantId && !aiLoading && aiInsights === null) {
      fetchAiInsights();
    }
  }, [restaurantId, presetId]);

  const handleRestaurantChange = (id: string) => {
    setSearchParams(params => {
      params.set('restaurantId', id);
      return params;
    });
  };

  const handlePresetChange = (id: string) => {
    setSearchParams(params => {
      params.set('preset', id);
      return params;
    });
  };

  const handleMetricChange = (key: string) => {
    setSearchParams(params => {
      params.set('metric', key);
      return params;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performance Analysis</h1>
        <p className="text-muted-foreground">
          Compare performance across time periods for a single restaurant
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={restaurantId} onValueChange={handleRestaurantChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select restaurant..." />
          </SelectTrigger>
          <SelectContent>
            {restaurants.map(r => (
              <SelectItem key={r.id} value={r.id}>{r.displayName}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1">
          {PRESETS.map(p => (
            <Button
              key={p.id}
              variant={presetId === p.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePresetChange(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {!restaurantId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a restaurant to analyze performance
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* Executive Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedRestaurant?.displayName}</CardTitle>
                  <CardDescription>{preset.label}</CardDescription>
                </div>
                <Badge variant={performanceStatus === 'Strong Growth' ? 'default' : performanceStatus === 'Needs Attention' ? 'destructive' : 'secondary'}>
                  {performanceStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                {['sales', 'delivered_orders', 'ads_roi', 'average_rating'].map(key => {
                  const d = deltas.find(d => d.metric.key === key);
                  if (!d) return null;
                  return (
                    <div key={key} className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">{d.metric.label}</div>
                      <div className="text-xl font-bold">{formatMetric(d.current, d.metric.format)}</div>
                      {d.pctChange !== null && (
                        <div className={`flex items-center gap-1 text-sm ${d.isImprovement ? 'text-emerald-500' : 'text-red-500'}`}>
                          {d.isImprovement ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {d.pctChange > 0 ? '+' : ''}{d.pctChange.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Key Metric Changes */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-emerald-500 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Top Improvements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topImprovements.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No significant improvements detected</p>
                ) : (
                  <ul className="space-y-2">
                    {topImprovements.map(d => (
                      <li key={d.metric.key} className="flex items-center justify-between p-2 bg-emerald-500/10 rounded border-l-2 border-emerald-500">
                        <span className="font-medium">{d.metric.label}</span>
                        <div className="flex items-center gap-2">
                          <span>{formatMetric(d.current, d.metric.format)}</span>
                          <Badge variant="default" className="bg-emerald-500">+{d.pctChange!.toFixed(1)}%</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-red-500 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Top Declines
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topDeclines.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No significant declines detected</p>
                ) : (
                  <ul className="space-y-2">
                    {topDeclines.map(d => (
                      <li key={d.metric.key} className="flex items-center justify-between p-2 bg-red-500/10 rounded border-l-2 border-red-500">
                        <span className="font-medium">{d.metric.label}</span>
                        <div className="flex items-center gap-2">
                          <span>{formatMetric(d.current, d.metric.format)}</span>
                          <Badge variant="destructive">{d.pctChange!.toFixed(1)}%</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Category Analysis */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {['sales', 'funnel', 'marketing'].map(group => (
              <Card key={group}>
                <CardHeader>
                  <CardTitle className="capitalize">
                    {group === 'sales' ? 'Sales Overview' : group === 'funnel' ? 'Customer Funnel' : 'Ads Performance'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {deltas
                      .filter(d => d.metric.group === group)
                      .filter(d => d.current !== 0 || d.previous !== 0)
                      .slice(0, 6)
                      .map(d => (
                        <div key={d.metric.key} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{d.metric.label}</span>
                          <div className="flex items-center gap-2">
                            <span>{formatMetric(d.current, d.metric.format)}</span>
                            {d.pctChange !== null && (
                              <span className={d.isImprovement ? 'text-emerald-500' : 'text-red-500'}>
                                {d.pctChange > 0 ? '+' : ''}{d.pctChange.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Offers & Discounts */}
            <Card>
              <CardHeader>
                <CardTitle>Offers & Discounts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {deltas
                    .filter(d => d.metric.key.includes('offer') || d.metric.key.includes('discount'))
                    .filter(d => d.current !== 0 || d.previous !== 0)
                    .slice(0, 6)
                    .map(d => (
                      <div key={d.metric.key} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{d.metric.label}</span>
                        <div className="flex items-center gap-2">
                          <span>{formatMetric(d.current, d.metric.format)}</span>
                          {d.pctChange !== null && (
                            <span className={d.isImprovement ? 'text-emerald-500' : 'text-red-500'}>
                              {d.pctChange > 0 ? '+' : ''}{d.pctChange.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trend Analysis */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Trend Analysis</CardTitle>
                <Select value={selectedMetricKey} onValueChange={handleMetricChange}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="delivered_orders">Orders</SelectItem>
                    <SelectItem value="average_order_value">AOV</SelectItem>
                    <SelectItem value="ads_roi">Ads ROI</SelectItem>
                    <SelectItem value="impressions">Impressions</SelectItem>
                    <SelectItem value="ads_spend">Ad Spend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{ value: { label: selectedMetricDef.label, color: 'var(--chart-1)' } }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={d => format(new Date(d), 'MMM d')} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ReferenceArea
                      x1={previousRange.start.toISOString().split('T')[0]}
                      x2={previousRange.end.toISOString().split('T')[0]}
                      fill="var(--muted)"
                      fillOpacity={0.3}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-value)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-muted rounded" /> Previous Period</div>
                <div>Lines show daily values for both periods</div>
              </div>
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Business Insights
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={fetchAiInsights} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Regenerate
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {aiLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : aiInsights ? (
                <ul className="space-y-3">
                  {aiInsights.map((insight, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-primary">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">Analysis unavailable</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
