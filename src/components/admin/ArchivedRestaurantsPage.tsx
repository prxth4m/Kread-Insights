import { useState, useEffect } from 'react';
import { Archive, RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getAuthToken } from '@/context/AuthContext';
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

const API_BASE = 'http://localhost:8000/api';

interface ArchivedRestaurant extends Restaurant {
  archivedByName?: string;
}

export function ArchivedRestaurantsPage() {
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
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/restaurants/archived/list`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setRestaurants(data.restaurants || []);
      }
    } catch (error) {
      console.error('Failed to fetch archived restaurants:', error);
      toast.error('Failed to load archived restaurants');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (restaurantId: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/restaurants/${restaurantId}/restore`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('Restaurant restored successfully');
        fetchArchivedRestaurants();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to restore restaurant');
      }
    } catch (error) {
      toast.error('Failed to restore restaurant');
    }
  };

  const handleDelete = async () => {
    if (!restaurantToDelete || confirmDelete !== restaurantToDelete.name) return;

    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/restaurants/${restaurantToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('Restaurant permanently deleted');
        setRestaurantToDelete(null);
        setConfirmDelete('');
        fetchArchivedRestaurants();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to delete restaurant');
      }
    } catch (error) {
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
