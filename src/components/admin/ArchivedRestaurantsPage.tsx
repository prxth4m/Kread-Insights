import { useState, useEffect } from 'react';
import { Archive, RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import type { Restaurant } from '@/types';

interface ArchivedRestaurant extends Restaurant {
  archivedByName?: string;
}

export function ArchivedRestaurantsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<ArchivedRestaurant[]>([]);
  const [restaurantToDelete, setRestaurantToDelete] = useState<ArchivedRestaurant | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');

  useEffect(() => {
    fetchArchivedRestaurants();
  }, []);

  const fetchArchivedRestaurants = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('is_archived', true)
        .order('archived_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch archived restaurants:', error);
        toast.error('Failed to load archived restaurants');
        return;
      }

      // Map snake_case to camelCase
      const mapped = (data || []).map((r: any) => ({
        ...r,
        displayName: r.display_name,
        archivedAt: r.archived_at,
        archivedBy: r.archived_by,
        archiveReason: r.archive_reason,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        isArchived: r.is_archived,
      }));
      setRestaurants(mapped);
    } catch (error) {
      console.error('Failed to fetch archived restaurants:', error);
      toast.error('Failed to load archived restaurants');
    } finally {
      setIsLoading(false);
    }
  };

  const addAuditLog = async (
    action: 'restaurant_restored' | 'restaurant_deleted',
    restaurantId: string,
    restaurantName: string,
    metadata: Record<string, unknown> = {}
  ) => {
    if (!user) return;

    try {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        user_name: user.name,
        action,
        target_type: 'restaurant',
        target_id: restaurantId,
        target_name: restaurantName,
        metadata,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to add audit log:', error);
    }
  };

  const handleRestore = async (restaurantId: string) => {
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    try {
      const restaurantToRestore = restaurants.find((r) => r.id === restaurantId);
      if (!restaurantToRestore) return;

      const { error } = await supabase
        .from('restaurants')
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
          archive_reason: null,
        })
        .eq('id', restaurantId);

      if (error) {
        console.error('Failed to restore restaurant:', error);
        toast.error('Failed to restore restaurant');
        return;
      }

      await addAuditLog(
        'restaurant_restored',
        restaurantId,
        restaurantToRestore.displayName,
        {
          previousArchivedAt: restaurantToRestore.archivedAt,
          previousArchiveReason: restaurantToRestore.archiveReason,
        }
      );

      toast.success('Restaurant restored successfully');
      fetchArchivedRestaurants();
    } catch (error) {
      console.error('Failed to restore restaurant:', error);
      toast.error('Failed to restore restaurant');
    }
  };

  const handleDelete = async () => {
    if (!restaurantToDelete || confirmDelete !== restaurantToDelete.name) return;

    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    try {
      const { error } = await supabase
        .from('restaurants')
        .delete()
        .eq('id', restaurantToDelete.id);

      if (error) {
        console.error('Failed to delete restaurant:', error);
        toast.error('Failed to delete restaurant');
        return;
      }

      await addAuditLog(
        'restaurant_deleted',
        restaurantToDelete.id,
        restaurantToDelete.displayName,
        {
          deletedName: restaurantToDelete.name,
          deletedDisplayName: restaurantToDelete.displayName,
        }
      );

      toast.success('Restaurant permanently deleted');
      setRestaurantToDelete(null);
      setConfirmDelete('');
      fetchArchivedRestaurants();
    } catch (error) {
      console.error('Failed to delete restaurant:', error);
      toast.error('Failed to delete restaurant');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Archived Restaurants</h1>
        <p className="text-muted-foreground">
          View and manage archived restaurants
        </p>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : restaurants.length === 0 ? (
            <Empty className="min-h-[300px]">
              <EmptyHeader>
                <Archive className="h-8 w-8 text-muted-foreground" />
                <EmptyTitle>No Archived Restaurants</EmptyTitle>
                <EmptyDescription>
                  There are no archived restaurants to display.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Archived Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Archived By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restaurants.map((restaurant) => (
                  <TableRow key={restaurant.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{restaurant.displayName}</span>
                        <p className="text-xs text-muted-foreground">{restaurant.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {restaurant.archivedAt
                        ? new Date(restaurant.archivedAt).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {restaurant.archiveReason || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {restaurant.archivedByName || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(restaurant.id)}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setRestaurantToDelete(restaurant)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!restaurantToDelete} onOpenChange={() => setRestaurantToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Permanently Delete Restaurant
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete "{restaurantToDelete?.displayName}"
              and all associated data including metrics, alerts, and historical records.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Type <span className="font-mono font-bold">{restaurantToDelete?.name}</span> to confirm:
            </p>
            <input
              type="text"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder={restaurantToDelete?.name}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestaurantToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmDelete !== restaurantToDelete?.name}
            >
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
