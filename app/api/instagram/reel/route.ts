import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
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
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { postId, caption, videoUrl, coverUrl } = body as {
    postId: string
    caption?: string
    videoUrl: string
    coverUrl?: string
  }

  if (!postId || !videoUrl) {
    return NextResponse.json(
      { error: 'postId and videoUrl are required' },
      { status: 400 }
    )
  }

  const { data: ownedPost, error: postError } = await supabase
    .from('posts')
    .select('id, media(media_url)')
    .eq('id', postId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (postError || !ownedPost) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const postMedia = ownedPost.media
    ? Array.isArray(ownedPost.media)
      ? ownedPost.media
      : [ownedPost.media]
    : []
  const ownsRequestedMedia = postMedia.some((item) => item.media_url === videoUrl)

  if (!ownsRequestedMedia) {
    return NextResponse.json(
      { error: 'Media does not belong to this post' },
      { status: 400 }
    )
  }

  // Fetch the stored Instagram access token for this user
  const { data: tokenRecord, error: tokenError } = await supabase
    .from('user_oauth_tokens')
    .select('access_token')
    .eq('user_id', user.id)
    .eq('provider', 'instagram')
    .single()

  if (tokenError || !tokenRecord) {
    return NextResponse.json(
      { error: 'Instagram account not connected' },
      { status: 403 }
    )
  }

  const accessToken = tokenRecord.access_token

  try {
    // Step 1: Get the user's Instagram account ID
    const igUserRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`
    )
    if (!igUserRes.ok) {
      const igErr = await igUserRes.json()
      return NextResponse.json(
        { error: 'Failed to fetch Instagram user', details: igErr },
        { status: 502 }
      )
    }
    const igUser = await igUserRes.json()
    const igUserId: string = igUser.id

    // Step 2: Create a Reels media container
    const containerPayload: Record<string, string> = {
      media_type: 'REELS',
      video_url: videoUrl,
      caption: caption ?? '',
      access_token: accessToken,
    }
    if (coverUrl) {
      containerPayload.cover_url = coverUrl
    }

    const createContainerRes = await fetch(
      `https://graph.instagram.com/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(containerPayload),
      }
    )

    if (!createContainerRes.ok) {
      const containerErr = await createContainerRes.json()
      return NextResponse.json(
        { error: 'Failed to create Instagram Reel container', details: containerErr },
        { status: 502 }
      )
    }

    const { id: containerId } = await createContainerRes.json()

    // Step 3: Poll until the container is ready (status = FINISHED)
    let status = 'IN_PROGRESS'
    let attempts = 0
    const maxAttempts = 20
    const pollInterval = 5000 // 5 seconds

    while (status !== 'FINISHED' && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
      const statusRes = await fetch(
        `https://graph.instagram.com/${containerId}?fields=status_code&access_token=${accessToken}`
      )
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        status = statusData.status_code ?? 'IN_PROGRESS'
      }
      attempts++
    }

    if (status !== 'FINISHED') {
      return NextResponse.json(
        { error: 'Instagram Reel processing timed out. Try again later.' },
        { status: 504 }
      )
    }

    // Step 4: Publish the container
    const publishRes = await fetch(
      `https://graph.instagram.com/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      }
    )

    if (!publishRes.ok) {
      const publishErr = await publishRes.json()
      return NextResponse.json(
        { error: 'Failed to publish Instagram Reel', details: publishErr },
        { status: 502 }
      )
    }

    const { id: instagramReelId } = await publishRes.json()

    // Step 5: Store the Instagram reel ID on the OOTD post record
    await supabase
      .from('posts')
      .update({ instagram_reel_id: instagramReelId })
      .eq('id', postId)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, instagramReelId })
  } catch (err) {
    console.error('Instagram reel error:', err)
    return NextResponse.json(
      { error: 'Unexpected error posting Reel to Instagram' },
      { status: 500 }
    )
  }
}
