import { useState, useCallback } from 'react';
import { Upload, FileText, Check, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { getAuthToken } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const API_BASE = 'http://localhost:8000/api';

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

interface UploadSummary {
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  restaurants_matched: number;
  anomalies_detected: number;
  errors: string[];
}

export function UploadPage() {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadHistory, setUploadHistory] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    setSelectedFile(file);
    setStatus('idle');
    setError(null);
    setSummary(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setStatus('uploading');
    setProgress(10);
    setError(null);

    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('token', token || '');

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 80));
      }, 500);

      const response = await fetch(`${API_BASE}/upload/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      clearInterval(progressInterval);

      if (response.ok) {
        const data = await response.json();
        setProgress(100);
        setStatus('success');
        setSummary(data.summary);
        toast.success('File uploaded successfully');
        fetchUploadHistory();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Upload failed');
      toast.error('Upload failed');
    }
  };

  const fetchUploadHistory = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/upload/history?limit=10`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setUploadHistory(data.uploads || []);
      }
    } catch (error) {
      console.error('Failed to fetch upload history:', error);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload Data</h1>
        <p className="text-muted-foreground">
          Upload Zomato CSV reports to process restaurant data
        </p>
      </div>

      {/* Upload Zone */}
      <Card>
        <CardContent className="pt-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                {status === 'idle' && (
                  <Button onClick={handleUpload}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload and Process
                  </Button>
                )}

                {status === 'uploading' && (
                  <div className="w-full max-w-sm">
                    <Progress value={progress} className="mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {progress < 50 ? 'Uploading...' : 'Processing...'}
                    </p>
                  </div>
                )}

                {status === 'success' && (
                  <div className="flex items-center gap-2 text-emerald-500">
                    <Check className="h-5 w-5" />
                    <span>Upload complete!</span>
                  </div>
                )}

                {status === 'error' && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    setStatus('idle');
                    setProgress(0);
                    setSummary(null);
                  }}
                >
                  Clear and select another file
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-muted rounded-full">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Drop your CSV file here</p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse
                  </p>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  id="file-upload"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
                <Button variant="outline" asChild>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    Browse Files
                  </label>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Summary */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-500" />
              Import Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{summary.total_rows}</div>
                <div className="text-sm text-muted-foreground">Total Rows</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-emerald-500">{summary.imported_rows}</div>
                <div className="text-sm text-muted-foreground">Imported</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-orange-500">{summary.skipped_rows}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{summary.restaurants_matched}</div>
                <div className="text-sm text-muted-foreground">Restaurants</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-red-500">{summary.anomalies_detected}</div>
                <div className="text-sm text-muted-foreground">Anomalies</div>
              </div>
            </div>

            {summary.errors && summary.errors.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Errors:</p>
                <ul className="text-sm text-muted-foreground">
                  {summary.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload History */}
      <Card>
        <CardHeader>
          <CardTitle>Upload History</CardTitle>
          <CardDescription>Recent file uploads</CardDescription>
        </CardHeader>
        <CardContent>
          {uploadHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No uploads yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadHistory.map((upload) => (
                  <TableRow key={upload.id}>
                    <TableCell className="font-medium">{upload.file_name}</TableCell>
                    <TableCell>{upload.row_count}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          upload.status === 'processed'
                            ? 'default'
                            : upload.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {upload.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{upload.uploaded_by_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(upload.uploaded_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Format Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Expected CSV Format</CardTitle>
          <CardDescription>Columns that will be recognized</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h4 className="font-medium mb-2">Sales</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>restaurant_name / name</li>
                <li>date / order_date</li>
                <li>sales / total_sales / revenue</li>
                <li>delivered_orders / orders</li>
                <li>average_order_value / aov</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Funnel</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>impressions / page_views</li>
                <li>menu_to_order / mto</li>
                <li>menu_to_cart / mtc</li>
                <li>cart_to_order / cto</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Marketing</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>sales_from_ads / ad_sales</li>
                <li>ad_click_through_rate / ctr</li>
                <li>ads_orders / ad_orders</li>
                <li>ads_spend / ad_spend</li>
                <li>ads_roi / roi</li>
                <li>gross_sales_from_offers</li>
                <li>discount_given / discount</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
