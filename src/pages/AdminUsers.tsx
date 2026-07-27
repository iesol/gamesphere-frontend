import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DynamicForm from 'react-dynoform';
import { Box, Card, CardHeader, Typography, Button, Alert, List, ListItem, ListItemText, Chip, Stack, FormControlLabel, Checkbox, FormGroup, FormLabel, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import api from '../lib/api';

const ROLE_OPTIONS = [
  { label: 'Player', value: 'player' },
  { label: 'Volunteer', value: 'volunteer' },
  { label: 'Org Admin', value: 'org_admin' },
];

export default function AdminUsers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const activeOrgId = localStorage.getItem('gamesphere_org_id');

  if (!activeOrgId) {
    return (
      <Box sx={{ p: 4, maxWidth: 700, mx: 'auto', textAlign: 'center', mt: 8 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Select an organization first</Typography>
        <Button variant="contained" onClick={() => navigate('/admin/orgs')}>Go to Organizations</Button>
      </Box>
    );
  }

  const { data: users } = useQuery({
    queryKey: ['org-users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const { data: myRole } = useQuery({
    queryKey: ['my-org-role'],
    queryFn: () => api.get('/users/me/org-role').then((r) => r.data),
  });

  const { data: formConfig } = useQuery({
    queryKey: ['form-config', 'add-user', activeOrgId],
    queryFn: () => api.get(`/form-configs/add-user${activeOrgId ? `?orgId=${activeOrgId}` : ''}`).then((r) => r.data),
  });

  const isSuperAdmin = myRole?.roles?.includes('super_admin');
  const isOrgAdmin = myRole?.roles?.includes('org_admin');
  const isAdmin = isSuperAdmin || isOrgAdmin;

  const canManageUser = (userRoles: string[] = []) => {
    if (!isAdmin) return false;
    if (userRoles.includes('super_admin') && !isSuperAdmin) return false;
    return true;
  };

  const addUserMutation = useMutation({
    mutationFn: (data: any) => api.post('/users', { ...data, roles: selectedRoles }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-users'] });
      setSelectedRoles([]);
      setFormValues({});
    },
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post('/import/users', form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-users'] });
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/users/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-users'] }),
  });

  const updateRolesMutation = useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: string[] }) => api.patch(`/users/${userId}/roles`, { roles }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-users'] });
      setEditUser(null);
    },
  });

  const dynoFields = formConfig?.fields?.filter((f: any) => f.key !== 'roles') || [];

  const toggleRole = (value: string) => {
    setSelectedRoles((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value],
    );
  };

  return (
    <Box sx={{ p: 4, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 4 }}>Users</Typography>

      <Card sx={{ mb: 4 }}>
        <CardHeader title="Add User" titleTypographyProps={{ variant: 'h6' }} />
        <Box sx={{ p: 3, pt: 0 }}>
          {formConfig ? (
            <div className="dynoform">
              <DynamicForm fields={dynoFields} onChange={setFormValues} hideSubmit />
              <FormLabel sx={{ display: 'block', mb: 1, fontWeight: 500, color: 'text.primary' }}>Roles</FormLabel>
              <FormGroup row sx={{ gap: 2, mb: 2 }}>
                {ROLE_OPTIONS.map((opt) => (
                  <FormControlLabel
                    key={opt.value}
                    control={<Checkbox checked={selectedRoles.includes(opt.value)} onChange={() => toggleRole(opt.value)} />}
                    label={opt.label}
                  />
                ))}
              </FormGroup>
              <Button variant="contained" onClick={() => addUserMutation.mutate(formValues)} disabled={selectedRoles.length === 0}>Add User</Button>
            </div>
          ) : (
            <Typography color="text.secondary" variant="body2">Loading form...</Typography>
          )}
          {addUserMutation.data && (
            <Alert severity="success" sx={{ mt: 2 }}>User added successfully</Alert>
          )}
        </Box>
      </Card>

      <Card sx={{ mb: 4 }}>
        <CardHeader title="Import from CSV" titleTypographyProps={{ variant: 'h6' }} />
        <Box sx={{ p: 3, pt: 0 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <input type="file" accept=".csv" ref={fileRef} />
            <Button variant="contained" disabled={importMutation.isPending} onClick={() => fileRef.current?.files?.[0] && importMutation.mutate(fileRef.current.files[0])}>
              {importMutation.isPending ? 'Importing...' : 'Import'}
            </Button>
          </Stack>
          <Button href="/api/import/template" target="_blank" sx={{ mt: 1, textTransform: 'none' }} size="small">Download CSV template</Button>
          {importMutation.data && (
            <Alert severity="success" sx={{ mt: 2 }}>Imported: {importMutation.data.data.imported}, Skipped: {importMutation.data.data.skipped}</Alert>
          )}
        </Box>
      </Card>

      <Card>
        <CardHeader title={`Users (${users?.length || 0})`} titleTypographyProps={{ variant: 'h6' }} />
        {(!users || users.length === 0) && <Box sx={{ p: 3 }}><Typography color="text.secondary">No users yet.</Typography></Box>}
        <List disablePadding>
          {users?.map((u: any) => (
            <ListItem key={u.id} divider>
              <ListItemText primary={u.name} secondary={u.email} />
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                {(u.roles || []).map((r: string) => (
                  <Chip key={r} label={r} size="small" variant="outlined" />
                ))}
                {canManageUser(u.roles || []) && (
                  <>
                    <Button size="small" variant="text" onClick={() => { setEditUser(u); setEditRoles([...u.roles]); }}>Edit</Button>
                    <Button size="small" color="error" variant="text" onClick={() => { if (confirm(`Remove ${u.name} from org?`)) removeMutation.mutate(u.id); }}>Remove</Button>
                  </>
                )}
              </Stack>
            </ListItem>
          ))}
        </List>
      </Card>

      <Dialog open={!!editUser} onClose={() => setEditUser(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Roles — {editUser?.name}</DialogTitle>
        <DialogContent>
          <FormGroup sx={{ gap: 1, pt: 1 }}>
            {ROLE_OPTIONS.map((opt) => (
              <FormControlLabel
                key={opt.value}
                control={<Checkbox checked={editRoles.includes(opt.value)} onChange={() => setEditRoles((prev) => prev.includes(opt.value) ? prev.filter((r) => r !== opt.value) : [...prev, opt.value])} disabled={opt.value === 'super_admin' && !isSuperAdmin} />}
                label={opt.label}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUser(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => updateRolesMutation.mutate({ userId: editUser.id, roles: editRoles })} disabled={editUser?.roles?.includes('super_admin') && !isSuperAdmin}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
