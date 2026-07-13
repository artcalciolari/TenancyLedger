import { TablePagination } from '@mui/material';
import type { PageMeta } from '../../api/contract';

interface PaginationBarProps {
  meta: PageMeta;
  onChange: (page: number, limit: number) => void;
}

export function PaginationBar({ meta, onChange }: PaginationBarProps) {
  return (
    <TablePagination
      component="div"
      count={meta.total}
      page={Math.max(0, meta.page - 1)}
      rowsPerPage={meta.limit}
      rowsPerPageOptions={[20, 50, 100]}
      onPageChange={(_, page) => onChange(page + 1, meta.limit)}
      onRowsPerPageChange={(event) => onChange(1, Number(event.target.value))}
      labelRowsPerPage="Itens por página"
      labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
    />
  );
}
