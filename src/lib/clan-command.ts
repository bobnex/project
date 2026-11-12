import { getFirebase } from './firebase';
import { clanCommand } from './clans.functions';

export async function sendClanCommand(action: Parameters<typeof clanCommand>[0]['data']['action'], payload: Record<string, unknown>) {
  const fb = await getFirebase();
  const user = fb.auth.currentUser;
  if (!user) throw new Error('Sign in to continue.');
  return clanCommand({ data: { token: await user.getIdToken(), action, payload } });
}
