import type { ClanDatabase, ClanTransaction } from './clan-firebase.server';
import { calculateClanLevel, canPerformClanAction, DEFAULT_FEE_OPTIONS, getMaxMembersForLevel, INITIAL_ACHIEVEMENTS, ROLE_HIERARCHY, type ClanBattleChallenge, type ClanRole } from './clans';
import { aggregateWar, warPairs, warSettings, warSize } from './clan-war-rules';
import { COUNTDOWN_MS, newPlayer, nextState, pointsFor, questionMs, type Match } from './game-rules';
import { shuffleOptions } from './engine';

const text = (v: unknown, max = 200) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
const ident = (v: unknown) => {
  const s = text(v, 200);
  if (!s || s.includes('/')) throw new Error('Invalid clan or match identifier.');
  return s;
};
async function member(tx: ClanTransaction, clanId: string, uid: string, action?: Parameters<typeof canPerformClanAction>[1]) {
  const m = await tx.get(`clanMembers/${clanId}_${uid}`);
  if (!m || m.clanId !== clanId || m.uid !== uid) throw new Error('You are not a member of this clan.');
  if (action && !canPerformClanAction(m.role, action)) throw new Error('Your clan role cannot perform this action.');
  return m;
}
const log = (tx: ClanTransaction, clanId: string, description: string, type = 'member_joined') => tx.set(`clanActivities/${crypto.randomUUID()}`, { clanId, description, type, timestamp: Date.now() });
async function assertNoWar(tx: ClanTransaction, clanId: string, uid: string) {
  const wars = [...await tx.list('clanBattles', 'challengerClanId', clanId), ...await tx.list('clanBattles', 'targetClanId', clanId)];
  if (wars.some(w => ['accepted','starting','in_progress'].includes(w.status) && [...(w.challengerRoster ?? []), ...(w.targetRoster ?? [])].includes(uid))) throw new Error('Finish your clan war before leaving or changing clans.');
}

