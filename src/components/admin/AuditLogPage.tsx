import { useState, useEffect } from 'react';
import { ScrollText, User, Clock, Filter } from 'lucide-react';
import { getAuthToken } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import type { AuditLog } from '@/types';

const API_BASE = 'http://localhost:8000/api';

const ACTION_LABELS: Record<string, string> = {
  restaurant_created: 'Restaurant Created',
  restaurant_edited: 'Restaurant Edited',
  restaurant_archived: 'Restaurant Archived',
  restaurant_restored: 'Restaurant Restored',
  restaurant_deleted: 'Restaurant Deleted',
  file_uploaded: 'File Uploaded',
  report_generated: 'Report Generated',
  alert_acknowledged: 'Alert Acknowledged',
};

const ACTION_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  restaurant_created: 'default',
  restaurant_edited: 'secondary',
  restaurant_archived: 'destructive',
  restaurant_restored: 'default',
  restaurant_deleted: 'destructive',
  file_uploaded: 'secondary',
  report_generated: 'default',
  alert_acknowledged: 'outline',
};

export function AuditLogPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      const token = getAuthToken();
      // Note: This endpoint would need to be added to the backend
      const response = await fetch(`${API_BASE}/audit-log/?limit=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      } else {
        // If endpoint doesn't exist, show empty state
        setLogs([]);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    // Filter by action
    if (actionFilter !== 'all' && log.action !== actionFilter) {
      return false;
    }
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.userName?.toLowerCase().includes(query) ||
        log.action?.toLowerCase().includes(query) ||
        log.targetName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          Track all actions and changes in the system
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by user, action, or target..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map((action) => (
                <SelectItem key={action} value={action}>
                  {ACTION_LABELS[action] || action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <Empty className="min-h-[300px]">
              <EmptyHeader>
                <ScrollText className="h-8 w-8 text-muted-foreground" />
                <EmptyTitle>No Audit Logs</EmptyTitle>
                <EmptyDescription>
                  {searchQuery || actionFilter !== 'all'
                    ? 'No logs match your current filters.'
                    : 'There are no audit logs to display.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <div>
                            <div>{new Date(log.createdAt).toLocaleDateString()}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(log.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="text-sm">{log.userName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ACTION_COLORS[log.action] || 'outline'}>
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm font-medium">{log.targetName || '-'}</span>
                          <p className="text-xs text-muted-foreground capitalize">{log.targetType}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.metadata && Object.keys(log.metadata).length > 0 ? (
                          <div className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {JSON.stringify(log.metadata)}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Restaurant Changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs.filter((l) => l.targetType === 'restaurant').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>File Uploads</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs.filter((l) => l.action === 'file_uploaded').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Reports Generated</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs.filter((l) => l.action === 'report_generated').length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
