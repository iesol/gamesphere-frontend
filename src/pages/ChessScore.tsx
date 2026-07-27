import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Card, CardHeader, Typography, Button, Stack, TextField, Alert, Chip, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import api, { createMatchSse } from '../lib/api';

export default function ChessScore() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [moveSan, setMoveSan] = useState('');
  const [flashLabel, setFlashLabel] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  const { data: match } = useQuery({
    queryKey: ['match', id],
    queryFn: () => api.get(`/matches/${id}`).then((r) => r.data),
  });

  const { data: teams } = useQuery({
    queryKey: ['tournament-teams', match?.tournamentId],
    queryFn: () => api.get(`/tournaments/${match.tournamentId}/teams`).then((r) => r.data),
    enabled: !!match?.tournamentId,
  });

  const { data: state } = useQuery({
    queryKey: ['chess-state', id],
    queryFn: () => api.get(`/chess/${id}/state`).then((r) => r.data),
    enabled: !!match && match.state === 'in_progress',
  });

  const { data: myRole } = useQuery({
    queryKey: ['my-org-role'],
    queryFn: () => api.get('/users/me/org-role').then((r) => r.data),
  });

  const { data: orgUsers } = useQuery({
    queryKey: ['org-users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  useEffect(() => {
    api.post(`/matches/${id}/lock`).catch(() => {});
    const hb = setInterval(() => {
      api.post(`/matches/${id}/lock/heartbeat`).catch(() => {});
    }, 20000);
    return () => {
      clearInterval(hb);
      api.delete(`/matches/${id}/lock`).catch(() => {});
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const sse = createMatchSse(id);
    sse.addEventListener('move', () => {
      queryClient.invalidateQueries({ queryKey: ['chess-state', id] });
    });
    return () => sse.close();
  }, [id, queryClient]);

  const isAdminOrVolunteer = myRole?.roles?.some((r: string) => r === 'org_admin' || r === 'volunteer' || r === 'super_admin');
  const isLocked = !!match?.scoredBy;
  const homeTeam = teams?.find((t: any) => t.id === match?.homeTeamId);
  const awayTeam = teams?.find((t: any) => t.id === match?.awayTeamId);

  const moveMutation = useMutation({
    mutationFn: (san: string) => api.post(`/chess/${id}/move`, { san, playerId: orgUsers?.find((u: any) => u.id === myRole?.userId)?.id || '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chess-state', id] });
      setFlashLabel(moveSan);
      setFlashKey((k) => k + 1);
      setTimeout(() => setFlashLabel(null), 600);
      setMoveSan('');
    },
  });

  const endMatchMutation = useMutation({
    mutationFn: (outcome: string) => api.post(`/chess/${id}/end`, { outcome }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', id] });
      queryClient.invalidateQueries({ queryKey: ['chess-state', id] });
      navigate(`/matches/${id}`);
    },
  });

  const userLookup = Object.fromEntries((orgUsers || []).map((u: any) => [u.id, u]));

  if (!match) return <Box sx={{ p: 4 }}><Typography>Loading...</Typography></Box>;

  return (
    <Box sx={{ p: 4, maxWidth: 700, mx: 'auto' }}>
      <Button onClick={() => { api.delete(`/matches/${id}/lock`).catch(() => {}); navigate(`/matches/${id}`); }} sx={{ mb: 2, textTransform: 'none', color: 'text.secondary', fontSize: '0.85rem' }}>← Back to Match</Button>

      <Card sx={{ mb: 4 }}>
        <CardHeader
          title={`${homeTeam?.name || match.homeTeamId || '?'} vs ${awayTeam?.name || match.awayTeamId || '?'}`}
          subheader={`Chess · ${match.state}`}
          titleTypographyProps={{ variant: 'h5' }}
          action={
            <Chip label={match.state} size="small" color={match.state === 'in_progress' ? 'success' : 'default'} />
          }
        />
        <Box sx={{ p: 3, pt: 0 }}>
          {state?.whiteTeamId && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              White: {teams?.find((t: any) => t.id === state.whiteTeamId)?.name || '?'}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            Turn: <strong>{state?.currentTurn || 'white'}</strong>
            {state?.isCheck && ' · CHECK'}
            {state?.isCheckmate && ' · CHECKMATE'}
            {state?.isDraw && ' · DRAW'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Moves: {state?.moves?.length || 0}
          </Typography>
        </Box>
      </Card>

      {isAdminOrVolunteer && (
        <Card sx={{ mb: 4 }}>
          <Box sx={{ p: 3 }}>
            {moveMutation.isError && <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>Failed to log move</Alert>}
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <TextField
                label="Move (SAN)"
                value={moveSan}
                onChange={(e) => setMoveSan(e.target.value)}
                size="small"
                fullWidth
                placeholder="e.g. D4, KC6, E5"
                disabled={moveMutation.isPending || isLocked || match.state !== 'in_progress'}
                onKeyDown={(e) => { if (e.key === 'Enter' && moveSan.trim()) moveMutation.mutate(moveSan.trim()); }}
              />
              <Button variant="contained" disabled={!moveSan.trim() || moveMutation.isPending || isLocked || match.state !== 'in_progress'}
                onClick={() => moveMutation.mutate(moveSan.trim())} sx={{ whiteSpace: 'nowrap' }}>
                Log Move
              </Button>
            </Stack>
          </Box>
        </Card>
      )}

      {isAdminOrVolunteer && match.state === 'in_progress' && (
        <Card sx={{ mb: 4 }}>
          <Box sx={{ p: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Complete Match — Select Outcome</Typography>
            <Stack direction="row" spacing={1.5}>
              <Button variant="outlined" color="success" onClick={() => endMatchMutation.mutate('white_win')} disabled={endMatchMutation.isPending}>White Wins</Button>
              <Button variant="outlined" color="success" onClick={() => endMatchMutation.mutate('black_win')} disabled={endMatchMutation.isPending}>Black Wins</Button>
              <Button variant="outlined" onClick={() => endMatchMutation.mutate('draw')} disabled={endMatchMutation.isPending}>Draw</Button>
            </Stack>
          </Box>
        </Card>
      )}

      {/* Move List */}
      <Card>
        <Box sx={{ p: 3, pb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Move History</Typography>
          {(state?.moves || [])?.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(state.moves as any[]).map((m: any, i: number) => {
                const isBlack = i % 2 === 1;
                return (
                  <Chip key={m.id || i} label={`${m.moveNumber}. ${m.san}`} size="small"
                    variant={isBlack ? 'outlined' : 'filled'} color={isBlack ? 'default' : 'primary'}
                    sx={{ fontWeight: isBlack ? 400 : 700 }} />
                );
              })}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">No moves logged yet.</Typography>
          )}
        </Box>
      </Card>

      {flashLabel && (
        <Typography key={flashKey} sx={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '8rem', fontWeight: 900, color: 'primary.main',
          pointerEvents: 'none', zIndex: 9999,
          animation: 'ballFlash 0.6s ease-out forwards',
          '@keyframes ballFlash': {
            '0%': { opacity: 1, transform: 'scale(0.4)' },
            '100%': { opacity: 0, transform: 'scale(1.8)' },
          },
        }}>{flashLabel}</Typography>
      )}
    </Box>
  );
}