import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Store,
  GitCompare,
  TrendingUp,
  FileText,
  Upload,
  Settings,
  Archive,
  ScrollText,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ModeToggle } from '@/components/mode-toggle';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const navigation = [
  { title: 'Overview', href: '/dashboard', icon: BarChart3 },
  { title: 'Restaurants', href: '/restaurants', icon: Store },
  { title: 'Compare', href: '/compare', icon: GitCompare },
  { title: 'Performance Analysis', href: '/analysis', icon: TrendingUp },
  { title: 'Reports', href: '/reports', icon: FileText },
];

const adminNavigation = [
  { title: 'Upload Data', href: '/upload', icon: Upload },
  {
    title: 'Admin',
    icon: Settings,
    subItems: [
      { title: 'Restaurant Management', href: '/admin/restaurants', icon: Store },
      { title: 'Archived Restaurants', href: '/admin/restaurants/archived', icon: Archive },
      { title: 'Audit Log', href: '/admin/audit-log', icon: ScrollText },
    ],
  },
];

function getBreadcrumbs(pathname: string) {
  const paths = pathname.split('/').filter(Boolean);
  const breadcrumbs: { name: string; href: string }[] = [];

  const nameMap: Record<string, string> = {
    dashboard: 'Overview',
    restaurants: 'Restaurants',
    compare: 'Compare',
    analysis: 'Performance Analysis',
    reports: 'Reports',
    upload: 'Upload',
    admin: 'Admin',
    archived: 'Archived',
    'audit-log': 'Audit Log',
  };

  paths.forEach((path, index) => {
    const name = nameMap[path] || path;
    const href = '/' + paths.slice(0, index + 1).join('/');
    breadcrumbs.push({ name, href });
  });

  return breadcrumbs;
}

function AppSidebar() {
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Kread Insights</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.href}
                  >
                    <NavLink to={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavigation.map((item) =>
                  item.subItems ? (
                    <Collapsible key={item.title} asChild className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.subItems.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.href}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={location.pathname === subItem.href}
                                >
                                  <NavLink to={subItem.href}>
                                    <subItem.icon className="h-4 w-4" />
                                    <span>{subItem.title}</span>
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  ) : (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === item.href}
                      >
                        <NavLink to={item.href!}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-auto">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{user?.name}</span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                  <ChevronDown className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem className="flex items-center gap-2">
                  <Badge variant={isAdmin ? 'default' : 'secondary'}>{user?.role}</Badge>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function AppHeader() {
  const location = useLocation();
  const breadcrumbs = getBreadcrumbs(location.pathname);

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />

      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.href}>
              <BreadcrumbItem className={index < breadcrumbs.length - 1 ? 'hidden md:block' : ''}>
                {index < breadcrumbs.length - 1 ? (
                  <>
                    <BreadcrumbLink href={crumb.href}>{crumb.name}</BreadcrumbLink>
                  </>
                ) : (
                  <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {index < breadcrumbs.length - 1 && (
                <BreadcrumbSeparator className="hidden md:block" />
              )}
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <ModeToggle />
      </div>
    </header>
  );
}

import React from 'react';

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
