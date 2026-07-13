import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { Alert, Button, Stack } from '@mui/material';
import { useState } from 'react';
import { ApiError } from '../../api/problem';

export function CsvExportButton({
  exportCsv,
  filename,
}: {
  exportCsv: () => Promise<string>;
  filename: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setPending(true);
    setError('');
    try {
      const csv = await exportCsv();
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.problem.detail : 'Não foi possível exportar o CSV.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Stack spacing={1} sx={{ alignItems: 'flex-end' }}>
      <Button
        variant="outlined"
        startIcon={<FileDownloadOutlinedIcon />}
        disabled={pending}
        onClick={() => void download()}
      >
        {pending ? 'Exportando…' : 'Exportar CSV'}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
