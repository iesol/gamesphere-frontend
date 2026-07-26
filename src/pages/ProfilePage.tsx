import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DynamicForm from 'react-dynoform';
import {
  Box, Card, CardHeader, Typography, Button, TextField, Select, MenuItem, Stack, Chip, Alert, FormControl, InputLabel,
} from '@mui/material';
import api from '../lib/api';

const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [gameProfiles, setGameProfiles] = useState<Record<string, any>>({});

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile').then((r) => r.data),
  });

  const { data: formConfig } = useQuery({
    queryKey: ['form-config', 'edit-profile'],
    queryFn: () => api.get('/form-configs/edit-profile').then((r) => r.data),
  });

  const { data: gpFormConfig } = useQuery({
    queryKey: ['form-config', 'add-game-profile'],
    queryFn: () => api.get('/form-configs/add-game-profile').then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch('/profile', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  useEffect(() => {
    if (profile?.gameProfiles) {
      setGameProfiles(profile.gameProfiles);
    }
  }, [profile]);

  const setProfile = (gameKey: string, field: string, value: string) => {
    setGameProfiles((prev) => ({
      ...prev,
      [gameKey]: { ...(prev[gameKey] || {}), [field]: value },
    }));
  };

  return (
    <Box sx={{ p: 4, maxWidth: 700, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 4 }}>My Profile</Typography>

      <Card sx={{ mb: 4 }}>
        <CardHeader title="Account" titleTypographyProps={{ variant: 'h6' }} />
        <Box sx={{ p: 3, pt: 0 }}>
          <Stack spacing={2}>
            <TextField label="Email" value={profile?.email || ''} size="small" disabled />
            {formConfig ? (
              <div className="dynoform">
                <DynamicForm
                  fields={formConfig.fields}
                  selectedValues={{ name: profile?.name || '' }}
                  onSubmit={(data) => updateMutation.mutate(data)}
                  submitButtonLabel="Save"
                />
              </div>
            ) : (
              <TextField label="Name" value={profile?.name || ''} size="small" disabled />
            )}
          </Stack>
          {updateMutation.isSuccess && <Alert severity="success" sx={{ mt: 2 }}>Profile updated</Alert>}
        </Box>
      </Card>

      <Card sx={{ mb: 4 }}>
        <CardHeader title="Game Profiles" titleTypographyProps={{ variant: 'h6' }} />
        <Box sx={{ p: 3, pt: 0 }}>
          {gpFormConfig && (
            <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 2, mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Add Game Profile</Typography>
              <div className="dynoform">
                <DynamicForm
                  fields={gpFormConfig.fields}
                  submitButtonLabel="Add"
                  onSubmit={(data) => {
                    setGameProfiles((prev) => ({ ...prev, [data.sport]: { position: data.position || null, level: data.level || null } }));
                  }}
                />
              </div>
            </Box>
          )}

          <Stack spacing={3}>
            {Object.keys(gameProfiles).length > 0 ? (
              Object.entries(gameProfiles).map(([sport, gp]: [string, any]) => (
                <Box key={sport} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>{sport}</Typography>
                    <Button size="small" color="error" onClick={() => {
                      const next = { ...gameProfiles };
                      delete next[sport];
                      setGameProfiles(next);
                    }}>Remove</Button>
                  </Stack>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Position / Role"
                      placeholder="e.g. batsman, opener"
                      value={gp.position || ''}
                      onChange={(e) => setProfile(sport, 'position', e.target.value)}
                      size="small"
                      sx={{ flex: 1 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel>Level</InputLabel>
                      <Select
                        value={gp.level || ''}
                        label="Level"
                        onChange={(e) => setProfile(sport, 'level', e.target.value)}
                      >
                        <MenuItem value=""><em>None</em></MenuItem>
                        {LEVELS.map((l) => (
                          <MenuItem key={l} value={l}>{l}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                </Box>
              ))
            ) : (
              <Typography color="text.secondary" variant="body2">No game profiles added yet.</Typography>
            )}
          </Stack>

          <Button
            variant="contained"
            onClick={() => updateMutation.mutate({ gameProfiles })}
            sx={{ mt: 3 }}
          >
            Save Game Profiles
          </Button>
        </Box>
      </Card>

      <Card>
        <CardHeader title="Current Game Profiles" titleTypographyProps={{ variant: 'h6' }} />
        <Box sx={{ p: 3, pt: 0 }}>
          {(!gameProfiles || Object.keys(gameProfiles).length === 0) && (
            <Typography color="text.secondary" variant="body2">No game profiles configured.</Typography>
          )}
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {Object.entries(gameProfiles).map(([game, data]: [string, any]) =>
              data?.position || data?.level ? (
                <Chip key={game} label={`${game}: ${data.position || ''}${data.level ? ` (${data.level})` : ''}`} variant="outlined" />
              ) : null
            )}
          </Stack>
        </Box>
      </Card>
    </Box>
  );
}
