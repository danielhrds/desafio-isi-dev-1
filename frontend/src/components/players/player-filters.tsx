import { useId, useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowDownUp,
  Coins,
  HeartPulse,
  Search,
  Shield,
  Shirt,
  UserRound,
  X,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ClubListItem } from '@/types/club';
import type {
  PlayerCondition,
  PlayerListFilters,
  PlayerPosition,
  PlayerSort,
} from '@/types/player';

const positionLabels: Record<PlayerPosition, string> = {
  GOL: 'Goleiro',
  ZAG: 'Zagueiro',
  LAT: 'Lateral',
  MEI: 'Meio-campo',
  ATA: 'Atacante',
};

const conditionLabels: Record<PlayerCondition, string> = {
  APTO: 'Apto',
  MAL_CONDICIONADO: 'Mal condicionado',
  DOENTE: 'Doente',
};

const sortLabels: Record<PlayerSort, string> = {
  name: 'nome',
  value_asc: 'menor valor de mercado',
  value_desc: 'maior valor de mercado',
  age_asc: 'menor idade',
  age_desc: 'maior idade',
  position: 'posição',
};

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type RangeValues = { min: string; max: string };
type RangeKind = 'age' | 'value';

function rangeSchema(kind: RangeKind) {
  const floor = kind === 'age' ? 16 : 0;
  const ceiling = kind === 'age' ? 45 : 550;
  const pattern = kind === 'age' ? /^\d+$/ : /^\d+(?:[,.]\d{1,2})?$/;
  const valid = (text: string) =>
    text === '' ||
    (pattern.test(text) &&
      Number(text.replace(',', '.')) >= floor &&
      Number(text.replace(',', '.')) <= ceiling);

  return z
    .object({
      min: z
        .string()
        .refine(valid, `Informe um valor entre ${floor} e ${ceiling}.`),
      max: z
        .string()
        .refine(valid, `Informe um valor entre ${floor} e ${ceiling}.`),
    })
    .refine(
      ({ min, max }) =>
        min === '' ||
        max === '' ||
        Number(min.replace(',', '.')) <= Number(max.replace(',', '.')),
      { path: ['max'], message: 'O máximo deve ser maior ou igual ao mínimo.' },
    );
}

