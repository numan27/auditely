// app/_shared/lib/auth/googleSignIn.ts

// Whether "Continue with Google" is offered. Hidden for the beta, whatever Supabase
// says: sign-in and sign-up show only email, and an old link to /auth/google goes
// back to the login. Set GOOGLE_SIGN_IN_HIDDEN to false to offer Google again, once
// its provider is turned on in Supabase.
export const GOOGLE_SIGN_IN_HIDDEN = true;

export async function googleSignInOn(fetcher: typeof fetch = fetch): Promise<boolean> {
  if (GOOGLE_SIGN_IN_HIDDEN) return false;
  return googleProviderOn(fetcher);
}

// Whether Google sign-in works: Supabase's public auth settings say if its Google
// provider is turned on (Authentication → Providers → Google). While it's off,
// Supabase answers the sign-in with a bare error page, so the button stays hidden.
// Settings that can't be read count as on: a hiccup mustn't hide a sign-in that
// works. Read at most once a minute.
export async function googleProviderOn(fetcher: typeof fetch = fetch): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return true;
  try {
    const res = await fetcher(`${url}/auth/v1/settings`, { headers: { apikey: key }, next: { revalidate: 60 } });
    if (!res.ok) return true;
    const settings = await res.json();
    return settings?.external?.google !== false;
  } catch {
    return true;
  }
}
