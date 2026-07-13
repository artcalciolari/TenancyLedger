import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: { label: string; to: string };
  children?: React.ReactNode;
}

export function PageHeader({ title, description, action, children }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{
        alignItems: { xs: 'stretch', sm: 'flex-start' },
        justifyContent: 'space-between',
        mb: 3,
      }}
    >
      <Box>
        <Typography component="h1" variant="h1">
          {title}
        </Typography>
        {description && <Typography color="text.secondary">{description}</Typography>}
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        {children}
        {action && (
          <Button component={RouterLink} to={action.to}>
            {action.label}
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
