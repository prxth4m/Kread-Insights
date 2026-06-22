import { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Check, AlertCircle, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { parseFile, commitImport, createUploadedFile, type ParseResult } from '@/lib/csv-process';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type Step = 'select' | 'parse' | 'preview' | 'import' | 'done';

export function UploadPage() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('select');
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [autoCreate, setAutoCreate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadHistory, setUploadHistory] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; autoCreated: number } | null>(null);

  useEffect(() => {
    fetchUploadHistory();
  }, []);

  const fetchUploadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('uploaded_files')
        .select('*, users(name)')
        .order('uploaded_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setUploadHistory((data || []).map(u => ({
        ...u,
        uploaded_by_name: u.users?.name || 'Unknown'
      })));
    } catch (error) {
      console.error('Failed to fetch upload history:', error);
    }
  };

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
    const isValidFile = file.name.match(/\.(csv|xlsx|xls)$/i);
    if (!isValidFile) {
      toast.error('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    setSelectedFile(file);
    setStep('parse');
    setError(null);
    setParseResult(null);
    setImportResult(null);
    handleParse(file);
  };

  const handleParse = async (file: File) => {
    setIsLoading(true);
    setProgress(20);
    setError(null);

    try {
      setProgress(50);
      const result = await parseFile(file);
      setProgress(100);
      setParseResult(result);

      if (result.errors.length > 0) {
        setError(result.errors.join('\n'));
      }

      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
      setStep('select');
      toast.error('Failed to parse file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!parseResult || !user) return;

    setStep('import');
    setIsLoading(true);
    setProgress(10);
    setError(null);

    try {
      // Create uploaded file record
      setProgress(20);
      const uploadedFileId = await createUploadedFile(selectedFile!, user.id);

      setProgress(40);
      const result = await commitImport(parseResult, uploadedFileId, user.id, autoCreate);

      setProgress(100);
      setImportResult({ imported: result.imported, autoCreated: result.autoCreated });

      if (result.errors.length > 0) {
        setError(result.errors.join('\n'));
      }

      setStep('done');
      toast.success(`Import complete: ${result.imported} rows imported`);
      fetchUploadHistory();

      // Dispatch event for other components to refresh
      window.dispatchEvent(new Event('kread:data-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
      toast.error('Import failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep('select');
    setSelectedFile(null);
    setParseResult(null);
    setImportResult(null);
    setError(null);
    setProgress(0);
  };

  const knownCount = parseResult?.matches.filter(m => m.existing_id).length || 0;
  const newCount = parseResult?.matches.filter(m => !m.existing_id).length || 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload Data</h1>
        <p className="text-muted-foreground">
          Upload Zomato daily report exports to process restaurant data
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
            {step === 'select' || step === 'parse' ? (
              isLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-muted rounded-full animate-pulse">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="w-full max-w-sm">
                    <Progress value={progress} className="mb-2" />
                    <p className="text-sm text-muted-foreground">Parsing file...</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-muted rounded-full">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Drop your CSV or Excel file here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    id="file-upload"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                  <Button variant="outline" asChild>
                    <label htmlFor="file-upload" className="cursor-pointer">
                      Browse Files
                    </label>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Accepts Zomato daily report exports (.csv or .xlsx). Restaurant ID, date columns, and metric rows are auto-detected.
                  </p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{selectedFile?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                </div>

                {step === 'import' && (
                  <div className="w-full max-w-sm">
                    <Progress value={progress} className="mb-2" />
                    <p className="text-sm text-muted-foreground">Importing data...</p>
                  </div>
                )}

                {step === 'done' && (
                  <>
                    <div className="flex items-center gap-2 text-emerald-500">
                      <Check className="h-5 w-5" />
                      <span>Import complete!</span>
                    </div>
                    {importResult && (
                      <p className="text-sm text-muted-foreground">
                        {importResult.imported} rows imported
                        {importResult.autoCreated > 0 && ` · ${importResult.autoCreated} restaurants auto-created`}
                      </p>
                    )}
                    <Button variant="outline" onClick={handleReset}>
                      Upload Another File
                    </Button>
                  </>
                )}

                {step === 'preview' && (
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    Cancel and select another file
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview & Import */}
      {step === 'preview' && parseResult && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                Review the parsed data before importing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Restaurant Summary */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="default">{knownCount} known</Badge>
                  <span className="text-sm text-muted-foreground">restaurants already in database</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{newCount} new</Badge>
                  <span className="text-sm text-muted-foreground">will be auto-created</span>
                </div>
              </div>

              {/* Auto-create toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-create"
                  checked={autoCreate}
                  onCheckedChange={setAutoCreate}
                />
                <Label htmlFor="auto-create">Auto-create unknown restaurants</Label>
              </div>

              {/* Group breakdown */}
              {Object.keys(parseResult.groupCounts).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Data by Overview Group</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(parseResult.groupCounts).map(([group, count]) => (
                      <Badge key={group} variant="outline">
                        {group}: {count.toLocaleString()} rows
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors/Warnings */}
              {(parseResult.errors.length > 0 || parseResult.unknownMetrics.length > 0) && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-orange-500">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      {parseResult.errors.length + parseResult.unknownMetrics.length} warnings
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm">
                      {parseResult.errors.map((err, i) => (
                        <p key={i} className="text-orange-500">{err}</p>
                      ))}
                      {parseResult.unknownMetrics.length > 0 && (
                        <p className="text-muted-foreground">
                          Unknown metrics: {parseResult.unknownMetrics.join(', ')}
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Import button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleImport}
                  disabled={parseResult.rows.length === 0}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import {parseResult.rows.length.toLocaleString()} Records
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Matching Restaurants */}
          <Card>
            <CardHeader>
              <CardTitle>Restaurants Detected</CardTitle>
              <CardDescription>
                {parseResult.matches.length} unique restaurants found in file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zomato ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Subzone</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parseResult.matches.slice(0, 20).map((m) => (
                    <TableRow key={m.zomato_id}>
                      <TableCell className="font-mono text-sm">{m.zomato_id}</TableCell>
                      <TableCell>{m.restaurant_name}</TableCell>
                      <TableCell>{m.subzone || '-'}</TableCell>
                      <TableCell>{m.city || '-'}</TableCell>
                      <TableCell>
                        {m.existing_id ? (
                          <Badge variant="default">Known</Badge>
                        ) : autoCreate ? (
                          <Badge variant="secondary">New (will create)</Badge>
                        ) : (
                          <Badge variant="destructive">Skipped</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parseResult.matches.length > 20 && (
                <p className="text-sm text-muted-foreground text-center mt-2">
                  And {parseResult.matches.length - 20} more restaurants...
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
        </Alert>
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
    </div>
  );
}
