import { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DynamicForm from 'react-dynoform';
import { Box, Card, CardHeader, Typography, Button, List, ListItem, ListItemText, Chip, Stack, Alert, TextField, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import api from '../lib/api';

export default function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchForm, setMatchForm] = useState({ homeTeamId: '', awayTeamId: '', round: 1 });
  const [autoGenTeamCount, setAutoGenTeamCount] = useState(2);
  const [showAutoGenDialog, setShowAutoGenDialog] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const activeOrgId = localStorage.getItem('gamesphere_org_id');

  const { data: tournament } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => api.get(`/tournaments/${id}`).then((r) => r.data),
  });

  const { data: teams } = useQuery({
    queryKey: ['tournament-teams', id],
    queryFn: () => api.get(`/tournaments/${id}/teams`).then((r) => r.data),
  });

  const { data: matches } = useQuery({
    queryKey: ['tournament-matches', id],
    queryFn: () => api.get(`/matches/tournament/${id}`).then((r) => r.data),
  });

  const { data: members } = useQuery({
    queryKey: ['org-users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const { data: myRole } = useQuery({
    queryKey: ['my-org-role'],
    queryFn: () => api.get('/users/me/org-role').then((r) => r.data),
  });

  const { data: editFormConfig } = useQuery({
    queryKey: ['form-config', 'edit-tournament', activeOrgId],
    queryFn: () => api.get(`/form-configs/edit-tournament${activeOrgId ? `?orgId=${activeOrgId}` : ''}`).then((r) => r.data),
  });

  const { data: teamFormConfig } = useQuery({
    queryKey: ['form-config', 'add-team', activeOrgId],
    queryFn: () => api.get(`/form-configs/add-team${activeOrgId ? `?orgId=${activeOrgId}` : ''}`).then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/tournaments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      setShowEditForm(false);
    },
  });

  const addTeamMutation = useMutation({
    mutationFn: (data: any) => api.post(`/tournaments/${id}/teams`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament-teams', id] });
      setShowTeamForm(false);
    },
  });

  const addMatchMutation = useMutation({
    mutationFn: (data: any) => api.post('/matches', { ...data, tournamentId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament-matches', id] });
      setShowMatchForm(false);
    },
  });

  const bracketMutation = useMutation({
    mutationFn: () => api.post(`/brackets/generate/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament-matches', id] });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      api.post(`/teams/${teamId}/members`, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament-teams', id] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      api.delete(`/teams/${teamId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament-teams', id] });
    },
  });

  const renameTeamMutation = useMutation({
    mutationFn: ({ teamId, name }: { teamId: string; name: string }) =>
      api.patch(`/teams/${teamId}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament-teams', id] });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: string) => api.delete(`/teams/${teamId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament-teams', id] });
    },
  });

  const importCsvMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/import/users', fd).then((r) => r.data);
    },
    onSuccess: async (data: any) => {
      setImportMsg(`Imported: ${data.imported}, Skipped: ${data.skipped}${data.errors?.length ? `, Errors: ${data.errors.length}` : ''}`);
      const membersRes = await api.get('/users');
      const allMembers = membersRes.data;
      const existingPlayers = tournament?.settings?.players || [];
      const existingIds = existingPlayers.map((p: any) => p.userId);
      const newPlayers = allMembers.filter((u: any) => !existingIds.includes(u.id));
      if (newPlayers.length > 0) {
        const updatedPlayers = [
          ...existingPlayers,
          ...newPlayers.map((u: any) => ({ userId: u.id, name: u.name, email: u.email, position: '', skillLevel: 3 })),
        ];
        await api.patch(`/tournaments/${id}`, { settings: { ...tournament?.settings, players: updatedPlayers } });
      }
      queryClient.invalidateQueries({ queryKey: ['org-users'] });
      queryClient.invalidateQueries({ queryKey: ['tournament', id] });
    },
    onError: () => setImportMsg('Import failed'),
  });

  const autoGenMutation = useMutation({
    mutationFn: (teamCount: number) => api.post(`/tournaments/${id}/auto-generate-teams`, { teamCount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament-teams', id] });
      queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      setShowAutoGenDialog(false);
    },
  });

  const addPlayerMutation = useMutation({
    mutationFn: async (user: any) => {
      const players = tournament?.settings?.players || [];
      if (players.find((p: any) => p.userId === user.id)) return;
      players.push({ userId: user.id, name: user.name, email: user.email, position: '', skillLevel: 3 });
      return api.patch(`/tournaments/${id}`, { settings: { ...tournament.settings, players } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  const removePlayerMutation = useMutation({
    mutationFn: (userId: string) => {
      const players = (tournament?.settings?.players || []).filter((p: any) => p.userId !== userId);
      return api.patch(`/tournaments/${id}`, { settings: { ...tournament.settings, players } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  const [memberPicker, setMemberPicker] = useState<{ teamId: string; teamName: string; existingUserIds: string[] } | null>(null);
  const [playerPicker, setPlayerPicker] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/tournaments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      navigate('/tournaments');
    },
  });

  const registeredPlayers = tournament?.settings?.players || [];
  const registeredUserIds = registeredPlayers.map((p: any) => p.userId);
  const allTeamUserIds = new Set(teams?.flatMap((t: any) => (t.members || []).map((m: any) => m.userId)) || []);
  const unassignedPlayers = registeredPlayers.filter((p: any) => !allTeamUserIds.has(p.userId));

  const pickableMembers = useMemo(() => {
    if (!members || !memberPicker) return [];
    return members.filter((u: any) => !allTeamUserIds.has(u.id));
  }, [members, memberPicker, allTeamUserIds]);

  const pickablePlayers = useMemo(() => {
    if (!members || !playerPicker) return [];
    return members.filter((u: any) => !registeredUserIds.includes(u.id));
  }, [members, playerPicker, registeredUserIds]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return pickableMembers;
    const q = searchQuery.toLowerCase();
    return pickableMembers.filter((u: any) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [pickableMembers, searchQuery]);

  const filteredPlayers = useMemo(() => {
    if (!searchQuery) return pickablePlayers;
    const q = searchQuery.toLowerCase();
    return pickablePlayers.filter((u: any) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [pickablePlayers, searchQuery]);

  const isAdmin = myRole?.roles?.some((r: string) => r === 'org_admin' || r === 'super_admin');
  if (!tournament) return <Box sx={{ p: 4 }}><Typography>Loading...</Typography></Box>;

  const availableTeams = teams?.filter((t: any) => t.id !== matchForm.homeTeamId) || [];

  return (
    <Box sx={{ p: 4, maxWidth: 900, mx: 'auto' }}>
      <Button onClick={() => navigate('/tournaments')} sx={{ mb: 2, textTransform: 'none' }}>← Back to Tournaments</Button>

      <Card sx={{ mb: 4 }}>
        <CardHeader
          title={editingName ? (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField size="small" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} autoFocus sx={{ maxWidth: 300 }}
                onKeyDown={(e) => { if (e.key === 'Enter') { updateMutation.mutate({ name: editNameValue }, { onSuccess: () => setEditingName(false) }); } }} />
              <Button size="small" variant="contained" onClick={() => updateMutation.mutate({ name: editNameValue }, { onSuccess: () => setEditingName(false) })}>Save</Button>
              <Button size="small" onClick={() => setEditingName(false)}>Cancel</Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: isAdmin ? 'pointer' : 'default' }}
              onClick={() => { if (isAdmin) { setEditNameValue(tournament.name); setEditingName(true); } }}>
              {tournament.name}
              {isAdmin && <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>edit</Typography>}
            </Box>
          )}
          subheader={`${tournament.sportType} · ${tournament.format}`}
          titleTypographyProps={{ variant: 'h5' }}
        />
        <Box sx={{ p: 3, pt: 0 }}>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            {tournament.startDate && <Typography variant="body2" color="text.secondary">Starts: {new Date(tournament.startDate).toLocaleString()}</Typography>}
            {tournament.settings?.venueAddress && <Typography variant="body2" color="text.secondary">Venue: {tournament.settings.venueAddress}</Typography>}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
            {isAdmin && <Button size="small" variant="outlined" onClick={() => setShowEditForm(!showEditForm)}>Edit Details</Button>}
            {isAdmin && <Button size="small" variant="contained" onClick={() => bracketMutation.mutate()} disabled={!teams || teams.length < 2}>
              Generate Bracket
            </Button>}
            {isAdmin && (
              <Button size="small" variant="outlined" color="error" onClick={() => { if (confirm('Delete this tournament and all associated data?')) deleteMutation.mutate(); }}>
                Delete
              </Button>
            )}
          </Stack>
          {bracketMutation.isSuccess && <Alert severity="success" sx={{ mt: 2 }}>Bracket generated!</Alert>}

          {showEditForm && editFormConfig && (
            <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <div className="dynoform">
                <DynamicForm
                  fields={editFormConfig.fields}
                  selectedValues={{
                    name: tournament.name,
                    startDate: tournament.startDate || '',
                    endDate: tournament.endDate || '',
                    registrationDeadline: tournament.registrationDeadline || '',
                  }}
                  onSubmit={(data) => updateMutation.mutate(data)}
                  submitButtonLabel="Save"
                />
              </div>
            </Box>
          )}
        </Box>
      </Card>

      <Card sx={{ mb: 4 }}>
        <CardHeader
          title={`Matches (${matches?.length || 0})`}
          titleTypographyProps={{ variant: 'h6' }}
          action={isAdmin && teams?.length >= 2 && <Button size="small" variant="contained" onClick={() => setShowMatchForm(!showMatchForm)}>{showMatchForm ? 'Cancel' : 'Add Match'}</Button>}
        />
        <Box sx={{ p: 3, pt: 0 }}>
          {showMatchForm && isAdmin && teams?.length >= 2 && (
            <Box sx={{ mb: 2, p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
              <Stack spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Home Team</InputLabel>
                  <Select value={matchForm.homeTeamId} label="Home Team" onChange={(e) => setMatchForm({ ...matchForm, homeTeamId: e.target.value })}>
                    {teams.map((t: any) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Away Team</InputLabel>
                  <Select value={matchForm.awayTeamId} label="Away Team" onChange={(e) => setMatchForm({ ...matchForm, awayTeamId: e.target.value })}>
                    {availableTeams.map((t: any) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField label="Round" type="number" size="small" value={matchForm.round} onChange={(e) => setMatchForm({ ...matchForm, round: parseInt(e.target.value) || 1 })} />
                <Button variant="contained" disabled={!matchForm.homeTeamId || !matchForm.awayTeamId || addMatchMutation.isPending}
                  onClick={() => addMatchMutation.mutate(matchForm)}>
                  Add Match
                </Button>
              </Stack>
            </Box>
          )}
          {(!matches || matches.length === 0) && <Typography color="text.secondary" variant="body2">No matches yet.</Typography>}
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            <List disablePadding>
              {matches?.map((m: any) => {
                const home = teams?.find((t: any) => t.id === m.homeTeamId);
                const away = teams?.find((t: any) => t.id === m.awayTeamId);
                const scoreLabel = m.result?.completedInnings?.map((inn: any) => `${inn.runs}/${inn.wickets}`).join(', ') || '';
                return (
                  <ListItem key={m.id} divider sx={{ cursor: 'pointer' }} onClick={() => navigate(`/matches/${m.id}`)}>
                    <ListItemText
                      primary={`${home?.name || '?'} vs ${away?.name || '?'}`}
                      secondary={`Round ${m.round} · ${m.state}${scoreLabel ? ` · ${scoreLabel}` : ''}`}
                      slotProps={{ secondary: { sx: { fontSize: '0.8rem' } } }}
                    />
                    {m.state === 'completed' && m.result?.winner && (
                      <Chip label={`${teams?.find((t: any) => t.id === m.result.winner)?.name || '?'} won`} size="small" color="success" sx={{ fontWeight: 600, ml: 1 }} />
                    )}
                    {m.state === 'in_progress' && (
                      <Chip label="Live" size="small" color="success" sx={{ ml: 1, fontWeight: 600 }} />
                    )}
                  </ListItem>
                );
              })}
            </List>
          </Box>
        </Box>
      </Card>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 4 }}>
        {isAdmin && <Card sx={{ flex: 1 }}>
          <CardHeader
            title={`Players (${unassignedPlayers.length} unassigned)`}
            titleTypographyProps={{ variant: 'h6' }}
            action={
              <Stack direction="row" spacing={1}>
                <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsvMutation.mutate(f); }} />
                {isAdmin && <Button size="small" variant="outlined" onClick={() => fileRef.current?.click()}>Import CSV</Button>}
                {isAdmin && members && <Button size="small" variant="outlined" onClick={() => { setPlayerPicker(true); setSearchQuery(''); }}>Add Players</Button>}
              </Stack>
            }
          />
          <Box sx={{ p: 3, pt: 0 }}>
            {importMsg && <Alert severity={importCsvMutation.isError ? 'error' : 'info'} sx={{ mb: 2 }} onClose={() => setImportMsg('')}>{importMsg}</Alert>}
            {unassignedPlayers.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {unassignedPlayers.map((p: any) => (
                  <Chip key={p.userId} label={`${p.name}${p.position ? ` (${p.position})` : ''} · Lvl ${p.skillLevel}`} size="small" variant="outlined"
                    onDelete={isAdmin ? () => removePlayerMutation.mutate(p.userId) : undefined} />
                ))}
              </Box>
            ) : (
              <Typography color="text.secondary" variant="body2">No players registered.</Typography>
            )}
            {isAdmin && unassignedPlayers.length >= 2 && (!teams || teams.length === 0) && (
              <Box sx={{ mt: 2 }}>
                <Button size="small" variant="contained" onClick={() => setShowAutoGenDialog(true)}>Auto Generate Teams</Button>
              </Box>
            )}
          </Box>
        </Card>}

        <Card sx={{ flex: 1 }}>
          <CardHeader
            title={`Teams (${teams?.length || 0})`}
            titleTypographyProps={{ variant: 'h6' }}
            action={isAdmin && teamFormConfig && <Button size="small" variant="contained" onClick={() => setShowTeamForm(!showTeamForm)}>{showTeamForm ? 'Cancel' : 'Add Team'}</Button>}
          />
          <Box sx={{ p: 3, pt: 0 }}>
            {showTeamForm && isAdmin && teamFormConfig && (
              <Box sx={{ mb: 2, p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                <div className="dynoform">
                  <DynamicForm fields={teamFormConfig.fields} onSubmit={(data) => addTeamMutation.mutate(data)} submitButtonLabel="Add Team" />
                </div>
              </Box>
            )}
            {(!teams || teams.length === 0) && <Typography color="text.secondary" variant="body2">No teams yet.</Typography>}
            <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
              <List disablePadding>
                {teams?.map((t: any) => (
                  <ListItem key={t.id} divider sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                      {editingTeamId === t.id ? (
                        <Box sx={{ display: 'flex', gap: 1, flex: 1 }}>
                          <TextField size="small" value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)} autoFocus sx={{ flex: 1 }} />
                          <Button size="small" variant="contained" onClick={() => { renameTeamMutation.mutate({ teamId: t.id, name: editTeamName }, { onSuccess: () => setEditingTeamId(null) }); }}>Save</Button>
                          <Button size="small" onClick={() => setEditingTeamId(null)}>Cancel</Button>
                        </Box>
                      ) : (
                        <>
                          <Typography sx={{ fontWeight: 600, alignSelf: 'center' }}>{t.name}</Typography>
                          {isAdmin && <Stack direction="row" spacing={0.5}>
                            <Button size="small" variant="text" onClick={() => { setEditingTeamId(t.id); setEditTeamName(t.name); }}>Rename</Button>
                            <Button size="small" variant="text" color="error" onClick={() => { if (confirm(`Delete ${t.name} and release all players?`)) deleteTeamMutation.mutate(t.id); }}>Delete</Button>
                            <Button size="small" variant="text" onClick={() => setMemberPicker({ teamId: t.id, teamName: t.name, existingUserIds: (t.members || []).map((m: any) => m.userId) })}>+ Member</Button>
                          </Stack>}
                        </>
                      )}
                    </Box>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                      {t.members?.map((m: any) => {
                        const user = members?.find((u: any) => u.id === m.userId);
                        return (
                          <Chip
                            key={m.id}
                            label={user?.name || m.userId}
                            size="small"
                            variant="outlined"
                            onDelete={isAdmin ? () => removeMemberMutation.mutate({ teamId: t.id, userId: m.userId }) : undefined}
                          />
                        );
                      })}
                      {(!t.members || t.members.length === 0) && <Typography variant="caption" color="text.secondary">No members</Typography>}
                    </Stack>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Box>
        </Card>
      </Box>

      {memberPicker && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}>
          <Box sx={{ bgcolor: 'white', borderRadius: 2, p: 3, minWidth: 350, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Add Member to {memberPicker.teamName}</Typography>
            <TextField placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} size="small" fullWidth sx={{ mb: 2 }} autoFocus />
            {filteredMembers.length === 0 && <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No matching users.</Typography>}
            <Box sx={{ flex: 1, overflowY: 'auto', maxHeight: 400 }}>
              <List disablePadding>
                {filteredMembers.map((u: any) => (
                  <ListItem key={u.id} divider secondaryAction={
                    <Button size="small" variant="outlined" onClick={() => { addMemberMutation.mutate({ teamId: memberPicker.teamId, userId: u.id }); }}>Add</Button>
                  }>
                    <ListItemText primary={u.name} secondary={u.email} />
                  </ListItem>
                ))}
              </List>
            </Box>
            <Button onClick={() => { setMemberPicker(null); setSearchQuery(''); }} sx={{ mt: 2 }}>Close</Button>
          </Box>
        </Box>
      )}

      {playerPicker && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}>
          <Box sx={{ bgcolor: 'white', borderRadius: 2, p: 3, minWidth: 350, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Register Players</Typography>
            <TextField placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} size="small" fullWidth sx={{ mb: 2 }} autoFocus />
            {filteredPlayers.length === 0 && <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No matching users.</Typography>}
            <Box sx={{ flex: 1, overflowY: 'auto', maxHeight: 400 }}>
              <List disablePadding>
                {filteredPlayers.map((u: any) => (
                  <ListItem key={u.id} divider secondaryAction={
                    <Button size="small" variant="outlined" onClick={() => { addPlayerMutation.mutate(u); }}>Register</Button>
                  }>
                    <ListItemText primary={u.name} secondary={u.email} />
                  </ListItem>
                ))}
              </List>
            </Box>
            <Button onClick={() => { setPlayerPicker(false); setSearchQuery(''); }} sx={{ mt: 2 }}>Close</Button>
          </Box>
        </Box>
      )}

      {showAutoGenDialog && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}>
          <Box sx={{ bgcolor: 'white', borderRadius: 2, p: 3, minWidth: 350 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Auto Generate Teams</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {registeredPlayers.length} registered players. How many teams?
            </Typography>
            <TextField type="number" size="small" fullWidth value={autoGenTeamCount}
              onChange={(e) => setAutoGenTeamCount(Math.max(2, parseInt(e.target.value) || 2))} sx={{ mb: 2 }} />
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button onClick={() => setShowAutoGenDialog(false)}>Cancel</Button>
              <Button variant="contained" onClick={() => autoGenMutation.mutate(autoGenTeamCount)} disabled={autoGenMutation.isPending}>Generate</Button>
            </Stack>
          </Box>
        </Box>
      )}
    </Box>
  );
}