export async function executeClanCommand(db: ClanDatabase, uid: string, profile: any, action: string, p: Record<string, unknown>): Promise<any> {
  if (action === 'start') return startWar(db, uid, p);
  if (action === 'settle') return settleWar(db, uid, ident(p.challengeId));
  if (['answer','tick','forfeit'].includes(action)) return playWar(db, uid, action, p);
  return db.transact(async tx => {
    const now = Date.now();
    if (action === 'create' || action === 'join') {
      const memberships = await tx.list('clanMembers', 'uid', uid);
      if (memberships.length) throw new Error('You already belong to a clan.');
      const lock = await tx.get(`clanMemberships/${uid}`);
      if (lock?.clanId) throw new Error('You already belong to a clan.');
      if (action === 'create') {
        const currentUser = await tx.get(`users/${uid}`);
        if (!currentUser || currentUser.level < 6) throw new Error('You must reach Level 6 to create a clan.');
        const name = text(p.name, 26), tag = text(p.tag, 7).toUpperCase();
        if (name.length < 3 || name.length > 25 || !/^[A-Z0-9]{2,6}$/.test(tag)) throw new Error('Use a 3–25 character name and a 2–6 letter or number tag.');
        const clanId = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const existing = await tx.get(`clans/${clanId}`);
        const sameTag = await tx.list('clans', 'tagUpper', tag);
        const tagLock = await tx.get(`clanTags/${tag}`);
        if (existing || sameTag.length || tagLock) throw new Error('This clan name or tag is already taken.');
        const fee = DEFAULT_FEE_OPTIONS.find(f => f.id === p.feeId);
        if (!fee) throw new Error('Select a valid initiation tier.');
        if ((currentUser.coins ?? 0) < fee.coins) throw new Error('Not enough game coins for this initiation tier.');
        tx.set(`users/${uid}`, { ...currentUser, coins: (currentUser.coins ?? 0) - fee.coins });
        tx.set(`clans/${clanId}`, { name, nameLower: name.toLowerCase(), tag, tagUpper: tag, description: text(p.description, 600), motto: text(p.motto), emblem: text(p.emblem, 20) || '🛡️', banner: text(p.banner, 200), leaderUid: uid, leaderName: profile.username, level: 1, xp: 0, competitivePoints: 1000, memberCount: 1, maxMembers: 5, isPublic: true, creationFeeTier: fee.id, totalBattlesWon: 0, totalBattlesLost: 0, totalBattlesDrawn: 0, totalTournamentWins: 0, achievementsUnlockedCount: 0, createdAt: now });
        tx.set(`clanMembers/${clanId}_${uid}`, { clanId, uid, username: profile.username, role: 'leader', joinedAt: now, contributionScore: 0, battlesWon: 0, battlesPlayed: 0, questionsAnswered: 0, missionsCompleted: 0 });
        tx.set(`clanMemberships/${uid}`, { clanId, uid });
        tx.set(`clanTags/${tag}`, { clanId });
        log(tx, clanId, `${profile.username} founded [${tag}] ${name}.`);
        return { clanId };
      }
      const clanId = ident(p.clanId), clan = await tx.get(`clans/${clanId}`);
      if (!clan || clan.suspended || !clan.isPublic) throw new Error('This clan is not accepting members.');
      if (clan.memberCount >= clan.maxMembers) throw new Error('This clan is full.');
      tx.set(`clans/${clanId}`, { ...clan, memberCount: clan.memberCount + 1 });
      tx.set(`clanMembers/${clanId}_${uid}`, { clanId, uid, username: profile.username, role: 'recruit', joinedAt: now, contributionScore: 0, battlesWon: 0, battlesPlayed: 0, questionsAnswered: 0, missionsCompleted: 0 });
      tx.set(`clanMemberships/${uid}`, { clanId, uid });
      log(tx, clanId, `${profile.username} joined the clan.`);
      return { clanId };
    }
    if (['respond','roster','challenge'].includes(action)) {
      if (action === 'challenge') {
        const clanId = ident(p.clanId), targetId = ident(p.targetClanId);
        if (clanId === targetId) throw new Error('Choose a different rival clan.');
        await member(tx, clanId, uid, 'battle');
        const [clan, target] = await Promise.all([tx.get(`clans/${clanId}`), tx.get(`clans/${targetId}`)]);
        const size = warSize(String(p.format));
        if (!clan || !target || clan.suspended || target.suspended) throw new Error('Both clans must be active.');
        if (clan.memberCount < size || target.memberCount < size) throw new Error(`Both clans need at least ${size} members.`);
        const wars = await tx.list('clanBattles', 'challengerClanId', clanId);
        if (wars.some(w => w.targetClanId === targetId && !['rejected','completed'].includes(w.status))) throw new Error('An active challenge already exists against this clan.');
        await assertNoWar(tx, clanId, uid);
        const id = crypto.randomUUID();
        tx.set(`clanBattles/${id}`, { challengerClanId: clanId, challengerClanName: clan.name, challengerClanTag: clan.tag, targetClanId: targetId, targetClanName: target.name, targetClanTag: target.tag, format: p.format, status: 'pending', challengerRoster: [uid], targetRoster: [], createdAt: now });
        return { challengeId: id };
      }
      const challengeId = ident(p.challengeId), war = await tx.get(`clanBattles/${challengeId}`);
      if (!war) throw new Error('War invitation not found.');
      const memberships = await tx.list('clanMembers', 'uid', uid);
      const m = memberships.find(m => [war.challengerClanId, war.targetClanId].includes(m.clanId));
      if (!m) throw new Error('Only members of the participating clans can enter.');
      if (action === 'respond') {
        if (m.clanId !== war.targetClanId || !canPerformClanAction(m.role, 'battle')) throw new Error('Only an invited clan officer may respond.');
        if (war.status !== 'pending') throw new Error('This challenge has already been answered.');
        if (p.accept === true) await assertNoWar(tx, m.clanId, uid);
        tx.set(`clanBattles/${challengeId}`, { ...war, status: p.accept === true ? 'accepted' : 'rejected', ...(p.accept === true ? { targetRoster: [uid] } : {}) });
        return { ok: true };
      }
      if (war.status !== 'accepted') throw new Error('This war is not accepting roster changes.');
      const field = m.clanId === war.challengerClanId ? 'challengerRoster' : 'targetRoster';
      const roster = strings(war[field]);
      const exists = roster.includes(uid);
      if (p.leave === true) {
        tx.set(`clanBattles/${challengeId}`, { ...war, [field]: roster.filter(id => id !== uid) });
      } else if (!exists) {
        if (roster.length >= warSize(war.format)) throw new Error('Your clan roster is full.');
        await assertNoWar(tx, m.clanId, uid);
        tx.set(`clanBattles/${challengeId}`, { ...war, [field]: [...roster, uid] });
      }
      return { ok: true };
    }
    const clanId = ident(p.clanId);
    const actor = await member(tx, clanId, uid);
    const clan = await tx.get(`clans/${clanId}`);
    if (!clan) throw new Error('Clan no longer exists.');
    if (action === 'leave' || action === 'kick' || action === 'role') {
      const targetUid = action === 'leave' ? uid : ident(p.targetUid);
      const target = await member(tx, clanId, targetUid);
      if (target.role === 'leader') throw new Error('The clan leader cannot leave or be removed.');
      if (action !== 'leave' && (!canPerformClanAction(actor.role, action === 'role' ? 'promote' : 'kick') || ROLE_HIERARCHY[actor.role as ClanRole] <= ROLE_HIERARCHY[target.role as ClanRole])) throw new Error('You cannot manage a member at your rank or higher.');
      if (action === 'role') {
        const role = text(p.role) as ClanRole;
        if (!ROLE_HIERARCHY[role] || ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[actor.role as ClanRole]) throw new Error('You cannot grant this role.');
        tx.set(`clanMembers/${clanId}_${targetUid}`, { ...target, role });
        log(tx, clanId, `${profile.username} changed ${target.username}'s role.`);
      } else {
        await assertNoWar(tx, clanId, targetUid);
        tx.delete(`clanMembers/${clanId}_${targetUid}`);
        tx.delete(`clanMemberships/${targetUid}`);
        tx.set(`clans/${clanId}`, { ...clan, memberCount: Math.max(1, clan.memberCount - 1) });
        log(tx, clanId, `${target.username} left the roster.`, 'member_left');
      }
      return { ok: true };
    }
    if (action === 'announce') {
      if (!canPerformClanAction(actor.role, 'announce')) throw new Error('Only leaders can post announcements.');
      const title = text(p.title, 100), body = text(p.body, 1000);
      if (!title || !body) throw new Error('Enter both a title and a notice.');
      tx.set(`clans/${clanId}`, { ...clan, announcements: [{ id: crypto.randomUUID(), authorUid: uid, authorName: profile.username, title, body, createdAt: now }, ...(clan.announcements ?? [])].slice(0, 10) });
      return { ok: true };
    }
    if (action === 'claim') {
      if (!canPerformClanAction(actor.role, 'claim')) throw new Error('Only clan leaders may claim rewards.');
      const achievementId = ident(p.achievementId), def = INITIAL_ACHIEVEMENTS.find(a => a.id === achievementId);
      const unlocked = await tx.get(`clanUnlockedAchievements/${clanId}_${achievementId}`);
      if (!def || !unlocked || !unlocked.unlockedAt) throw new Error('This achievement has not been unlocked.');
      if (unlocked.claimed) throw new Error('This reward has already been claimed.');
      const u = await tx.get(`users/${uid}`);
      if (def.rewardType === 'coins' && u) tx.set(`users/${uid}`, { ...u, coins: (u.coins ?? 0) + Number(def.rewardValue) });
      else if (def.rewardType === 'clan_xp') {
        const xp = clan.xp + Number(def.rewardValue), { level } = calculateClanLevel(xp);
        tx.set(`clans/${clanId}`, { ...clan, xp, level, maxMembers: getMaxMembersForLevel(level) });
      } else tx.set(`clans/${clanId}`, { ...clan, unlockedRewards: [...new Set([...(clan.unlockedRewards ?? []), String(def.rewardValue)])] });
      tx.set(`clanUnlockedAchievements/${clanId}_${achievementId}`, { ...unlocked, claimed: true, claimedAt: now, claimedByUid: uid });
      return { ok: true };
    }
    throw new Error('Unknown clan action.');
  });
}

