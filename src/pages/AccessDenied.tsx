import { useNavigate } from 'react-router-dom';
import { Box, Card, Typography, Button } from '@mui/material';

export default function AccessDenied() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a, #1e3a5f, #0f172a)' }}>
      <Card sx={{ p: 6, maxWidth: 480, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ mb: 2 }}>Access Denied</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          You don't have access to GameSphere yet.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Contact your organization admin to request access.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/login')}>Back to Login</Button>
      </Card>
    </Box>
  );
}
