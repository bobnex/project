import type { ClanBattleChallenge } from './clans';
import type { Match } from './game-rules';

export function warSize(format: string): number {
  if (format === '1v1') return 1;
  if (format === '3v3') return 3;
  if (format === '5v5') return 5;
  throw new Error('Choose 1v1, 3v3 or 5v5.');
}

export function warPairs(format: string, a: string[], b: string[]): [string, string][] {
  const size = warSize(format);
  if (a.length !== size || b.length !== size) throw new Error(`Both clans need exactly ${size} players.`);
  if (new Set([...a, ...b]).size !== size * 2) throw new Error('Each player must occupy just one roster slot.');
  return a.map((uid, i) => [uid, b[i]]);
}

export function warSettings(format: string, subjects: string[], count?: number, seconds?: number) {
  warSize(format);
  const pool = [...new Set(subjects.map(s => s.trim()).filter(Boolean))];
  if (!pool.length) throw new Error('Select at least one course.');
  const defaultCount = format === '1v1' ? 10 : format === '3v3' ? 25 : 30;
  return {
    subjects: pool,
    questionCount: Math.max(10, Math.min(30, Math.floor(Number(count) || defaultCount))),
    secondsPerQuestion: Math.max(5, Math.min(60, Math.floor(Number(seconds) || 15))),
  };
}

export function aggregateWar(challenge: ClanBattleChallenge, matches: Match[]) {
  const a = challenge.challengerRoster;
  const b = challenge.targetRoster ?? [];
  const pairs = warPairs(challenge.format, a, b);
  if (matches.length !== pairs.length || matches.some(m => m.status !== 'completed')) return null;
  let scoreA = 0, scoreB = 0;
  for (let i = 0; i < pairs.length; i++) {
    const [uidA, uidB] = pairs[i];
    const m = matches[i];
    if (!m.players[uidA] || !m.players[uidB] || m.clanWarId !== challenge.id) throw new Error('War match participants do not match the roster.');
    // A forfeiting player contributes zero; a forfeited duel cannot reward the forfeiting side.
    scoreA += m.forfeitedUid === uidA ? 0 : m.players[uidA].score;
    scoreB += m.forfeitedUid === uidB ? 0 : m.players[uidB].score;
    if (m.forfeitedUid === uidA) scoreB += 1;
    if (m.forfeitedUid === uidB) scoreA += 1;
  }
  return { scores: { [challenge.challengerClanId]: scoreA, [challenge.targetClanId]: scoreB },
    winnerClanId: scoreA === scoreB ? null : scoreA > scoreB ? challenge.challengerClanId : challenge.targetClanId };
}