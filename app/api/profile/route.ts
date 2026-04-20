import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * POST /api/profile
 *
 * Creates or updates the public.users profile for the authenticated user.
 * Uses the service-role key server-side so it is not subject to RLS policies
 * and can create the row even when no INSERT policy exists.
 *
 * Body (all fields optional):
 *   { username?: string; bio?: string }
 *
 * Returns the resulting profile row.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()

  // Verify the caller is authenticated using the anon client + their session cookie
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
            // Ignore in Server Components
          }
        },
      },
    }
  )

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse optional body fields
  let username: string | undefined
  let bio: string | undefined
  try {
    const body = await request.json()
    if (typeof body.username === 'string') {
      const trimmed = body.username.trim()
      if (trimmed.length < 1 || trimmed.length > 50) {
        return NextResponse.json(
          { error: 'Username must be between 1 and 50 characters' },
          { status: 400 }
        )
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
        return NextResponse.json(
          { error: 'Username may only contain letters, numbers, underscores, hyphens, and dots' },
          { status: 400 }
        )
      }
      username = trimmed
    }
    bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 500) : undefined
  } catch {
    // Empty or non-JSON body is fine — we use defaults below
  }

  // Fall back to a unique username derived from email / metadata when not provided
  const defaultUsername =
    username ??
    (user.user_metadata?.preferred_username as string | undefined) ??
    (user.user_metadata?.user_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    (user.email ? user.email.split('@')[0] : `user_${user.id.slice(0, 8)}`)

  // Use the service-role client to bypass RLS for this trusted server operation
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const upsertPayload: Record<string, string> = {
    id: user.id,
    email: user.email ?? '',
    username: defaultUsername,
  }
  if (bio !== undefined) {
    upsertPayload.bio = bio
  }

  const { data, error } = await serviceClient
    .from('users')
    .upsert(upsertPayload, { onConflict: 'id' })
    .select()
    .single()

  if (error) {
    console.error('Profile upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
