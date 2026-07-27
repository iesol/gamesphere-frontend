import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Card, Typography, Button, Stack, Select, MenuItem, FormControl, InputLabel, Alert, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import api, { createMatchSse } from '../lib/api';

const RUN_OPTIONS = [0, 1, 2, 3, 4, 6];
const EXTRAS = ['none', 'wide', 'no_ball', 'byes', 'leg_byes'];
const WICKET_TYPES = ['none', 'bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket'];

const INNINGS_LABELS: Record<number, string> = { 1: '1st Innings', 2: '2nd Innings' };

export default function MatchScore() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [runs, setRuns] = useState(0);
  const [extrasType, setExtrasType] = useState('none');
  const [wicketType, setWicketType] = useState('none');
  const [bowlerId, setBowlerId] = useState('');
  const [strikerId, setStrikerId] = useState('');
  const [nonStrikerId, setNonStrikerId] = useState('');
  const [wicketPlayerId, setWicketPlayerId] = useState('');
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [showInningsDialog, setShowInningsDialog] = useState(false);
  const [ballFlashLabel, setBallFlashLabel] = useState<string | null>(null);
  const [ballFlashKey, setBallFlashKey] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustRuns, setAdjustRuns] = useState(0);
  const [adjustWickets, setAdjustWickets] = useState(0);
  const [adjustOvers, setAdjustOvers] = useState(0);

  const triggerFlash = useCallback((label: string) => {
    setBallFlashLabel(label);
    setBallFlashKey((k) => k + 1);
    setTimeout(() => setBallFlashLabel(null), 600);
  }, []);

  const { data: match } = useQuery({
    queryKey: ['match', id],
    queryFn: () => api.get(`/matches/${id}`).then((r) => r.data),
  });

  const { data: teams } = useQuery({
    queryKey: ['tournament-teams', match?.tournamentId],
    queryFn: () => api.get(`/tournaments/${match.tournamentId}/teams`).then((r) => r.data),
    enabled: !!match?.tournamentId,
  });

  const { data: orgUsers } = useQuery({
    queryKey: ['org-users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const { data: state } = useQuery({
    queryKey: ['cricket-state', id],
    queryFn: () => api.get(`/cricket/${id}/state`).then((r) => r.data),
  });

  const { data: events } = useQuery({
    queryKey: ['cricket-events', id],
    queryFn: () => api.get(`/cricket/${id}/events`).then((r) => r.data),
  });

  useEffect(() => {
    api.post(`/matches/${id}/lock`).catch(() => {});
    return () => { api.delete(`/matches/${id}/lock`).catch(() => {}); };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const sse = createMatchSse(id);
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['cricket-state', id] });
      queryClient.invalidateQueries({ queryKey: ['cricket-events', id] });
    };
    sse.addEventListener('ball', refresh);
    sse.addEventListener('state_update', refresh);
    sse.addEventListener('innings_end', () => {
      queryClient.invalidateQueries({ queryKey: ['cricket-state', id] });
      queryClient.invalidateQueries({ queryKey: ['cricket-events', id] });
      queryClient.invalidateQueries({ queryKey: ['match', id] });
    });
    sse.addEventListener('match_end', () => {
      queryClient.invalidateQueries({ queryKey: ['cricket-state', id] });
      queryClient.invalidateQueries({ queryKey: ['cricket-events', id] });
      queryClient.invalidateQueries({ queryKey: ['match', id] });
    });
    return () => sse.close();
  }, [id, queryClient]);

  const ballMutation = useMutation({
    mutationFn: (data: any) => api.post(`/cricket/${id}/ball`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cricket-state', id] });
      queryClient.invalidateQueries({ queryKey: ['cricket-events', id] });
      let label = `${runs}`;
      if (wicketType !== 'none') label = wicketType === 'run_out' ? 'RO' : 'W';
      else if (extrasType !== 'none') label = extrasType === 'wide' ? 'WD' : extrasType === 'no_ball' ? 'NB' : extrasType === 'byes' ? 'B' : 'LB';
      triggerFlash(label);
      setRuns(0); setExtrasType('none'); setWicketType('none'); setWicketPlayerId('');
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ eventId, data }: { eventId: string; data: any }) => api.patch(`/cricket/events/${eventId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cricket-events', id] });
      queryClient.invalidateQueries({ queryKey: ['cricket-state', id] });
      const label = wicketType !== 'none' ? (wicketType === 'run_out' ? 'RO' : 'W') : extrasType !== 'none' ? (extrasType === 'wide' ? 'WD' : extrasType === 'no_ball' ? 'NB' : extrasType === 'byes' ? 'B' : 'LB') : `${runs}`;
      triggerFlash(label);
      setEditEventId(null);
      setRuns(0); setExtrasType('none'); setWicketType('none');
    },
  });

  const inningsEndMutation = useMutation({
    mutationFn: () => api.post(`/cricket/${id}/innings-end`),
    onSuccess: (res) => {
      if (res?.data?.done) {
        api.delete(`/matches/${id}/lock`).catch(() => {});
        navigate(`/matches/${id}`);
      } else {
        queryClient.invalidateQueries({ queryKey: ['cricket-state', id] });
        queryClient.invalidateQueries({ queryKey: ['cricket-events', id] });
        setStrikerId(''); setNonStrikerId('');
        setShowInningsDialog(false);
      }
    },
  });

  const adjustMutation = useMutation({
    mutationFn: (data: { totalRuns?: number; wickets?: number; oversBowled?: number }) => api.patch(`/cricket/${id}/state`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cricket-state', id] });
      setAdjustOpen(false);
    },
  });

  // Sync local batsmen state from server state
  const cb = state?.currentBatsmen || {};
  useEffect(() => {
    if (cb.strikerId && cb.strikerId !== strikerId) setStrikerId(cb.strikerId);
    if (cb.nonStrikerId && cb.nonStrikerId !== nonStrikerId) setNonStrikerId(cb.nonStrikerId);
  }, [cb.strikerId, cb.nonStrikerId]);

  // Determine bowling/batting teams from toss + innings
  const toss = match?.result?.toss;
  const bowlingTeamId = toss && state ? (() => {
    const tossLoserId = match.homeTeamId === toss.winner ? match.awayTeamId : match.homeTeamId;
    return state.innings === 1
      ? (toss.choice === 'bat' ? tossLoserId : toss.winner)
      : (toss.choice === 'bat' ? toss.winner : tossLoserId);
  })() : null;
  const battingTeamId = toss && state ? (() => {
    const tossLoserId = match.homeTeamId === toss.winner ? match.awayTeamId : match.homeTeamId;
    return state.innings === 1
      ? (toss.choice === 'bat' ? toss.winner : tossLoserId)
      : (toss.choice === 'bat' ? tossLoserId : toss.winner);
  })() : null;

  const bowlingTeam = teams?.find((t: any) => t.id === bowlingTeamId);
  const battingTeam = teams?.find((t: any) => t.id === battingTeamId);
  const bowlerUserIds = bowlingTeam ? (bowlingTeam.members || []).map((m: any) => m.userId) : [];
  const battingUserIds = battingTeam ? (battingTeam.members || []).map((m: any) => m.userId) : [];
  const userLookup = Object.fromEntries((orgUsers || []).map((u: any) => [u.id, u]));

  // Batsman stats from server state
  const batsmenStats: Record<string, any> = (state?.extras as any)?.batsmenStats || {};
  const currentBatsmenList = [strikerId, nonStrikerId].filter(Boolean).map((id) => ({ id, ...(batsmenStats[id] || { runs: 0, balls: 0, fours: 0, sixes: 0, out: false }) }));
  const dismissedBatsmen = Object.entries(batsmenStats)
    .filter(([, s]: any) => s.out)
    .map(([id, s]: any) => ({ id, ...s }));

  const dismissedIds = new Set(Object.entries(batsmenStats).filter(([, s]: any) => s.out).map(([id]) => id));

  if (!match) return <Box sx={{ p: 4 }}><Typography>Loading...</Typography></Box>;
  if (!orgUsers) return <Box sx={{ p: 4 }}><Typography>Loading players...</Typography></Box>;

  const handleSubmit = () => {
    if (editEventId) {
      editMutation.mutate({ eventId: editEventId, data: { runsScored: runs, extrasType, wicketType } });
    } else {
      const payload: any = { strikerId, nonStrikerId, bowlerId, runsScored: runs, extrasType, wicketType };
      if (wicketType !== 'none' && wicketPlayerId) payload.wicketPlayerId = wicketPlayerId;
      ballMutation.mutate(payload);
    }
  };

  const handleCompleteInnings = () => {
    setShowInningsDialog(true);
  };

  const confirmCompleteInnings = () => {
    inningsEndMutation.mutate();
  };

  const inningsLabel = INNINGS_LABELS[state?.innings] ?? `Innings ${state?.innings}`;
  const currentEvent = editEventId ? events?.find((e: any) => e.id === editEventId) : null;

  const renderBatsmanStat = (id: string, label?: string) => {
    const s = batsmenStats[id];
    if (!s) return null;
    const sr = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : '-';
    return (
      <Box key={id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, px: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: s.out ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {userLookup[id]?.name || id}
            {label && <Chip label={label} size="small" sx={{ ml: 0.75, height: 18, fontSize: '0.65rem', fontWeight: 600 }} />}
            {s.out && <Chip label={s.dismissal?.replace('_', ' ') || 'out'} size="small" color="error" variant="outlined" sx={{ ml: 0.75, height: 18, fontSize: '0.65rem' }} />}
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{s.runs}</Typography>
          <Typography variant="caption" color="text.secondary">{s.balls} {s.balls === 1 ? 'ball' : 'balls'}</Typography>
          <Typography variant="caption" color="text.secondary">{s.fours > 0 ? `${s.fours}x4` : ''} {s.sixes > 0 ? `${s.sixes}x6` : ''}</Typography>
          <Typography variant="caption" color="text.secondary">SR: {sr}</Typography>
        </Stack>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 2, maxWidth: 800, mx: 'auto' }}>
      <Button onClick={() => { api.delete(`/matches/${id}/lock`).catch(() => {}); navigate(`/matches/${id}`); }} sx={{ mb: 1.5, textTransform: 'none', color: 'text.secondary', fontSize: '0.85rem' }}>← Back to Match</Button>

      {/* Score Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
        <Box>
          {match.result?.completedInnings?.map((inn: any) => (
            <Typography key={inn.innings} variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
              {inn.innings === 1 ? '1st' : '2nd'} Innings: {inn.runs}/{inn.wickets} · {inn.overs} ov
            </Typography>
          ))}
          {state ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                  {state.totalRuns}<Typography component="span" variant="h4" sx={{ fontWeight: 300, color: 'text.secondary' }}>/{state.wickets}</Typography>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Overs: {state.oversBowled}
                </Typography>
              </Box>
              {state.innings === 2 && match.result?.completedInnings?.[0] && (
                <Typography variant="body1" sx={{ fontWeight: 700, color: 'warning.main', mt: 0.5 }}>
                  Target: {match.result.completedInnings[0].runs + 1}
                </Typography>
              )}
            </Box>
          ) : (
            <Typography color="text.secondary">Match not started</Typography>
          )}
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          {match.result?.toss && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
              {teams?.find((t: any) => t.id === match.result.toss.winner)?.name || '?'} won toss & {match.result.toss.choice === 'bat' ? 'bat' : 'bowl'}
            </Typography>
          )}
          <Chip label={inningsLabel} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
          {state && <Button size="small" variant="text" onClick={() => { setAdjustRuns(state.totalRuns); setAdjustWickets(state.wickets); setAdjustOvers(parseFloat(state.oversBowled) || 0); setAdjustOpen(true); }} sx={{ minWidth: 0, px: 0.5, fontSize: '0.7rem', mt: 0.5, color: 'text.secondary' }}>adjust</Button>}
        </Box>
      </Box>

      {ballMutation.isError && <Alert severity="error" sx={{ mb: 1.5, py: 0.5, '& .MuiAlert-message': { py: 0.75 } }}>Failed to log ball</Alert>}
      {currentEvent && (
        <Alert severity="info" sx={{ mb: 1.5, py: 0.5, '& .MuiAlert-message': { py: 0.75 } }}>
          Editing Over {currentEvent.overNumber}.{currentEvent.ballNumber}
        </Alert>
      )}

      {/* Scoring Card — compact */}
      <Card sx={{ mb: 2, position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ p: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Players row: Striker ↔ Non-Striker · Bowler */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel sx={{ fontSize: '0.8rem' }}>Striker</InputLabel>
              <Select value={strikerId} label="Striker" onChange={(e) => setStrikerId(e.target.value)} sx={{ fontSize: '0.85rem' }}>
                {(cb.strikerId ? [strikerId] : []).concat(cb.strikerId ? [] : battingUserIds.filter((uid: string) => uid !== nonStrikerId && !dismissedIds.has(uid))).map((uid: string) => (
                  <MenuItem key={uid} value={uid} sx={{ fontSize: '0.85rem' }}>{userLookup[uid]?.name || uid}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button size="small" onClick={() => { setStrikerId(nonStrikerId); setNonStrikerId(strikerId); }}
              sx={{ minWidth: 28, height: 40, mt: 0.5, px: 0.5, fontSize: '1rem', border: '1px solid', borderColor: 'divider', borderRadius: 1, color: 'text.secondary' }}
              title="Swap striker & non-striker">↔</Button>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel sx={{ fontSize: '0.8rem' }}>Non-Striker</InputLabel>
              <Select value={nonStrikerId} label="Non-Striker" onChange={(e) => setNonStrikerId(e.target.value)} sx={{ fontSize: '0.85rem' }}>
                {(cb.nonStrikerId ? [nonStrikerId] : []).concat(cb.nonStrikerId ? [] : battingUserIds.filter((uid: string) => uid !== strikerId && !dismissedIds.has(uid))).map((uid: string) => (
                  <MenuItem key={uid} value={uid} sx={{ fontSize: '0.85rem' }}>{userLookup[uid]?.name || uid}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel sx={{ fontSize: '0.8rem' }}>Bowler</InputLabel>
              <Select value={bowlerId} label="Bowler" onChange={(e) => setBowlerId(e.target.value)} sx={{ fontSize: '0.85rem' }}>
                {(bowlerUserIds.length > 0 ? bowlerUserIds : []).map((uid: string) => (
                  <MenuItem key={uid} value={uid} sx={{ fontSize: '0.85rem' }}>{userLookup[uid]?.name || uid}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Run buttons */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block' }}>Runs</Typography>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              {RUN_OPTIONS.map((r) => (
                <Button key={r} variant={runs === r ? 'contained' : 'outlined'} size="small" onClick={() => setRuns(r)}
                  sx={{ flex: 1, minWidth: 0, fontSize: '0.95rem', fontWeight: 700, py: 0.75 }}>{r}</Button>
              ))}
            </Box>
          </Box>

          {/* Extras + Wicket row */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block' }}>Extras</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {EXTRAS.filter((e) => e !== 'none').map((e) => (
                  <Chip key={e} label={e.replace('_', ' ')} size="small"
                    variant={extrasType === e ? 'filled' : 'outlined'} color={extrasType === e ? 'warning' : 'default'}
                    onClick={() => setExtrasType(extrasType === e ? 'none' : e)}
                    sx={{ fontWeight: extrasType === e ? 700 : 400, cursor: 'pointer', height: 28, fontSize: '0.75rem' }} />
                ))}
              </Box>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block' }}>Wicket</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {WICKET_TYPES.filter((w) => w !== 'none').map((w) => (
                  <Chip key={w} label={w.replace('_', ' ')} size="small"
                    variant={wicketType === w ? 'filled' : 'outlined'} color={wicketType === w ? 'error' : 'default'}
                    onClick={() => { setWicketType(wicketType === w ? 'none' : w); if (w !== 'run_out') setWicketPlayerId(''); }}
                    sx={{ fontWeight: wicketType === w ? 700 : 400, cursor: 'pointer', height: 28, fontSize: '0.75rem' }} />
                ))}
              </Box>
            </Box>
          </Box>

          {/* Run-out: who got out */}
          {wicketType === 'run_out' && (
            <FormControl fullWidth size="small">
              <InputLabel sx={{ fontSize: '0.8rem' }}>Who got out?</InputLabel>
              <Select value={wicketPlayerId} label="Who got out?" onChange={(e) => setWicketPlayerId(e.target.value)} sx={{ fontSize: '0.85rem' }}>
                {[strikerId, nonStrikerId].filter(Boolean).map((uid: string) => (
                  <MenuItem key={uid} value={uid} sx={{ fontSize: '0.85rem' }}>{userLookup[uid]?.name || uid}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Submit row */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" fullWidth disabled={((bowlerId === '' || strikerId === '' || nonStrikerId === '') && !editEventId) || ballMutation.isPending || editMutation.isPending || strikerId === nonStrikerId}
              onClick={handleSubmit} sx={{ py: 1, fontSize: '0.95rem', fontWeight: 700 }}>
              {editEventId ? 'Save Edit' : 'Log Ball'}
            </Button>
            {editEventId && (
              <Button variant="text" onClick={() => { setEditEventId(null); setRuns(0); setExtrasType('none'); setWicketType('none'); setWicketPlayerId(''); }}
                sx={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Cancel</Button>
            )}
          </Box>

          {/* Innings actions */}
          {!currentEvent && state?.innings < 3 && (
            <Button variant="outlined" color="secondary" fullWidth disabled={inningsEndMutation.isPending}
              onClick={handleCompleteInnings} sx={{ py: 0.75, fontSize: '0.85rem', fontWeight: 600 }}>
              Complete {state?.innings === 1 ? '1st' : '2nd'} Innings
            </Button>
          )}
        </Box>
      </Card>

      {/* Current Batsmen — compact strip */}
      {currentBatsmenList.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <Box sx={{ p: 1.5, pb: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {currentBatsmenList.map((b: any) => {
                const s = batsmenStats[b.id];
                const sr = s?.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : '-';
                return (
                  <Box key={b.id} sx={{ flex: 1, p: 1, border: '1px solid', borderColor: b.id === strikerId ? 'primary.main' : 'divider', borderRadius: 1, bgcolor: b.id === strikerId ? 'rgba(25,118,210,0.04)' : 'transparent' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      {userLookup[b.id]?.name || b.id}
                      <Chip label={b.id === strikerId ? 'Striker' : 'Non-Striker'} size="small" color={b.id === strikerId ? 'primary' : 'default'} sx={{ ml: 0.5, height: 16, fontSize: '0.6rem', fontWeight: 600 }} />
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.25 }}>
                      {s?.runs || 0}<Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>({s?.balls || 0}{s?.out ? ' Dismissed' : '*'})</Typography>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{s?.fours > 0 ? `${s.fours}x4 ` : ''}{s?.sixes > 0 ? `${s.sixes}x6 ` : ''}SR: {sr}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Card>
      )}

      {/* Ball History */}
      {events && events.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <Box sx={{ p: 2, pb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Ball History</Typography>
            <Box sx={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {[...events].filter((e: any) => e.innings === state?.innings).reverse().map((e: any) => (
                <Box key={e.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: e.wicketType !== 'none' ? 'rgba(239,68,68,0.06)' : 'transparent' }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 36, fontSize: '0.75rem', color: 'text.secondary' }}>
                      {e.overNumber}.{e.ballNumber}
                    </Typography>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.3, fontSize: '0.85rem' }}>
                        {e.runsScored > 0 ? `${e.runsScored} run${e.runsScored > 1 ? 's' : ''}` : '0 runs'}
                        {e.extrasType !== 'none' && <Chip label={e.extrasType.replace('_', ' ')} size="small" color="warning" sx={{ ml: 0.5, height: 16, fontSize: '0.6rem', fontWeight: 600 }} />}
                        {e.wicketType !== 'none' && <Chip label={e.wicketType.replace('_', ' ')} size="small" color="error" sx={{ ml: 0.5, height: 16, fontSize: '0.6rem', fontWeight: 600 }} />}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {userLookup[e.strikerId]?.name || e.strikerId?.slice(0, 8)} ▸ {userLookup[e.bowlerId]?.name || e.bowlerId?.slice(0, 8)}
                      </Typography>
                    </Box>
                  </Box>
                  <Button size="small" variant="text" onClick={() => {
                    setEditEventId(e.id); setBowlerId(e.bowlerId); setRuns(e.runsScored);
                    setExtrasType(e.extrasType); setWicketType(e.wicketType);
                  }} sx={{ minWidth: 0, px: 0.5, fontSize: '0.75rem', fontWeight: 600 }}>Edit</Button>
                </Box>
              ))}
            </Box>
          </Box>
        </Card>
      )}

      {/* Bowling Figures */}
      {events && events.length > 0 && (() => {
        const currentInningsEvents = events.filter((e: any) => e.innings === state?.innings);
        const bowlerStats: Record<string, { balls: number; runs: number; wickets: number }> = {};
        for (const e of currentInningsEvents) {
          if (!bowlerStats[e.bowlerId]) bowlerStats[e.bowlerId] = { balls: 0, runs: 0, wickets: 0 };
          if (e.extrasType === 'none') bowlerStats[e.bowlerId].balls++;
          const penalty = (e.extrasType === 'wide' || e.extrasType === 'no_ball') ? 1 : 0;
          bowlerStats[e.bowlerId].runs += e.runsScored + penalty;
          if (e.wicketType !== 'none') bowlerStats[e.bowlerId].wickets++;
        }
        return (
          <Card sx={{ mb: 2 }}>
            <Box sx={{ p: 2, pb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Bowling</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {Object.entries(bowlerStats).map(([bid, s]) => {
                  const overs = `${Math.floor(s.balls / 6)}.${s.balls % 6}`;
                  const eco = s.balls > 0 ? (s.runs / (s.balls / 6)).toFixed(2) : '0.00';
                  return (
                    <Box key={bid} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{userLookup[bid]?.name || bid}</Typography>
                      <Typography variant="body2">{s.wickets}/{s.runs} · {overs} ov · Eco: {eco}</Typography>
                    </Box>
                  );
                })}
                {Object.keys(bowlerStats).length === 0 && <Typography color="text.secondary" variant="body2">No bowling data yet.</Typography>}
          </Box>
      {/* Ball flash confirmation — full screen */}
      {ballFlashLabel && (
        <Typography key={ballFlashKey} sx={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10rem', fontWeight: 900, color: wicketType !== 'none' ? '#ef4444' : 'primary.main',
          pointerEvents: 'none', zIndex: 9999,
          animation: 'ballFlash 0.65s ease-out forwards',
          '@keyframes ballFlash': {
            '0%': { opacity: 1, transform: 'scale(0.4) translateY(0)' },
            '100%': { opacity: 0, transform: 'scale(1.8) translateY(-80px)' },
          },
        }}>{ballFlashLabel}</Typography>
      )}
        </Box>
      </Card>
        );
      })()}

      {/* Dismissed Batsmen */}
      {dismissedBatsmen.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <Box sx={{ p: 2, pb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Dismissed</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {dismissedBatsmen.map((b: any) => (
                <Chip key={b.id} label={`${userLookup[b.id]?.name || b.id} ${b.runs}(${b.balls}) — ${b.dismissal?.replace('_', ' ') || 'out'}`}
                  size="small" variant="outlined" color="error" sx={{ fontSize: '0.75rem' }} />
              ))}
            </Box>
          </Box>
        </Card>
      )}

      <Dialog open={showInningsDialog} onClose={() => setShowInningsDialog(false)}>
        <DialogTitle>Complete Innings</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to complete the {state?.innings === 1 ? '1st' : '2nd'} innings?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInningsDialog(false)}>Cancel</Button>
          <Button onClick={confirmCompleteInnings} variant="contained" color="secondary">Confirm</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={adjustOpen} onClose={() => setAdjustOpen(false)}>
        <DialogTitle>Adjust Score</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 250, pt: 1 }}>
            <TextField label="Total Runs" type="number" size="small" value={adjustRuns} onChange={(e) => setAdjustRuns(parseInt(e.target.value) || 0)} />
            <TextField label="Wickets" type="number" size="small" value={adjustWickets} onChange={(e) => setAdjustWickets(parseInt(e.target.value) || 0)} />
            <TextField label="Overs" type="number" size="small" slotProps={{ htmlInput: { step: 0.1 } }} value={adjustOvers} onChange={(e) => setAdjustOvers(parseFloat(e.target.value) || 0)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustOpen(false)}>Cancel</Button>
          <Button onClick={() => adjustMutation.mutate({ totalRuns: adjustRuns, wickets: adjustWickets, oversBowled: adjustOvers })} variant="contained" disabled={adjustMutation.isPending}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
