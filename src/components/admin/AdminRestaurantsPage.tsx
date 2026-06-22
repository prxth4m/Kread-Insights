import { useState, useEffect } from 'react';
import { Plus, Edit, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import type { Restaurant, RestaurantStatus, Platform } from '@/types';

export function AdminRestaurantsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    platform: 'zomato' as Platform,
    status: 'active' as RestaurantStatus,
  });

  // Archive dialog
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [restaurantToArchive, setRestaurantToArchive] = useState<Restaurant | null>(null);
  const [archiveReason, setArchiveReason] = useState('');

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('is_archived', false)
        .order('name');

      if (error) {
        throw error;
      }

      setRestaurants(data || []);
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
      toast.error('Failed to load restaurants');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRestaurant = async () => {
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    try {
      if (editingRestaurant) {
        // Update existing restaurant
        const { error } = await supabase
          .from('restaurants')
          .update({
            name: formData.name,
            display_name: formData.displayName,
            status: formData.status,
          })
          .eq('id', editingRestaurant.id);

        if (error) {
          throw error;
        }

        // Add audit log entry
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'restaurant_edited',
          target_type: 'restaurant',
          target_id: editingRestaurant.id,
          metadata: {
            name: formData.name,
            display_name: formData.displayName,
            status: formData.status,
          },
        });

        toast.success('Restaurant updated');
      } else {
        // Create new restaurant
        const { error } = await supabase
          .from('restaurants')
          .insert({
            name: formData.name,
            display_name: formData.displayName,
            platform: formData.platform,
          });

        if (error) {
          throw error;
        }

        // Get the created restaurant to get its ID for audit logging
        const { data: createdRestaurant } = await supabase
          .from('restaurants')
          .select('id')
          .eq('name', formData.name)
          .single();

        // Add audit log entry
        if (createdRestaurant) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'restaurant_created',
            target_type: 'restaurant',
            target_id: createdRestaurant.id,
            metadata: {
              name: formData.name,
              display_name: formData.displayName,
              platform: formData.platform,
            },
          });
        }

        toast.success('Restaurant created');
      }

      setIsSheetOpen(false);
      resetForm();
      fetchRestaurants();
    } catch (error) {
      console.error('Failed to save restaurant:', error);
      toast.error('Failed to save restaurant');
    }
  };

  const handleArchiveRestaurant = async () => {
    if (!restaurantToArchive || !archiveReason.trim()) return;

    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('restaurants')
        .update({
          is_archived: true,
          archived_at: now,
          archived_by: user.id,
          archive_reason: archiveReason,
        })
        .eq('id', restaurantToArchive.id);

      if (error) {
        throw error;
      }

      // Add audit log entry
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'restaurant_archived',
        target_type: 'restaurant',
        target_id: restaurantToArchive.id,
        metadata: {
          archive_reason: archiveReason,
        },
      });

      toast.success('Restaurant archived successfully');
      setIsArchiveDialogOpen(false);
      setRestaurantToArchive(null);
      setArchiveReason('');
      fetchRestaurants();
    } catch (error) {
      console.error('Failed to archive restaurant:', error);
      toast.error('Failed to archive restaurant');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      platform: 'zomato',
      status: 'active',
    });
    setEditingRestaurant(null);
  };

  const openEditSheet = (restaurant: Restaurant) => {
    setEditingRestaurant(restaurant);
    setFormData({
      name: restaurant.name,
      displayName: restaurant.displayName,
      platform: restaurant.platform,
      status: restaurant.status,
    });
    setIsSheetOpen(true);
  };

  const filteredRestaurants = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Restaurant Management</h1>
          <p className="text-muted-foreground">Manage all restaurants in the system</p>
        </div>
        <Button onClick={() => { resetForm(); setIsSheetOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Restaurant
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder="Search restaurants..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-sm"
      />

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRestaurants.map((restaurant) => (
                  <TableRow key={restaurant.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{restaurant.displayName}</span>
                        <p className="text-xs text-muted-foreground">{restaurant.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{restaurant.platform}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={restaurant.status === 'active' ? 'default' : 'secondary'}>
                        {restaurant.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(restaurant.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openEditSheet(restaurant)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setRestaurantToArchive(restaurant);
                              setIsArchiveDialogOpen(true);
                            }}
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingRestaurant ? 'Edit Restaurant' : 'Add Restaurant'}</SheetTitle>
            <SheetDescription>
              {editingRestaurant ? 'Update restaurant details' : 'Create a new restaurant'}
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Restaurant Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Pizza Palace"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="e.g., Pizza Palace - Main Branch"
              />
            </div>
            {!editingRestaurant && (
              <div className="grid gap-2">
                <Label>Platform</Label>
                <Select
                  value={formData.platform}
                  onValueChange={(v) => setFormData({ ...formData, platform: v as Platform })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zomato">Zomato</SelectItem>
                    <SelectItem value="swiggy">Swiggy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {editingRestaurant && (
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as RestaurantStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRestaurant}>{editingRestaurant ? 'Update' : 'Create'}</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Archive Dialog */}
      <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Restaurant</DialogTitle>
            <DialogDescription>
              This will remove "{restaurantToArchive?.displayName}" from active dashboards.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Reason for archiving</Label>
            <Textarea
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="e.g., Restaurant closed permanently"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsArchiveDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleArchiveRestaurant} disabled={!archiveReason.trim()}>
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
