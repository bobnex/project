import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';
import { firebaseConfig } from './firebase-config';

type Value = { nullValue?: null; booleanValue?: boolean; integerValue?: string; doubleValue?: number; stringValue?: string; arrayValue?: { values?: Value[] }; mapValue?: { fields?: Record<string, Value> }; timestampValue?: string };
export function encode(v: any): Value {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, encode(x)])) } };
}
export function decode(v: Value): any {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue ?? '');
  if ('arrayValue' in v) return (v.arrayValue?.values ?? []).map(decode);
  return Object.fromEntries(Object.entries(v.mapValue?.fields ?? {}).map(([k, x]) => [k, decode(x)]));
}
let keys: ReturnType<typeof createRemoteJWKSet> | undefined;
export async function verifyPlayer(token: string) {
  keys ??= createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
  try {
    const { payload } = await jwtVerify(token, keys, { algorithms: ['RS256'], audience: firebaseConfig.projectId, issuer: `https://securetoken.google.com/${firebaseConfig.projectId}` });
    if (!payload.sub) throw new Error('Missing user');
    return payload.sub;
  } catch { throw new Error('Please sign in again before managing your clan.'); }
}
export async function firebaseAccess(secret: string) {
  let s: { project_id: string; client_email: string; private_key: string };
  try { s = JSON.parse(secret); } catch { throw new Error('Clan service credentials need to be configured.'); }
  if (s.project_id !== firebaseConfig.projectId || !s.private_key || !s.client_email) throw new Error('Clan service credentials do not match this project.');
  const key = await importPKCS8(s.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/datastore' }).setProtectedHeader({ alg: 'RS256' }).setIssuer(s.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  const data = await res.json() as { access_token?: string };
  if (!res.ok || !data.access_token) throw new Error('Clan service could not connect. Check the saved Firebase credential.');
  return data.access_token;
}
export class ClanDatabase {
  base = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
  constructor(private token: string) {}
  async request(suffix: string, body?: unknown) {
    const res = await fetch(`${this.base}${suffix}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (res.status === 404) return null;
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(res.status === 403 ? 'Clan service lacks Firebase access.' : 'Clan update failed. Please retry.') as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return data;
  }
  async get(path: string, transaction?: string): Promise<any | null> {
    const data = await this.request(`/${path}${transaction ? `?transaction=${encodeURIComponent(transaction)}` : ''}`);
    return data ? { ...decode({ mapValue: { fields: data.fields } }), id: path.split('/').pop() } : null;
  }
  async list(collection: string, field?: string, value?: string, transaction?: string): Promise<any[]> {
    const structuredQuery = { from: [{ collectionId: collection }], ...(field ? { where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: encode(value) } } } : {}) };
    const rows = await this.request(':runQuery', { structuredQuery, ...(transaction ? { transaction } : {}) });
    return (rows ?? []).filter((r: any) => r.document).map((r: any) => ({ ...decode({ mapValue: { fields: r.document.fields } }), id: r.document.name.split('/').pop() }));
  }
  async transact<T>(fn: (tx: ClanTransaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { transaction } = await this.request(':beginTransaction', { options: { readWrite: {} } });
      const tx = new ClanTransaction(this, transaction);
      try {
        const result = await fn(tx);
        await this.request(':commit', { transaction, writes: tx.writes });
        return result;
      } catch (e) {
        await this.request(':rollback', { transaction }).catch(() => {});
        if ((e as { status?: number }).status !== 409 || attempt === 3) throw e;
      }
    }
    throw new Error('Clan is busy. Please retry.');
  }
}
export class ClanTransaction {
  writes: any[] = [];
  constructor(private db: ClanDatabase, private transaction: string) {}
  get(path: string) { return this.db.get(path, this.transaction); }
  list(collection: string, field: string, value: string) { return this.db.list(collection, field, value, this.transaction); }
  set(path: string, data: any) {
    const { id: _id, ...fields } = data;
    this.writes.push({ update: { name: `${this.db.base.replace('https://firestore.googleapis.com/v1/', '')}/${path}`, fields: encode(fields).mapValue?.fields } });
  }
  delete(path: string) { this.writes.push({ delete: `${this.db.base.replace('https://firestore.googleapis.com/v1/', '')}/${path}` }); }
}
