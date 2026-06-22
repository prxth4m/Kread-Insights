import { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Calendar,
  FileType,
  Loader2,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Restaurant, ReportType, ReportFormat } from '@/types';

export function ReportsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([]);
  const [format, setFormat] = useState<ReportFormat>('csv');

  useEffect(() => {
    fetchRestaurants();
    fetchReports();
  }, []);

  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('is_archived', false);

      if (error) {
        console.error('Failed to fetch restaurants:', error);
        return;
      }

      setRestaurants(data || []);
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
    }
  };

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*, users(name)')
        .order('generated_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch reports:', error);
        toast.error('Failed to load reports');
        return;
      }

      setReports(data || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!periodStart || !periodEnd || selectedRestaurants.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to generate a report');
      return;
    }

    setIsGenerating(true);
    try {
      const { error } = await supabase.from('reports').insert({
        generated_by: user.id,
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd,
        restaurant_ids: selectedRestaurants,
        format,
      });

      if (error) {
        toast.error('Failed to generate report');
        return;
      }

      toast.success('Report generated successfully');
      setIsDialogOpen(false);
      fetchReports();
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const reportTypeLabels: Record<ReportType, string> = {
    daily: 'Daily Report',
    weekly: 'Weekly Report',
    fortnightly: 'Fortnightly Report',
    monthly: 'Monthly Report',
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and export restaurant performance reports
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Generate Report</DialogTitle>
              <DialogDescription>
                Create a new restaurant performance report
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label>Start Date</Label>
                  <input
                    type="date"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>End Date</Label>
                  <input
                    type="date"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Restaurants</Label>
                <Select
                  value={selectedRestaurants[0] || ''}
                  onValueChange={(v) => setSelectedRestaurants([v])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select restaurant..." />
                  </SelectTrigger>
                  <SelectContent>
                    {restaurants.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as ReportFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="xlsx">Excel</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerateReport} disabled={isGenerating}>
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reports History */}
      <Card>
        <CardHeader>
          <CardTitle>Report History</CardTitle>
          <CardDescription>Previously generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No reports generated yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileType className="h-4 w-4 text-muted-foreground" />
                        <span>{reportTypeLabels[report.report_type as ReportType]}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {report.period_start} - {report.period_end}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{report.format.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(report.generated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