async function startWar(db: ClanDatabase, uid: string, p: Record<string, unknown>) {
  const challengeId = ident(p.challengeId);
  const initial = await db.get(`clanBattles/${challengeId}`);
  if (!initial) throw new Error('War not found.');
  const settings = warSettings(initial.format, strings(p.subjects), Number(p.questionCount), Number(p.secondsPerQuestion));
  const courses = await db.list('subjects');
  if (settings.subjects.some(s => !courses.some(c => String(c.name ?? c.id).toLowerCase() === s.toLowerCase()))) throw new Error('One of the selected courses is no longer available.');
  const questions = (await db.list('questions')).filter(q => q.active !== false && settings.subjects.some(s => s.toLowerCase() === String(q.subject ?? q.course ?? '').toLowerCase()) && Array.isArray(q.options) && Number.isInteger(q.correctIndex ?? q.answer));
  if (questions.length < settings.questionCount) throw new Error(`These courses have ${questions.length} questions; ${settings.questionCount} are required. Add questions or reduce the count.`);
  for (let i = questions.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
  const chosen = questions.slice(0, settings.questionCount);
  return db.transact(async tx => {
    const war = await tx.get(`clanBattles/${challengeId}`);
    if (!war) throw new Error('War not found.');
    await member(tx, war.challengerClanId, uid, 'battle');
    if (war.status === 'in_progress' || war.status === 'completed') return { matchIds: war.matchIds ?? [war.matchId] };
    if (war.status !== 'accepted' && !(war.status === 'starting' && !war.matchId && !war.matchIds?.length)) throw new Error('This war is not ready to start.');
    const pairs = warPairs(war.format, strings(war.challengerRoster), strings(war.targetRoster));
    const clanA = await tx.get(`clans/${war.challengerClanId}`), clanB = await tx.get(`clans/${war.targetClanId}`);
    if (!clanA || !clanB || clanA.suspended || clanB.suspended) throw new Error('Both clans must be active.');
    const allMembers = await Promise.all(pairs.flatMap(([a,b]) => [member(tx, war.challengerClanId, a), member(tx, war.targetClanId, b)]));
    const users = await Promise.all(pairs.flatMap(([a,b]) => [tx.get(`users/${a}`), tx.get(`users/${b}`)]));
    if (users.some(u => !u || u.status !== 'approved')) throw new Error('Every roster player must have an approved account.');
    const now = Date.now(), matchIds: string[] = [];
    pairs.forEach(([a,b], i) => {
      const id = crypto.randomUUID(); matchIds.push(id);
      const m: Match = { id, mode: 'classic', status: 'countdown', phase: 'question', hostId: a, code: null, lobbyKey: null, ranked: false, maxPlayers: 2, playerIds: [a,b], players: { [a]: newPlayer(allMembers[i*2].username), [b]: newPlayer(allMembers[i*2+1].username) }, questionIds: chosen.map(q => q.id), currentIndex: 0, deadline: 0, revealEndsAt: 0, countdownEndsAt: now + COUNTDOWN_MS, lobbyEndsAt: 0, createdAt: now, winnerIds: [], clanWarId: challengeId, clanAId: war.challengerClanId, clanBId: war.targetClanId, secondsPerQuestion: settings.secondsPerQuestion, questionCount: settings.questionCount };
      tx.set(`matches/${id}`, m);
      // Freeze the answer key in a server-only document; all duels use the same question pool.
      tx.set(`clanMatchKeys/${id}`, { questions: Object.fromEntries(chosen.map(q => [q.id, { id: q.id, text: q.text ?? q.question, options: q.options, correctIndex: q.correctIndex ?? q.answer, subject: q.subject ?? q.course, active: true }])) });
    });
    tx.set(`clanBattles/${challengeId}`, { ...war, status: 'in_progress', settings, startedAt: now, matchIds, matchId: matchIds[0] });
    return { matchIds };
  });
}

async function playWar(db: ClanDatabase, uid: string, action: string, p: Record<string, unknown>) {
  const matchId = ident(p.matchId);
  const result = await db.transact(async tx => {
    const m = await tx.get(`matches/${matchId}`) as Match | null;
    if (!m?.clanWarId || !m.playerIds.includes(uid)) throw new Error('You are not a player in this clan match.');
    const keys = action === 'answer' ? await tx.get(`clanMatchKeys/${matchId}`) : null;
    const now = Date.now();
    if (action === 'tick') {
      const update = nextState(m, now);
      if (update) tx.set(`matches/${matchId}`, { ...m, ...update });
    } else if (action === 'forfeit') {
      if (['active','countdown'].includes(m.status)) tx.set(`matches/${matchId}`, { ...m, status: 'completed', forfeitedUid: uid, winnerIds: m.playerIds.filter(id => id !== uid) });
    } else {
      const idx = String(m.currentIndex), player = m.players[uid];
      if (m.status !== 'active' || m.phase !== 'question' || now > m.deadline) throw new Error('Answers are closed.');
      if (m.questionIds[m.currentIndex] !== p.questionId) throw new Error('That question has passed.');
      if (player.answers[idx]) return { challengeId: m.clanWarId };
      const original = keys?.questions?.[String(p.questionId)];
      if (!original) throw new Error('Question key not found.');
      const question = shuffleOptions(original, matchId), choice = Number(p.choice);
      if (!Number.isInteger(choice) || choice < 0 || choice >= question.options.length) throw new Error('Invalid answer.');
      const correct = question.correctIndex === choice, points = pointsFor(correct, m.deadline - now, questionMs(m.mode, m.secondsPerQuestion));
      tx.set(`matches/${matchId}`, { ...m, players: { ...m.players, [uid]: { ...player, answers: { ...player.answers, [idx]: { choice, correct, points } }, score: player.score + points, correct: player.correct + (correct ? 1 : 0), wrong: player.wrong + (correct ? 0 : 1) } } });
    }
    return { challengeId: m.clanWarId };
  });
  if (action !== 'answer') await settleWar(db, uid, result.challengeId);
  return { ok: true };
}

async function settleWar(db: ClanDatabase, uid: string, challengeId: string) {
  return db.transact(async tx => {
    const war = await tx.get(`clanBattles/${challengeId}`) as ClanBattleChallenge | null;
    if (!war) throw new Error('War not found.');
    const memberships = await tx.list('clanMembers', 'uid', uid);
    if (!memberships.some(m => [war.challengerClanId, war.targetClanId].includes(m.clanId))) throw new Error('Only participating clans can settle this war.');
    if (war.status === 'completed') return { completed: true };
    if (war.status !== 'in_progress') return { completed: false };
    const ids = war.matchIds?.length ? war.matchIds : war.matchId ? [war.matchId] : [];
    const matches = await Promise.all(ids.map(id => tx.get(`matches/${id}`))) as Match[];
    if (matches.some(m => !m)) return { completed: false };
    const result = aggregateWar(war, matches);
    if (!result) return { completed: false };
    const clanIds = [war.challengerClanId, war.targetClanId];
    const clans = await Promise.all(clanIds.map(id => tx.get(`clans/${id}`)));
    const roster = [...war.challengerRoster, ...(war.targetRoster ?? [])];
    const memberRows = await Promise.all(roster.map((id,i) => tx.get(`clanMembers/${clanIds[i < war.challengerRoster.length ? 0 : 1]}_${id}`)));
    const unlocks = await Promise.all(clanIds.map(id => tx.list('clanUnlockedAchievements', 'clanId', id)));
    if (clans.some(c => !c)) throw new Error('A participating clan could not be found.');
    const now = Date.now();
    clans.forEach((clan, side) => {
      const clanId = clanIds[side], won = result.winnerClanId === clanId, draw = result.winnerClanId === null;
      const xp = (clan.xp ?? 0) + (won ? 100 : draw ? 50 : 25), { level } = calculateClanLevel(xp);
      const updated = { ...clan, xp, level, maxMembers: getMaxMembersForLevel(level), competitivePoints: Math.max(0, (clan.competitivePoints ?? 1000) + (won ? 25 : draw ? 0 : -15)), totalBattlesWon: (clan.totalBattlesWon ?? 0) + (won ? 1 : 0), totalBattlesLost: (clan.totalBattlesLost ?? 0) + (!won && !draw ? 1 : 0), totalBattlesDrawn: (clan.totalBattlesDrawn ?? 0) + (draw ? 1 : 0) };
      const eligible = INITIAL_ACHIEVEMENTS.filter(a => (a.category === 'battle' && updated.totalBattlesWon >= a.targetValue) || (a.category === 'membership' && updated.memberCount >= a.targetValue) || (a.category === 'progression' && level >= a.targetValue) || (a.id === 'secret_underdogs' && won && clan.level < clans[1-side].level));
      const newlyUnlocked = eligible.filter(a => !unlocks[side].some(u => u.achievementId === a.id));
      newlyUnlocked.forEach(a => tx.set(`clanUnlockedAchievements/${clanId}_${a.id}`, { clanId, achievementId: a.id, unlockedAt: now, claimed: false }));
      tx.set(`clans/${clanId}`, { ...updated, achievementsUnlockedCount: (clan.achievementsUnlockedCount ?? 0) + newlyUnlocked.length });
      log(tx, clanId, draw ? 'Clan war ended in a draw.' : won ? 'Clan war won!' : 'Clan war lost.', draw ? 'battle_drawn' : won ? 'battle_won' : 'battle_lost');
    });
    memberRows.forEach((m, i) => {
      if (!m) return;
      const playerUid = roster[i], side = i < war.challengerRoster.length ? 0 : 1;
      const match = matches.find(m => m.playerIds.includes(playerUid)), player = match?.players[playerUid];
      const won = result.winnerClanId === clanIds[side];
      tx.set(`clanMembers/${clanIds[side]}_${playerUid}`, { ...m, battlesPlayed: (m.battlesPlayed ?? 0) + 1, battlesWon: (m.battlesWon ?? 0) + (won ? 1 : 0), questionsAnswered: (m.questionsAnswered ?? 0) + (player?.correct ?? 0), contributionScore: (m.contributionScore ?? 0) + (player?.score ?? 0) });
    });
    tx.set(`clanBattles/${challengeId}`, { ...war, status: 'completed', resolvedAt: now, ...result });
    return { completed: true };
  });
}
