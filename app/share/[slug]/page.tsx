import { createClient } from '@/lib/supabase/server'
import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Sparkles } from 'lucide-react'
import { ShareRatingForm } from '@/components/share-rating-form'

interface SharePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata(
  { params }: SharePageProps
): Promise<Metadata> {
  const slug = (await params).slug
  const supabase = await createClient()

  const { data: share } = await supabase
    .from('shares')
    .select('post_id')
    .eq('share_slug', slug)
    .single()

  if (!share) {
    return {
      title: 'OOTD - Share Not Found',
      description: 'This share link may have expired or been removed.',
    }
  }

  const { data: post } = await supabase
    .from('posts')
    .select(
      `
      id,
      caption,
      users:user_id(username),
      media(media_url),
      ratings(rating)
    `
    )
    .eq('id', share.post_id)
    .single()

  if (!post) {
    return {
      title: 'OOTD - Share Not Found',
    }
  }

  const firstMedia = post.media?.[0]
  const averageRating =
    post.ratings.length > 0
      ? post.ratings.reduce((sum: number, r: any) => sum + r.rating, 0) /
        post.ratings.length
      : 0
  const username = (post.users as any)?.username ?? 'someone'

  return {
    title: `Rate @${username}'s OOTD anonymously`,
    description:
      post.caption ||
      `Rate this outfit anonymously! Currently rated ${averageRating.toFixed(1)}/5`,
    openGraph: {
      title: `Rate @${username}'s OOTD — anonymously 👗`,
      description: post.caption || 'Tap to rate this outfit anonymously',
      images: firstMedia
        ? [
            {
              url: firstMedia.media_url,
              width: 1200,
              height: 1200,
              alt: "OOTD outfit photo",
            },
          ]
        : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Rate @${username}'s OOTD`,
      description: post.caption || 'Rate this outfit anonymously',
      images: firstMedia ? [firstMedia.media_url] : [],
    },
  }
}

export default async function SharePage({ params }: SharePageProps) {
  const slug = (await params).slug
  const supabase = await createClient()

  const { data: share } = await supabase
    .from('shares')
    .select('post_id')
    .eq('share_slug', slug)
    .single()

  if (!share) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-center">Link Not Found</h1>
        <p className="text-muted-foreground text-center text-sm">
          This share link may have expired or been removed.
        </p>
        <Link href="/" className="text-primary hover:underline text-sm">
          Go to OOTD →
        </Link>
      </div>
    )
  }

  const { data: post } = await supabase
    .from('posts')
    .select(
      `
      id,
      caption,
      created_at,
      users:user_id(username),
      media(media_url, media_type),
      ratings(rating)
    `
    )
    .eq('id', share.post_id)
    .single()

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-2xl font-bold">Post Not Found</h1>
        <Link href="/" className="text-primary hover:underline text-sm">
          Go to OOTD →
        </Link>
      </div>
    )
  }

  const firstMedia = post.media?.[0]
  const username = (post.users as any)?.username ?? 'someone'
  const averageRating =
    post.ratings.length > 0
      ? post.ratings.reduce(
          (sum: number, r: { rating: number }) => sum + r.rating,
          0
        ) / post.ratings.length
      : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-card/50 flex flex-col items-center pb-12">
      {/* Top logo bar */}
      <div className="w-full flex justify-center pt-5 pb-2">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight">OOTD</span>
        </Link>
      </div>

      {/* Main card — mobile-first, max width matches a phone */}
      <div className="w-full max-w-sm px-4 mt-2">
        <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-2xl shadow-primary/5">

          {/* Outfit photo with gradient overlay */}
          {firstMedia && firstMedia.media_type === 'image' ? (
            <div className="relative aspect-[4/5] w-full">
              <Image
                src={firstMedia.media_url}
                alt="OOTD outfit"
                fill
                className="object-cover"
                priority
              />
              {/* gradient scrim so text is readable */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/70" />
              {/* overlaid author info */}
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white text-xl font-bold drop-shadow">@{username}</p>
                <p className="text-white/80 text-sm drop-shadow">
                  {post.caption || 'Rate my OOTD 👗'}
                </p>
                {averageRating !== null && (
                  <p className="text-white/60 text-xs mt-0.5">
                    {averageRating.toFixed(1)} ⭐ avg · {post.ratings.length} rating
                    {post.ratings.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          ) : firstMedia && firstMedia.media_type === 'video' ? (
            <div className="aspect-[4/5] w-full bg-muted flex items-center justify-center relative">
              <video
                src={firstMedia.media_url}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
              <div className="absolute bottom-4 left-4">
                <p className="text-white text-xl font-bold">@{username}</p>
              </div>
            </div>
          ) : (
            /* No media fallback */
            <div className="aspect-[4/5] w-full bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20 flex flex-col items-center justify-center gap-2">
              <Sparkles className="w-12 h-12 text-primary/50" />
              <p className="text-lg font-bold">@{username}</p>
            </div>
          )}

          {/* Rating form */}
          <div className="px-5 pb-6 pt-5 space-y-2">
            <h2 className="text-center text-base font-semibold text-foreground">
              Rate anonymously 👀
            </h2>
            <ShareRatingForm postId={post.id} username={username} />
          </div>
        </div>

        {/* Powered by footer */}
        <p className="text-center text-xs text-muted-foreground mt-5">
          Share your own OOTD at{' '}
          <Link href="/auth/signup" className="text-primary hover:underline">
            ootd.app
          </Link>
        </p>
      </div>
    </div>
  )
}
