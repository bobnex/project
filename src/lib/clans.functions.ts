import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const clanCommand = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ token: z.string().min(1), action: z.enum(['create', 'join', 'leave', 'role', 'kick', 'announce', 'challenge', 'respond', 'roster', 'start', 'settle', 'claim', 'answer', 'tick', 'forfeit']), payload: z.record(z.unknown()) }))
  .handler(async ({ data }) => {
    const { verifyPlayer, firebaseAccess, ClanDatabase } = await import('./clan-firebase.server');
    const uid = await verifyPlayer(data.token);
    const secret = process.env['FIREBASE_SERVICE_ACCOUNT_JSON'];
    if (!secret) throw new Error('Clan matches are not activated yet. The owner must configure the clan service.');
    const db = new ClanDatabase(await firebaseAccess(secret));
    const profile = await db.get(`users/${uid}`);
    if (!profile || profile.status !== 'approved') throw new Error('An approved player account is required.');
    const { executeClanCommand } = await import('./clans-service.server');
    return executeClanCommand(db, uid, profile, data.action, data.payload);
  });