function RangeFilter({
  kind,
  min,
  max,
  onApply,
}: {
  kind: RangeKind;
  min?: number;
  max?: number;
  onApply: (min?: number, max?: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const isAge = kind === 'age';
  const label = isAge ? 'Idade' : 'Valor de mercado';
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<RangeValues>({
    resolver: zodResolver(rangeSchema(kind)),
    defaultValues: { min: '', max: '' },
  });
  const formatted = (value: number) =>
    isAge ? String(value) : moneyFormatter.format(value);
  const summary =
    min !== undefined || max !== undefined
      ? `${isAge ? 'Idade' : 'Valor'}: ${formatted(min ?? (isAge ? 16 : 0))} a ${formatted(max ?? (isAge ? 45 : 550))}`
      : label;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          reset({
            min: min === undefined ? '' : String(min).replace('.', ','),
            max: max === undefined ? '' : String(max).replace('.', ','),
          });
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={`Filtrar por ${label.toLowerCase()}`}
          className="h-9 w-full min-w-0 justify-start gap-2 px-3 font-normal text-muted-foreground"
        >
          {isAge ? (
            <UserRound aria-hidden="true" />
          ) : (
            <Coins aria-hidden="true" />
          )}
          <span className="truncate text-left text-foreground/80">
            {summary}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <p className="text-sm font-medium">Faixa de {label.toLowerCase()}</p>
        <form
          className="space-y-3"
          onSubmit={handleSubmit((values) => {
            onApply(
              values.min === ''
                ? undefined
                : Number(values.min.replace(',', '.')),
              values.max === ''
                ? undefined
                : Number(values.max.replace(',', '.')),
            );
            setOpen(false);
          })}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={`${id}-min`}>Mínimo</Label>
              <Input
                id={`${id}-min`}
                inputMode={isAge ? 'numeric' : 'decimal'}
                placeholder={isAge ? '16' : '0,00'}
                aria-invalid={!!errors.min}
                {...register('min')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-max`}>Máximo</Label>
              <Input
                id={`${id}-max`}
                inputMode={isAge ? 'numeric' : 'decimal'}
                placeholder={isAge ? '45' : '550,00'}
                aria-invalid={!!errors.max}
                {...register('max')}
              />
            </div>
          </div>
          {(errors.min || errors.max) && (
            <p role="alert" className="text-xs text-destructive">
              {errors.min?.message ?? errors.max?.message}
            </p>
          )}
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onApply(undefined, undefined);
                setOpen(false);
              }}
            >
              Limpar
            </Button>
            <Button type="submit" size="sm">
              Aplicar
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <Badge variant="secondary" className="gap-1 rounded-full px-2 font-normal">
      {label}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="size-4 rounded-full"
        aria-label={`Remover filtro ${label}`}
        onClick={onRemove}
      >
        <X aria-hidden="true" className="size-3" />
      </Button>
    </Badge>
  );
}

export function PlayerFilters({
  children,
  filters,
  searchInput,
  onSearchInput,
  onChange,
  onClear,
  clubs,
  counts,
}: {
  children: ReactNode;
  filters: PlayerListFilters;
  searchInput: string;
  onSearchInput: (value: string) => void;
  onChange: (change: Partial<PlayerListFilters>) => void;
  onClear: () => void;
  clubs: ClubListItem[];
  counts: { all?: number; free?: number; assigned?: number };
}) {
  const searchId = useId();
  const club = clubs.find((item) => item.id === filters.club_id);
  const activeChips: Array<{
    label: string;
    clear: Partial<PlayerListFilters>;
  }> = [];
  if (filters.search)
    activeChips.push({
      label: `Busca: ${filters.search}`,
      clear: { search: undefined },
    });
  if (filters.position)
    activeChips.push({
      label: `Posição: ${positionLabels[filters.position]}`,
      clear: { position: undefined },
    });
  if (filters.condition)
    activeChips.push({
      label: `Condição: ${conditionLabels[filters.condition]}`,
      clear: { condition: undefined },
    });
  if (club)
    activeChips.push({
      label: `Clube: ${club.name}`,
      clear: { club_id: undefined },
    });
  if (filters.min_age !== undefined || filters.max_age !== undefined)
    activeChips.push({
      label: `Idade: ${filters.min_age ?? 16} a ${filters.max_age ?? 45}`,
      clear: { min_age: undefined, max_age: undefined },
    });
  if (filters.min_value !== undefined || filters.max_value !== undefined)
    activeChips.push({
      label: `Valor de mercado: ${moneyFormatter.format(filters.min_value ?? 0)} a ${moneyFormatter.format(filters.max_value ?? 550)}`,
      clear: { min_value: undefined, max_value: undefined },
    });

  return (
    <>
      <div
        className={cn(
          'mb-5 grid grid-cols-2 gap-2 rounded-xl border bg-card p-2 shadow-sm lg:max-[1399px]:grid-cols-3',
          filters.condition ||
            filters.min_age !== undefined ||
            filters.min_value !== undefined
            ? 'min-[1400px]:grid-cols-[minmax(180px,1.35fr)_minmax(125px,.9fr)_minmax(240px,1.71fr)_minmax(110px,.8fr)_minmax(145px,1.04fr)_minmax(190px,1.4fr)]'
            : 'min-[1400px]:grid-cols-[minmax(240px,2.5fr)_minmax(125px,.86fr)_minmax(135px,.95fr)_minmax(110px,.8fr)_minmax(110px,.8fr)_minmax(190px,1.35fr)]',
        )}
      >
        <div className="relative col-span-2 lg:col-span-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
          />
          <Label htmlFor={searchId} className="sr-only">
            Buscar por nome
          </Label>
          <Input
            id={searchId}
            value={searchInput}
            onChange={(event) => onSearchInput(event.target.value)}
            placeholder="Buscar por nome"
            maxLength={100}
            className="pl-9"
          />
        </div>
        <Select
          value={filters.position ?? 'all'}
          onValueChange={(value) =>
            onChange({
              position: value === 'all' ? undefined : (value as PlayerPosition),
            })
          }
        >
          <SelectTrigger aria-label="Posição" className="w-full min-w-0">
            <Shirt aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">
              {filters.position ? positionLabels[filters.position] : 'Posição'}
            </span>
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Todas as posições</SelectItem>
            {(Object.keys(positionLabels) as PlayerPosition[]).map(
              (position) => (
                <SelectItem key={position} value={position}>
                  {positionLabels[position]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Select
          value={filters.condition ?? 'all'}
          onValueChange={(value) =>
            onChange({
              condition:
                value === 'all' ? undefined : (value as PlayerCondition),
            })
          }
        >
          <SelectTrigger aria-label="Condição" className="w-full min-w-0">
            <HeartPulse aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">
              {filters.condition
                ? `Condição: ${conditionLabels[filters.condition]}`
                : 'Condição'}
            </span>
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Todas as condições</SelectItem>
            {(Object.keys(conditionLabels) as PlayerCondition[]).map(
              (condition) => (
                <SelectItem key={condition} value={condition}>
                  {conditionLabels[condition]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="min-w-0" tabIndex={filters.free === true ? 0 : -1}>
              <Select
                value={filters.club_id?.toString() ?? 'all'}
                disabled={filters.free === true}
                onValueChange={(value) =>
                  onChange({
                    club_id: value === 'all' ? undefined : Number(value),
                  })
                }
              >
                <SelectTrigger aria-label="Clube" className="w-full min-w-0">
                  <Shield aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{club?.name ?? 'Clube'}</span>
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="all">Todos os clubes</SelectItem>
                  {clubs.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          {filters.free === true && (
            <TooltipContent>
              “Livres” não combina com o filtro por clube.
            </TooltipContent>
          )}
        </Tooltip>
        <RangeFilter
          kind="age"
          min={filters.min_age}
          max={filters.max_age}
          onApply={(min_age, max_age) => onChange({ min_age, max_age })}
        />
        <RangeFilter
          kind="value"
          min={filters.min_value}
          max={filters.max_value}
          onApply={(min_value, max_value) => onChange({ min_value, max_value })}
        />
      </div>

      {searchInput.trim().length === 1 && (
        <p role="status" className="-mt-3 mb-4 text-xs text-muted-foreground">
          Digite pelo menos 2 caracteres para buscar.
        </p>
      )}
      {activeChips.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {filters.search && activeChips.length === 1
              ? 'Resultados para a busca:'
              : 'Filtros ativos:'}
          </span>
          {activeChips.map(({ label, clear }) => (
            <FilterChip
              key={label}
              label={label}
              onRemove={() => {
                if ('search' in clear) onSearchInput('');
                onChange(clear);
              }}
            />
          ))}
          <Button type="button" variant="link" size="sm" onClick={onClear}>
            Limpar filtros
          </Button>
        </div>
      )}

      <section
        aria-label="Lista de jogadores"
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={
              filters.free === undefined
                ? 'all'
                : filters.free
                  ? 'free'
                  : 'assigned'
            }
            onValueChange={(value) =>
              onChange({
                free: value === 'all' ? undefined : value === 'free',
                ...(value === 'free' ? { club_id: undefined } : {}),
              })
            }
          >
            <TabsList className="h-9 w-full sm:w-auto">
              <TabsTrigger value="all">
                Todos{' '}
                <span className="ml-1 tabular-nums text-muted-foreground">
                  {counts.all ?? '—'}
                </span>
              </TabsTrigger>
              <TabsTrigger value="free">
                Livres{' '}
                <span className="ml-1 tabular-nums text-muted-foreground">
                  {counts.free ?? '—'}
                </span>
              </TabsTrigger>
              <TabsTrigger value="assigned">
                Em clubes{' '}
                <span className="ml-1 tabular-nums text-muted-foreground">
                  {counts.assigned ?? '—'}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Select
            value={filters.sort ?? 'name'}
            onValueChange={(value) =>
              onChange({
                sort: value === 'name' ? undefined : (value as PlayerSort),
              })
            }
          >
            <SelectTrigger
              aria-label="Ordenar jogadores"
              className={cn('w-full', filters.sort ? 'sm:w-72' : 'sm:w-44')}
            >
              <ArrowDownUp aria-hidden="true" className="size-4" />
              <span className="truncate">
                Ordenar: {sortLabels[filters.sort ?? 'name']}
              </span>
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {(Object.keys(sortLabels) as PlayerSort[]).map((sort) => (
                <SelectItem key={sort} value={sort}>
                  {sortLabels[sort]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {children}
      </section>
    </>
  );
}
