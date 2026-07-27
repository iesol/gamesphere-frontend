import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Card, CardHeader, Typography, Button, Stack, Chip, Alert, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import api, { createMatchSse } from '../lib/api';

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ballFlashLabel, setBallFlashLabel] = useState<string | null>(null);
  const [ballFlashKey, setBallFlashKey] = useState(0);

  const { data: match } = useQuery({
    queryKey: ['match', id],
    queryFn: () => api.get(`/matches/${id}`).then((r) => r.data),
  });

  const { data: tournament } = useQuery({
    queryKey: ['tournament', match?.tournamentId],
    queryFn: () => api.get(`/tournaments/${match?.tournamentId}`).then((r) => r.data),
    enabled: !!match?.tournamentId,
  });

  const { data: teams } = useQuery({
    queryKey: ['tournament-teams', match?.tournamentId],
    queryFn: () => api.get(`/tournaments/${match.tournamentId}/teams`).then((r) => r.data),
    enabled: !!match?.tournamentId,
  });

  const { data: cricketState } = useQuery({
    queryKey: ['cricket-state', id],
    queryFn: () => api.get(`/cricket/${id}/state`).then((r) => r.data),
    enabled: !!match, // Always fetch state when match exists
  });

  const { data: events } = useQuery({
    queryKey: ['cricket-events', id],
    queryFn: () => api.get(`/cricket/${id}/events`).then((r) => r.data),
    enabled: !!match && (match.state === 'in_progress' || match.state === 'completed'),
  });

  const { data: chessState } = useQuery({
    queryKey: ['chess-state', id],
    queryFn: () => api.get(`/chess/${id}/state`).then((r) => r.data),
    enabled: !!match && match.state === 'in_progress' && tournament?.sportType === 'chess',
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
    if (!id) return;
    const sse = createMatchSse(id);
    sse.addEventListener('ball', (e: any) => {
      const d = JSON.parse(e.data);
      queryClient.invalidateQueries({ queryKey: ['cricket-state', id] });
      queryClient.invalidateQueries({ queryKey: ['cricket-events', id] });
      let label = `${d.runsScored}`;
      if (d.wicketType && d.wicketType !== 'none') label = 'W';
      if (d.extrasType === 'wide') label = 'WD';
      else if (d.extrasType === 'no_ball') label = 'NB';
      setBallFlashLabel(label);
      setBallFlashKey((k) => k + 1);
      setTimeout(() => setBallFlashLabel(null), 650);
    });
    sse.addEventListener('state_update', () => {
      queryClient.invalidateQueries({ queryKey: ['cricket-state', id] });
    });
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
    sse.addEventListener('match_start', () => {
      queryClient.invalidateQueries({ queryKey: ['match', id] });
    });
    sse.addEventListener('score_lock', () => {
      queryClient.invalidateQueries({ queryKey: ['match', id] });
    });
    sse.addEventListener('score_unlock', () => {
      queryClient.invalidateQueries({ queryKey: ['match', id] });
    });
    return () => sse.close();
  }, [id, queryClient]);

  const sportType = tournament?.sportType;

  const [tossOpen, setTossOpen] = useState(false);
  const [tossWinner, setTossWinner] = useState('');
  const [tossChoice, setTossChoice] = useState('bat');
  const startWithTossMutation = useMutation({
    mutationFn: () => api.post(`/cricket/${id}/start`, { toss: { winner: tossWinner, choice: tossChoice } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['match', id] }); setTossOpen(false); },
  });

  const [whiteTeamOpen, setWhiteTeamOpen] = useState(false);
  const [whiteTeamId, setWhiteTeamId] = useState('');
  const startChessMutation = useMutation({
    mutationFn: () => api.post(`/chess/${id}/start`, { whiteTeamId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['match', id] }); setWhiteTeamOpen(false); },
  });

  const removeMutation = useMutation({
    mutationFn: () => api.delete(`/matches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament-matches', match?.tournamentId] });
      navigate(`/tournaments/${match?.tournamentId}`);
    },
  });

  const userLookup = Object.fromEntries((orgUsers || []).map((u: any) => [u.id, u]));
  const isAdminOrVolunteer = myRole?.roles?.some((r: string) => r === 'org_admin' || r === 'volunteer' || r === 'super_admin');
  const currentUserId = myRole?.userId;
  const lockIsStale = match?.lockedAt && Date.now() - new Date(match.lockedAt).getTime() > 60000;
  const isLockedByOther = !!match?.scoredBy && match.scoredBy !== currentUserId && !lockIsStale;
  const homeTeam = teams?.find((t: any) => t.id === match?.homeTeamId);
  const awayTeam = teams?.find((t: any) => t.id === match?.awayTeamId);

  const inningsData = useMemo(() => {
    const map: Record<number, any> = {};
    for (const inn of (match?.result?.completedInnings || [])) {
      map[inn.innings] = { ...inn, bowlers: {} };
    }
    if (cricketState && !map[cricketState.innings]) {
      map[cricketState.innings] = { innings: cricketState.innings, runs: cricketState.totalRuns, wickets: cricketState.wickets, overs: cricketState.oversBowled, batsmenStats: (cricketState.extras as any)?.batsmenStats || {}, bowlers: {} };
    } else if (cricketState) {
      map[cricketState.innings].runs = cricketState.totalRuns;
      map[cricketState.innings].wickets = cricketState.wickets;
      map[cricketState.innings].overs = cricketState.oversBowled;
      map[cricketState.innings].batsmenStats = { ...(map[cricketState.innings].batsmenStats || {}), ...((cricketState.extras as any)?.batsmenStats || {}) };
      if (!map[cricketState.innings].bowlers) map[cricketState.innings].bowlers = {};
    }
    for (const e of (events || [])) {
      if (!map[e.innings]) map[e.innings] = { innings: e.innings, runs: 0, wickets: 0, overs: 0, batsmenStats: {}, bowlers: {} };
      if (!map[e.innings].bowlers) map[e.innings].bowlers = {};
      if (!map[e.innings].bowlers[e.bowlerId]) map[e.innings].bowlers[e.bowlerId] = { balls: 0, runs: 0, wickets: 0 };
      if (e.extrasType === 'none') map[e.innings].bowlers[e.bowlerId].balls++;
      const penalty = (e.extrasType === 'wide' || e.extrasType === 'no_ball') ? 1 : 0;
      map[e.innings].bowlers[e.bowlerId].runs += e.runsScored + penalty;
      if (e.wicketType !== 'none') map[e.innings].bowlers[e.bowlerId].wickets++;
    }
    return Object.entries(map).sort(([a], [b]) => Number(a) - Number(b)).map(([, v]) => v);
  }, [events, match?.result?.completedInnings, cricketState]);

  if (!match) return <Box sx={{ p: 4 }}><Typography>Loading...</Typography></Box>;

  const isChess = sportType === 'chess';

  return (
    <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
      <Button onClick={() => navigate(-1)} sx={{ mb: 2, textTransform: 'none' }}>← Back</Button>

      <Card sx={{ mb: 4 }}>
        <CardHeader
          title={`${homeTeam?.name || match.homeTeamId || '?'} vs ${awayTeam?.name || match.awayTeamId || '?'}`}
          subheader={`${isChess ? 'Chess' : 'Cricket'} · Round ${match.round || '-'} · ${match.state}`}
          titleTypographyProps={{ variant: 'h5' }}
          action={
            <Stack direction="row" spacing={1}>
              <Chip label={match.state} size="small" color={match.state === 'in_progress' ? 'success' : match.state === 'completed' ? 'default' : 'warning'} />
              {isAdminOrVolunteer && (
                <Chip label="Delete" size="small" color="error" variant="outlined" onClick={() => { if (confirm('Delete this match?')) removeMutation.mutate(); }} sx={{ cursor: 'pointer' }} />
              )}
            </Stack>
          }
        />
        <Box sx={{ p: 3, pt: 0 }}>
          {isChess ? (
            <>
              {chessState?.whiteTeamId && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    <Chip label="White" size="small" sx={{ mr: 0.5, fontWeight: 600 }} />
                    {teams?.find((t: any) => t.id === chessState.whiteTeamId)?.name || '?'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <Chip label="Black" size="small" sx={{ mr: 0.5, fontWeight: 600 }} />
                    {teams?.find((t: any) => t.id === (match.homeTeamId === chessState.whiteTeamId ? match.awayTeamId : match.homeTeamId))?.name || '?'}
                  </Typography>
                </Box>
              )}
              <Typography variant="body2" color="text.secondary">
                Turn: <strong>{chessState?.currentTurn || 'white'}</strong>
                {chessState?.isCheck && ' · CHECK'}
                {chessState?.isCheckmate && ' · CHECKMATE'}
                {chessState?.isDraw && ' · DRAW'}
              </Typography>
              {match.result?.winner && (
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main', mb: 2 }}>
                  {teams?.find((t: any) => t.id === match.result.winner)?.name || 'Team'} won
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Moves: {(chessState?.moves || [])?.length || 0}
              </Typography>
            </>
          ) : (
            match.result?.toss && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                <Chip label="Toss" size="small" sx={{ mr: 0.75, fontWeight: 600 }} />
                {match.result.toss.choice === 'bat'
                  ? `${teams?.find((t: any) => t.id === match.result.toss.winner)?.name || '?'} won & chose to bat`
                  : `${teams?.find((t: any) => t.id === match.result.toss.winner)?.name || '?'} won & chose to bowl`}
              </Typography>
            )
          )}
          {match.state === 'scheduled' && isAdminOrVolunteer && !isChess && (
            <Button variant="contained" onClick={() => setTossOpen(true)} sx={{ mr: 1 }}>Start Match</Button>
          )}
          {match.state === 'scheduled' && isAdminOrVolunteer && isChess && (
            <Button variant="contained" onClick={() => setWhiteTeamOpen(true)} sx={{ mr: 1 }}>Start Match</Button>
          )}
          {match.state === 'in_progress' && isAdminOrVolunteer && isChess && (
            <Button variant="contained" onClick={() => navigate(isChess ? `/matches/${id}/chess-score` : `/matches/${id}/score`)}>
              Log Moves
            </Button>
          )}
        </Box>
      </Card>

      {isChess && match.state === 'in_progress' && (
        <Card sx={{ mb: 4 }}>
          <CardHeader title="Move Log" titleTypographyProps={{ variant: 'h6' }} />
          <Box sx={{ p: 3, pt: 0 }}>
            {(chessState?.moves || [])?.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(chessState.moves as any[]).map((m: any, i: number) => (
                  <Chip key={m.id || i} label={`${m.moveNumber}. ${m.san}`} size="small"
                    variant={i % 2 === 1 ? 'outlined' : 'filled'} color={i % 2 === 1 ? 'default' : 'primary'}
                    sx={{ fontWeight: i % 2 === 1 ? 400 : 700 }} />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No moves logged yet.</Typography>
            )}
          </Box>
        </Card>
       )}

      {sportType === 'cricket' && match.state === 'completed' && match?.result?.completedInnings?.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardHeader title="Scorecard" titleTypographyProps={{ variant: 'h6' }} />
          <Box sx={{ p: 3, pt: 0 }}>
            {match?.result?.winner && (
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main', mb: 2 }}>
                {teams?.find((t: any) => t.id === match.result.winner)?.name || 'Team'} won
              </Typography>
            )}
            {match?.result?.completedInnings.map((inn: any) => {
              const label = inn.innings === 1 ? '1st' : inn.innings === 2 ? '2nd' : `${inn.innings}th`;
              const toss = match?.result?.toss;
              const tossLoser = toss ? (match.homeTeamId === toss.winner ? match.awayTeamId : match.homeTeamId) : null;
              const battingTeamId = toss ? (toss.choice === 'bat'
                ? (inn.innings === 1 ? toss.winner : tossLoser)
                : (inn.innings === 1 ? tossLoser : toss.winner)) : null;
              const battingTeamName = battingTeamId ? (teams?.find((t: any) => t.id === battingTeamId)?.name || '?') : null;
              const batsmen = Object.entries(inn.batsmenStats || {});
              const innEvents = (events || []).filter((e: any) => e.innings === inn.innings);
              const bowlersMap: Record<string, { balls: number; runs: number; wickets: number }> = {};
              for (const e of innEvents) {
                if (!bowlersMap[e.bowlerId]) bowlersMap[e.bowlerId] = { balls: 0, runs: 0, wickets: 0 };
                if (e.extrasType === 'none') bowlersMap[e.bowlerId].balls++;
                const penalty = (e.extrasType === 'wide' || e.extrasType === 'no_ball') ? 1 : 0;
                bowlersMap[e.bowlerId].runs += e.runsScored + penalty;
                if (e.wicketType !== 'none') bowlersMap[e.bowlerId].wickets++;
              }
              const bowlers = Object.entries(bowlersMap);
              return (
                <Accordion key={inn.innings} defaultExpanded={true} disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none', borderBottom: '1px solid', borderColor: 'divider' }}>
                  <AccordionSummary sx={{ px: 0, minHeight: 48 }} expandIcon={<span style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.54)' }}>▾</span>}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{label} Innings — {battingTeamName || '?'}</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>{inn.runs}/{inn.wickets} · {inn.overs} ov</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pb: 2 }}>
                    {batsmen.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block' }}>Batsmen</Typography>
                        {batsmen.map(([id, s]: any) => {
                          const sr = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : '-';
                          return (
                            <Box key={id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {userLookup[id]?.name || id?.slice(0, 8)}{s.out ? '' : '*'}{s.dismissal ? ` (${s.dismissal.replace('_', ' ')})` : ''}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">{s.runs} ({s.balls} {s.balls === 1 ? 'ball' : 'balls'}, {s.fours > 0 ? `${s.fours}x4` : ''} {s.sixes > 0 ? `${s.sixes}x6` : ''} SR: {sr})</Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                    {bowlers.length > 0 && (
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block' }}>Bowling</Typography>
                        {bowlers.map(([bid, s]: any) => (
                          <Box key={bid} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{userLookup[bid]?.name || bid?.slice(0, 8)}</Typography>
                            <Typography variant="body2" color="text.secondary">{s.wickets}/{s.runs} · {Math.floor(s.balls / 6)}.{s.balls % 6} ov</Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                    {batsmen.length === 0 && bowlers.length === 0 && <Typography variant="body2" color="text.secondary">No data for this innings.</Typography>}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        </Card>
      )}

      {cricketState && inningsData.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardHeader title={match?.state === 'completed' ? 'Scorecard' : 'Live Score'} titleTypographyProps={{ variant: 'h6' }}
            action={match.state === 'in_progress' && isAdminOrVolunteer && (isLockedByOther ? <Alert severity="warning" sx={{ py: 0 }}>Being scored by another user</Alert> : <Button variant="contained" onClick={() => navigate(`/matches/${id}/score`)}>Update Score</Button>)}
          />
          <Box sx={{ p: 3, pt: 0 }}>
            {match?.result?.winner && (
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main', mb: 2 }}>
                {teams?.find((t: any) => t.id === match.result.winner)?.name || 'Team'} won
              </Typography>
            )}
            {inningsData.map((inn: any) => {
              const label = inn.innings === 1 ? '1st' : inn.innings === 2 ? '2nd' : `${inn.innings}th`;
              const isCurrent = match?.state === 'in_progress' && inn.innings === cricketState?.innings;
              const toss = match?.result?.toss;
              const tossLoser = toss ? (match.homeTeamId === toss.winner ? match.awayTeamId : match.homeTeamId) : null;
              const battingTeamId = toss ? (toss.choice === 'bat'
                ? (inn.innings === 1 ? toss.winner : tossLoser)
                : (inn.innings === 1 ? tossLoser : toss.winner)) : null;
              const battingTeamName = battingTeamId ? (teams?.find((t: any) => t.id === battingTeamId)?.name || '?') : null;
              const batsmen = Object.entries(inn.batsmenStats || {});
              const bowlers = Object.entries(inn.bowlers || {});
              return (
                <Accordion key={inn.innings} defaultExpanded={isCurrent} disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none', borderBottom: '1px solid', borderColor: 'divider' }}>
                  <AccordionSummary sx={{ px: 0, minHeight: 48 }} expandIcon={<span style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.54)' }}>▾</span>}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{label} Innings — {battingTeamName || '?'}{isCurrent ? ' (Batting)' : ''}</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>{inn.runs}/{inn.wickets} · {inn.overs} ov</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pb: 2 }}>
                    {batsmen.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block' }}>Batsmen</Typography>
                        {batsmen.map(([id, s]: any) => {
                          const sr = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : '-';
                          return (
                            <Box key={id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {userLookup[id]?.name || id?.slice(0, 8)}{s.out ? '' : '*'}{s.dismissal ? ` (${s.dismissal.replace('_', ' ')})` : ''}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">{s.runs} ({s.balls} {s.balls === 1 ? 'ball' : 'balls'}, {s.fours}x4, {s.sixes}x6) SR: {sr}</Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                    {bowlers.length > 0 && (
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block' }}>Bowling</Typography>
                        {bowlers.map(([bid, s]: any) => (
                          <Box key={bid} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{userLookup[bid]?.name || bid?.slice(0, 8)}</Typography>
                            <Typography variant="body2" color="text.secondary">{s.wickets}/{s.runs} · {Math.floor(s.balls / 6)}.{s.balls % 6} ov</Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                    {batsmen.length === 0 && bowlers.length === 0 && <Typography variant="body2" color="text.secondary">No data for this innings.</Typography>}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        </Card>
      )}

      <Dialog open={tossOpen} onClose={() => setTossOpen(false)}>
        <DialogTitle>Toss</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Winner</InputLabel>
              <Select value={tossWinner} label="Winner" onChange={(e) => setTossWinner(e.target.value)}>
                {homeTeam && <MenuItem value={homeTeam.id}>{homeTeam.name}</MenuItem>}
                {awayTeam && <MenuItem value={awayTeam.id}>{awayTeam.name}</MenuItem>}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Elected to</InputLabel>
              <Select value={tossChoice} label="Elected to" onChange={(e) => setTossChoice(e.target.value)}>
                <MenuItem value="bat">Bat</MenuItem>
                <MenuItem value="bowl">Bowl</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTossOpen(false)}>Cancel</Button>
          <Button onClick={() => startWithTossMutation.mutate()} variant="contained" disabled={!tossWinner || startWithTossMutation.isPending}>
            Start Match
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={whiteTeamOpen} onClose={() => setWhiteTeamOpen(false)}>
        <DialogTitle>Choose White Team</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Plays White</InputLabel>
              <Select value={whiteTeamId} label="Plays White" onChange={(e) => setWhiteTeamId(e.target.value)}>
                {homeTeam && <MenuItem value={homeTeam.id}>{homeTeam.name}</MenuItem>}
                {awayTeam && <MenuItem value={awayTeam.id}>{awayTeam.name}</MenuItem>}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWhiteTeamOpen(false)}>Cancel</Button>
          <Button onClick={() => startChessMutation.mutate()} variant="contained" disabled={!whiteTeamId || startChessMutation.isPending}>
            Start Match
          </Button>
        </DialogActions>
      </Dialog>

      {ballFlashLabel && (
        <Typography key={ballFlashKey} sx={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10rem', fontWeight: 900, color: 'primary.main',
          pointerEvents: 'none', zIndex: 9999,
          animation: 'ballFlash 0.65s ease-out forwards',
          '@keyframes ballFlash': {
            '0%': { opacity: 1, transform: 'scale(0.4) translateY(0)' },
            '100%': { opacity: 0, transform: 'scale(1.8) translateY(-80px)' },
          },
        }}>{ballFlashLabel}</Typography>
      )}
    </Box>
  );
}
