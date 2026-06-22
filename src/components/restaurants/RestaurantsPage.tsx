import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
} from '@tanstack/react-table';
import type { ColumnDef, SortingState, ColumnFiltersState, VisibilityState } from '@tanstack/react-table';
import { ArrowUpDown, MoreHorizontal, Edit, Archive, Eye, Store, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import type { RestaurantWithMetrics, RestaurantStatus, Platform } from '@/types';

export function RestaurantsPage() {
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<RestaurantWithMetrics[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');

  // Form state for add/edit
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<RestaurantWithMetrics | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    platform: 'zomato' as Platform,
    status: 'active' as RestaurantStatus,
  });

  // Archive dialog state
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [restaurantToArchive, setRestaurantToArchive] = useState<RestaurantWithMetrics | null>(null);
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
        throw new Error(error.message);
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
    try {
      if (editingRestaurant) {
        const { error } = await supabase
          .from('restaurants')
          .update({
            name: formData.name,
            displayName: formData.displayName,
            status: formData.status,
          })
          .eq('id', editingRestaurant.id);

        if (error) throw new Error(error.message);
        toast.success('Restaurant updated');
      } else {
        const { error } = await supabase
          .from('restaurants')
          .insert({
            name: formData.name,
            displayName: formData.displayName,
            platform: formData.platform,
          });

        if (error) throw new Error(error.message);
        toast.success('Restaurant created');
      }

      setIsSheetOpen(false);
      resetForm();
      fetchRestaurants();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save restaurant');
    }
  };

  const handleArchiveRestaurant = async () => {
    if (!restaurantToArchive || !archiveReason.trim() || !user) return;

    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user.id,
          archive_reason: archiveReason,
        })
        .eq('id', restaurantToArchive.id);

      if (error) throw new Error(error.message);
      toast.success('Restaurant archived successfully');
      setIsArchiveDialogOpen(false);
      setRestaurantToArchive(null);
      setArchiveReason('');
      fetchRestaurants();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to archive restaurant');
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

  const openEditSheet = (restaurant: RestaurantWithMetrics) => {
    setEditingRestaurant(restaurant);
    setFormData({
      name: restaurant.name,
      displayName: restaurant.displayName,
      platform: restaurant.platform,
      status: restaurant.status,
    });
    setIsSheetOpen(true);
  };

  const openAddSheet = () => {
    resetForm();
    setIsSheetOpen(true);
  };

  const columns: ColumnDef<RestaurantWithMetrics>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            Restaurant
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="font-medium">{row.original.displayName}</span>
              <span className="text-xs text-muted-foreground">{row.original.name}</span>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'platform',
        header: 'Platform',
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.platform}
          </Badge>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'sales',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            Sales
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.sales != null ? `₹${row.original.sales.toLocaleString('en-IN')}` : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'orders',
        header: 'Orders',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.orders != null ? row.original.orders.toLocaleString('en-IN') : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'aov',
        header: 'AOV',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.aov != null ? `₹${row.original.aov.toLocaleString('en-IN')}` : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'roi',
        header: 'ROI',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.roi != null ? `${row.original.roi.toFixed(2)}x` : '-'}
          </span>
        ),
      },
      {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => {
          const restaurant = row.original;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate(`/restaurants/${restaurant.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openEditSheet(restaurant)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
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
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [navigate, isAdmin]
  );

  const table = useReactTable({
    data: restaurants,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Restaurants</h1>
          <p className="text-muted-foreground">
            Manage and monitor all registered restaurants
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openAddSheet}>
            <Store className="mr-2 h-4 w-4" />
            Add Restaurant
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search restaurants..."
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

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
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No restaurants found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {table.getState().pagination.pageIndex * 10 + 1} to{' '}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * 10,
            restaurants.length
          )}{' '}
          of {restaurants.length} restaurants
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Add/Edit Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editingRestaurant ? 'Edit Restaurant' : 'Add Restaurant'}
            </SheetTitle>
            <SheetDescription>
              {editingRestaurant
                ? 'Update restaurant details'
                : 'Create a new restaurant in the system'}
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
                <Label htmlFor="platform">Platform</Label>
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
                <Label htmlFor="status">Status</Label>
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
            <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRestaurant}>
              {editingRestaurant ? 'Update' : 'Create'}
            </Button>
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
              You can restore it later from the Admin section.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="archive-reason">Reason for archiving</Label>
            <Textarea
              id="archive-reason"
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="e.g., Restaurant closed permanently"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsArchiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchiveRestaurant}
              disabled={!archiveReason.trim()}
            >
              Archive Restaurant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
