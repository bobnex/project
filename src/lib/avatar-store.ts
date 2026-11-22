import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { DEFAULT_AVATAR, type AvatarConfiguration } from "./avatar";

export async function loadAvatar(db: Firestore, uid: string): Promise<AvatarConfiguration> {
  const snap = await getDoc(doc(db, "avatars", uid));
  return snap.exists() ? { ...DEFAULT_AVATAR, ...(snap.data() as Partial<AvatarConfiguration>) } : DEFAULT_AVATAR;
}

export async function saveAvatar(db: Firestore, uid: string, avatar: AvatarConfiguration): Promise<void> {
  await setDoc(doc(db, "avatars", uid), { ...avatar, ownerUid: uid, updatedAt: Date.now() }, { merge: true });
}
