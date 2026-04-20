import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/feed'
  const origin = requestUrl.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/signin?error=missing_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore errors from Server Components
          }
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      `${origin}/auth/signin?error=${encodeURIComponent(error.message)}`
    )
  }

  // Ensure the user has a row in public.users (required by the posts FK).
  // The DB trigger handles brand-new signups; this upsert covers existing auth
  // users who signed up before the trigger was added.
  if (data.session) {
    const { user } = data.session
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const defaultUsername =
      (user.user_metadata?.preferred_username as string | undefined) ??
      (user.user_metadata?.user_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      (user.email ? user.email.split('@')[0] : `user_${user.id.slice(0, 8)}`)

    const { error: profileError } = await serviceClient.from('users').upsert(
      {
        id: user.id,
        email: user.email ?? '',
        username: defaultUsername,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )
    if (profileError) {
      console.error('Failed to upsert user profile:', profileError)
    }

  // If the OAuth provider returned an access token (e.g. Instagram), store it
  if (data.session && data.session.provider_token) {
    const provider = data.session.user.app_metadata?.provider as string | undefined

    if (provider && provider !== 'email') {
      // Upsert the OAuth token record so we can use it later for API calls
      await supabase.from('user_oauth_tokens').upsert(
        {
          user_id: data.session.user.id,
          provider,
          access_token: data.session.provider_token,
          refresh_token: data.session.provider_refresh_token ?? null,
          expires_at: data.session.expires_at
            ? new Date(data.session.expires_at * 1000).toISOString()
            : null,
        },
        { onConflict: 'user_id,provider' }
      )
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
