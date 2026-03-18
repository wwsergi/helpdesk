import { createAuthToken, COOKIE_NAME } from '@/lib/auth';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(req: Request) {
  const { username, password } = await req.json();

  const correctUsername = process.env.SETTINGS_USERNAME;
  const correctPassword = process.env.SETTINGS_PASSWORD;
  const secret = process.env.AUTH_SECRET;

  if (!correctUsername || !correctPassword || !secret) {
    return Response.json({ error: 'Auth not configured on the server.' }, { status: 500 });
  }

  // Always run createAuthToken to avoid timing-based username enumeration
  await createAuthToken(secret);

  if (
    !username || !password ||
    username !== correctUsername ||
    password !== correctPassword
  ) {
    return Response.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  const token = await createAuthToken(secret);
  const cookie = `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}`;

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
}

export async function DELETE() {
  const cookie = `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`;
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
}
