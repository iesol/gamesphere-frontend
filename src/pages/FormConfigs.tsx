import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Card, CardContent, CardHeader, Typography, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  List, ListItem, ListItemText, Chip, Stack,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import api from '../lib/api';

export default function FormConfigs() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<any>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [fieldsJson, setFieldsJson] = useState('[{"key":"","label":"","type":"text"}]');
  const activeOrgId = localStorage.getItem('gamesphere_org_id');

  const isEditing = !!editConfig;

  const { data: configs } = useQuery({
    queryKey: ['form-configs', activeOrgId],
    queryFn: () => api.get(`/form-configs${activeOrgId ? `?orgId=${activeOrgId}` : ''}`).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: { slug: string; name: string; fields: any[]; orgId?: string }) =>
      api.post('/form-configs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-configs', activeOrgId] });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { slug: string; name: string; fields: any[]; orgId?: string }) =>
      api.patch(`/form-configs/${data.slug}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-configs', activeOrgId] });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ slug, orgId }: { slug: string; orgId?: string }) =>
      api.delete(`/form-configs/${slug}${orgId ? `?orgId=${orgId}` : ''}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['form-configs', activeOrgId] }),
  });

  const openCreate = () => {
    setEditConfig(null);
    setName('');
    setSlug('');
    setFieldsJson('[{"key":"","label":"","type":"text"}]');
    setOpen(true);
  };

  const openEdit = (c: any) => {
    setEditConfig(c);
    setName(c.name);
    setSlug(c.slug);
    setFieldsJson(JSON.stringify(c.fields, null, 2));
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditConfig(null);
    setName('');
    setSlug('');
  };

  const handleSubmit = () => {
    try {
      const fields = JSON.parse(fieldsJson);
      const payload: any = { slug, name, fields };
      if (activeOrgId && slug !== 'add-org') payload.orgId = activeOrgId;
      if (isEditing) {
        updateMutation.mutate(payload);
      } else {
        createMutation.mutate(payload);
      }
    } catch { /* JSON error */ }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 900, mx: 'auto' }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4">Form Schemas</Typography>
        <Button variant="contained" onClick={openCreate}>New Schema</Button>
      </Stack>

      <Card>
        <CardHeader title="All Form Configs" titleTypographyProps={{ variant: 'h6' }} />
        {configs?.length === 0 && (
          <CardContent><Typography color="text.secondary">No form configs yet.</Typography></CardContent>
        )}
        <List disablePadding>
          {configs?.map((c: any) => (
            <ListItem key={c.slug + (c.orgId || '')} divider secondaryAction={
              <Stack direction="row" spacing={0.5}>
                <IconButton edge="end" size="small" onClick={() => openEdit(c)}><EditIcon fontSize="small" /></IconButton>
                <IconButton edge="end" size="small" onClick={() => deleteMutation.mutate({ slug: c.slug, orgId: c.orgId })}><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            }>
              <ListItemText
                primary={c.name}
                secondary={<><Chip label={c.slug} size="small" sx={{ mr: 1 }} />{c.fields?.length || 0} fields{c.orgId ? ' · org-scoped' : ' · global'}</>}
              />
            </ListItem>
          ))}
        </List>
      </Card>

      <Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{isEditing ? 'Edit Form Schema' : 'Create Form Schema'}</DialogTitle>
        <DialogContent>
          <Stack direction="column" spacing={2} sx={{ pt: 1 }}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
            <TextField label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} fullWidth required disabled={isEditing} helperText={isEditing ? 'Slug cannot be changed' : 'Unique identifier, e.g. add-user'} />
            <TextField
              label="Fields (JSON array)"
              value={fieldsJson}
              onChange={(e) => setFieldsJson(e.target.value)}
              multiline rows={8}
              fullWidth
              helperText="Array of FormField objects: { key, label, type, required?, options? }"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" disabled={!name || !slug} onClick={handleSubmit}>
            {isEditing ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
