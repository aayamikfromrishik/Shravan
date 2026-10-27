import { getCaller, HttpError } from './server';

export async function requireAdmin(req: Request) {
  const c = await getCaller(req);
  if (!c.isAdmin) throw new HttpError(403, 'Admin only.');
  return c;
}
