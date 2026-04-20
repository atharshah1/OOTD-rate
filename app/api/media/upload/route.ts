import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'media'

async function getAuthenticatedUser() {
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
            // Ignore in server components.
          }
        },
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return { user, error, supabase }
}

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function ensureUserOwnsPost(postId: string, userId: string, supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>['supabase']) {
  const { data: post, error } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .eq('user_id', userId)
    .single()

  return { post, error }
}

async function ensureBucketExists(serviceClient: ReturnType<typeof getServiceClient>) {
  const { data: bucket } = await serviceClient.storage.getBucket(STORAGE_BUCKET)
  if (bucket) {
    return
  }

  const { error: createError } = await serviceClient.storage.createBucket(STORAGE_BUCKET, {
    public: true,
  })

  if (createError && !/already exists/i.test(createError.message)) {
    throw createError
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError, supabase } = await getAuthenticatedUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const postIdRaw = formData.get('postId')
  const file = formData.get('file')

  if (typeof postIdRaw !== 'string' || !postIdRaw) {
    return NextResponse.json({ error: 'Missing postId' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  const { post } = await ensureUserOwnsPost(postIdRaw, user.id, supabase)
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const serviceClient = getServiceClient()

  try {
    await ensureBucketExists(serviceClient)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not initialize media storage'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const fileExt = file.name.split('.').pop() || 'bin'
  const safeExt = fileExt.replace(/[^a-zA-Z0-9]/g, '') || 'bin'
  const filePath = `${user.id}/${postIdRaw}/${Date.now()}-${crypto.randomUUID()}.${safeExt}`

  const { error: uploadError } = await serviceClient.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: publicUrlData } = serviceClient.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath)

  if (!publicUrlData.publicUrl) {
    await serviceClient.storage.from(STORAGE_BUCKET).remove([filePath])
    return NextResponse.json({ error: 'Could not generate media URL' }, { status: 500 })
  }

  return NextResponse.json({
    path: filePath,
    mediaUrl: publicUrlData.publicUrl,
    mediaType: file.type.startsWith('image') ? 'image' : 'video',
  })
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError, supabase } = await getAuthenticatedUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { postId?: string; paths?: string[] } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const postId = body.postId
  const paths = Array.isArray(body.paths) ? body.paths.filter((path): path is string => typeof path === 'string') : []

  if (!postId || paths.length === 0) {
    return NextResponse.json({ success: true })
  }

  const { post } = await ensureUserOwnsPost(postId, user.id, supabase)
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const expectedPrefix = `${user.id}/${postId}/`
  const safePaths = paths.filter((path) => path.startsWith(expectedPrefix))
  if (safePaths.length === 0) {
    return NextResponse.json({ success: true })
  }

  const serviceClient = getServiceClient()
  const { error } = await serviceClient.storage.from(STORAGE_BUCKET).remove(safePaths)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, removed: safePaths.length })
}
