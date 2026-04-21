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
  const { postId, caption, mediaUrl } = body as {
    postId: string
    caption?: string
    mediaUrl: string
  }

  if (!postId || !mediaUrl) {
    return NextResponse.json(
      { error: 'postId and mediaUrl are required' },
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

  const postMedia = Array.isArray(ownedPost.media) ? ownedPost.media : []
  const ownsRequestedMedia = postMedia.some((item) => item.media_url === mediaUrl)

  if (!ownsRequestedMedia) {
    return NextResponse.json(
      { error: 'Media does not belong to this post' },
      { status: 400 }
    )
  }

  // Fetch the stored Instagram access token for this user
  const { data: tokenRecord, error: tokenError } = await supabase
    .from('user_oauth_tokens')
    .select('access_token, instagram_handle')
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
    // Step 1: Get the user's Instagram Business/Creator account ID
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

    // Step 2: Create a media container
    const createContainerRes = await fetch(
      `https://graph.instagram.com/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: mediaUrl,
          caption: caption ?? '',
          access_token: accessToken,
        }),
      }
    )

    if (!createContainerRes.ok) {
      const containerErr = await createContainerRes.json()
      return NextResponse.json(
        { error: 'Failed to create Instagram media container', details: containerErr },
        { status: 502 }
      )
    }

    const { id: containerId } = await createContainerRes.json()

    // Step 3: Publish the container
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
        { error: 'Failed to publish Instagram post', details: publishErr },
        { status: 502 }
      )
    }

    const { id: instagramPostId } = await publishRes.json()

    // Step 4: Store the Instagram post ID on the OOTD post record
    await supabase
      .from('posts')
      .update({ instagram_post_id: instagramPostId })
      .eq('id', postId)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, instagramPostId })
  } catch (err) {
    console.error('Instagram post error:', err)
    return NextResponse.json(
      { error: 'Unexpected error posting to Instagram' },
      { status: 500 }
    )
  }
}
