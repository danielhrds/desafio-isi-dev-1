import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  Clock3,
  ListOrdered,
  RefreshCw,
  Shield,
  Swords,
  Trophy,
  UsersRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import type { ClubListItem } from '@/types/club';

interface AppShellProps {
  children: ReactNode;
  clubs: ClubListItem[];
  playerTotal?: number;
  activeSection: 'players' | 'clubs';
  breadcrumbPage: string;
  refreshLabel: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function PasseLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8 shrink-0">
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path
        d="M10 25V9.7c0-1 .8-1.7 1.7-1.7h7.1a6.4 6.4 0 0 1 0 12.8h-3.1V25H10Zm5.7-9.2h3.1a1.4 1.4 0 1 0 0-2.8h-3.1v2.8Z"
        fill="var(--primary-foreground)"
      />
    </svg>
  );
}

export function AppShell({
  children,
  clubs,
  playerTotal,
  activeSection,
  breadcrumbPage,
  refreshLabel,
  isRefreshing,
  onRefresh,
}: AppShellProps) {
  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="p-4 group-data-[collapsible=icon]:px-2">
          <div className="flex items-center gap-2.5">
            <PasseLogo />
            <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-semibold text-sidebar-foreground">
                Passe
              </p>
              <p className="text-xs text-muted-foreground">Gestão da liga</p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Mercado</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={activeSection === 'players'}
                    tooltip="Jogadores"
                  >
                    <Link to="/jogadores">
                      <UsersRound aria-hidden="true" />
                      <span>Jogadores</span>
                    </Link>
                  </SidebarMenuButton>
                  {playerTotal !== undefined && (
                    <SidebarMenuBadge>{playerTotal}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={activeSection === 'clubs'}
                    tooltip="Clubes"
                  >
                    <Link to="/clubes">
                      <Shield aria-hidden="true" />
                      <span>Clubes</span>
                    </Link>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>{clubs.length}</SidebarMenuBadge>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Liga</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <div className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground">
                    <Swords aria-hidden="true" className="size-4" />
                    <span>Partidas</span>
                  </div>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <div className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground">
                    <ListOrdered aria-hidden="true" className="size-4" />
                    <span>Classificação</span>
                  </div>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {clubs.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Clubes</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {clubs.map((club) => (
                    <SidebarMenuItem key={club.id}>
                      <div className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded border bg-muted text-[10px] font-semibold">
                          {club.acronym[0]}
                        </span>
                        <span className="truncate">{club.name}</span>
                      </div>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter className="p-2 group-data-[collapsible=icon]:hidden">
          <div className="rounded-xl border bg-card p-3 text-xs shadow-xs">
            <div className="flex items-start gap-2">
              <Trophy
                aria-hidden="true"
                className="mt-0.5 size-4 text-muted-foreground"
              />
              <div>
                <p className="font-semibold text-foreground">Liga Fictícia</p>
                <p className="tabular-nums text-muted-foreground">
                  {clubs.length} clubes · {playerTotal ?? '—'} jogadores
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t pt-2 text-muted-foreground">
              <Clock3 aria-hidden="true" className="size-4" />
              Horário de Brasília (UTC−3)
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-hidden border bg-card md:rounded-2xl">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 md:px-6">
          <SidebarTrigger type="button" aria-label="Alternar menu" />
          <span aria-hidden="true" className="h-5 w-px bg-border" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>Mercado</BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight aria-hidden="true" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>{breadcrumbPage}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto"
            aria-label={refreshLabel}
            disabled={isRefreshing}
            onClick={onRefresh}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
          </Button>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
