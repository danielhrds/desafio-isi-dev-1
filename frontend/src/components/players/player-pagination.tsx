import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PlayerListMeta } from '@/types/player';

function pageItems(current: number, total: number): Array<number | '…'> {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const visible = [...pages]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
  const result: Array<number | '…'> = [];

  visible.forEach((page, index) => {
    if (index > 0 && page > visible[index - 1] + 1) result.push('…');
    result.push(page);
  });

  return result;
}

export function PlayerPagination({
  meta,
  itemsOnPage,
  onPageChange,
}: {
  meta: PlayerListMeta;
  itemsOnPage: number;
  onPageChange: (page: number) => void;
}) {
  const first = (meta.page - 1) * meta.limit + 1;
  const last = first + itemsOnPage - 1;

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="tabular-nums text-muted-foreground">
        Mostrando {first}–{last} de {meta.total_items}{' '}
        {meta.total_items === 1 ? 'jogador' : 'jogadores'}
      </p>
      <nav
        aria-label="Paginação de jogadores"
        className="flex flex-wrap items-center gap-1"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeft aria-hidden="true" /> Anterior
        </Button>
        {pageItems(meta.page, meta.total_pages).map((page, index) =>
          page === '…' ? (
            <span
              key={`gap-${index}`}
              aria-hidden="true"
              className="px-2 text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Button
              key={page}
              type="button"
              variant={page === meta.page ? 'outline' : 'ghost'}
              size="icon-sm"
              aria-label={`Página ${page}`}
              aria-current={page === meta.page ? 'page' : undefined}
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ),
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={meta.page >= meta.total_pages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Próxima <ChevronRight aria-hidden="true" />
        </Button>
      </nav>
    </div>
  );
}
