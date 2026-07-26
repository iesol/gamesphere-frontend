import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Box, Card, Typography, Button, Stack } from '@mui/material';

export default function OrgPicker() {
  const { organizations, setActiveOrg } = useAuth();
  const navigate = useNavigate();

  const selectOrg = (orgId: string) => {
    setActiveOrg(orgId);
    navigate('/dashboard');
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a, #1e3a5f, #0f172a)' }}>
      <Card sx={{ p: 4, maxWidth: 440, width: '100%' }}>
        <Typography variant="h5" sx={{ mb: 1 }}>Select Organization</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>You belong to multiple organizations. Choose one to continue.</Typography>
        <Stack spacing={2}>
          {organizations.map((org) => (
            <Button
              key={org.id}
              variant="outlined"
              fullWidth
              onClick={() => selectOrg(org.id)}
              sx={{ p: 2, textTransform: 'none', display: 'block', textAlign: 'left' }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{org.name}</Typography>
              <Typography variant="caption" color="text.secondary">{(org as any).roles?.join(', ')}</Typography>
            </Button>
          ))}
        </Stack>
      </Card>
    </Box>
  );
}
