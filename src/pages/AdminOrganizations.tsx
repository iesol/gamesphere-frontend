import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DynamicForm from 'react-dynoform';
import { Box, Card, CardHeader, Typography, Button, List, ListItem, ListItemText, Stack } from '@mui/material';
import api from '../lib/api';
import { useAuth } from '../lib/auth';

export default function AdminOrganizations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setActiveOrg, organizations } = useAuth();
  const [showForm, setShowForm] = useState(false);

  const { data: formConfig } = useQuery({
    queryKey: ['form-config', 'add-org'],
    queryFn: () => api.get('/form-configs/add-org').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/organizations', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setActiveOrg(res.data.id);
      setShowForm(false);
      navigate('/dashboard');
    },
  });

  const selectOrg = (orgId: string) => {
    setActiveOrg(orgId);
    navigate('/dashboard');
  };

  return (
    <Box sx={{ p: 4, maxWidth: 700, mx: 'auto' }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4">Organizations</Typography>
        <Button variant="contained" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New Organization'}
        </Button>
      </Stack>

      {showForm && (
        <Card sx={{ mb: 4 }}>
          <CardHeader title="Create Organization" titleTypographyProps={{ variant: 'h6' }} />
          <Box sx={{ p: 3, pt: 0 }}>
            {formConfig ? (
              <div className="dynoform"><DynamicForm fields={formConfig.fields} onSubmit={(data) => createMutation.mutate(data)} submitButtonLabel="Create" /></div>
            ) : (
              <Typography color="text.secondary" variant="body2">Loading form...</Typography>
            )}
          </Box>
        </Card>
      )}

      <Card>
        <CardHeader title={organizations.length > 0 ? 'Your Organizations' : 'No organizations yet'} titleTypographyProps={{ variant: 'h6' }} />
        {organizations.length === 0 && (
          <Box sx={{ p: 3 }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>Create your first organization to get started.</Typography>
          </Box>
        )}
        <List disablePadding>
          {organizations.map((org: any) => (
            <ListItem key={org.id} divider>
              <ListItemText primary={org.name} secondary={org.roles?.join(', ')} />
              <Button size="small" onClick={() => selectOrg(org.id)}>Open</Button>
            </ListItem>
          ))}
        </List>
      </Card>
    </Box>
  );
}
