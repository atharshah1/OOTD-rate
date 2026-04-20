import { createClient } from '@/lib/supabase/server'
import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Sparkles } from 'lucide-react'
import { StoryCardActions } from '@/components/story-card-actions'

interface StoryPageProps {
  params: Promise<{ ratingId: string }>
}

export async function generateMetadata(
  { params }: StoryPageProps
): Promise<Metadata> {
  const { ratingId } = await params
  const supabase = await createClient()

  const { data: rating } = await supabase
    .from('ratings')
    .select(
      `rating, comment, posts:post_id(users:user_id(username), media(media_url))`
    )
    .eq('id', ratingId)
    .single()

  if (!rating) return { title: 'OOTD Rating' }

  const post = rating.posts as any
  const username = post?.users?.username ?? 'someone'
  const stars = '⭐'.repeat(rating.rating)

  return {
    title: `Someone rated @${username}'s OOTD ${stars}`,
    description: rating.comment ?? `${rating.rating}/5 stars`,
  }
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { ratingId } = await params
  const supabase = await createClient()

  const { data: rating } = await supabase
    .from('ratings')
    .select(
      `
      id,
      rating,
      comment,
      created_at,
      posts:post_id(
        id,
        caption,
        users:user_id(username),
        media(media_url, media_type)
      )
    `
    )
    .eq('id', ratingId)
    .single()

  if (!rating) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold">Rating Not Found</h1>
        <Link href="/" className="text-primary hover:underline text-sm">
          Go to OOTD →
        </Link>
      </div>
    )
  }

  const post = rating.posts as any
  const username = post?.users?.username ?? 'someone'
  const firstMedia = post?.media?.[0]

  // Fetch the share slug for the "Rate theirs too" CTA
  const { data: share } = await supabase
    .from('shares')
    .select('share_slug')
    .eq('post_id', post?.id)
    .maybeSingle()

  const shareUrl = share?.share_slug
    ? `/share/${share.share_slug}`
    : `/post/${post?.id}`

  const filledStar = '⭐'
  const emptyStar = '☆'
  const starDisplay = Array.from({ length: 5 }, (_, i) =>
    i < rating.rating ? filledStar : emptyStar
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex flex-col items-center justify-between py-8 px-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-bold">OOTD</span>
      </Link>

      {/* Story Card — designed to be screenshotted */}
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-2xl shadow-primary/10">

          {/* Header */}
          <div className="px-6 pt-6 pb-4 text-center space-y-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Someone rated my OOTD
            </p>
            <p className="text-4xl tracking-wide leading-none mt-1">
              {starDisplay.join('')}
            </p>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              {rating.rating}/5
            </p>
          </div>

          {/* Comment (if any) */}
          {rating.comment && (
            <div className="mx-5 mb-4 px-4 py-3 rounded-2xl bg-muted/60 border border-border/30">
              <p className="text-sm text-center leading-relaxed">
                &ldquo;{rating.comment}&rdquo;
              </p>
            </div>
          )}

          {/* Outfit photo */}
          {firstMedia && firstMedia.media_type === 'image' && (
            <div className="relative aspect-square w-full overflow-hidden">
              <Image
                src={firstMedia.media_url}
                alt="OOTD outfit"
                fill
                className="object-cover"
                priority
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card/80" />
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                <p className="text-white font-semibold text-sm drop-shadow">
                  @{username}
                </p>
                <p className="text-white/70 text-xs drop-shadow">
                  {new Date(rating.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {/* CTA strip */}
          <div className="px-5 py-4 bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 border-t border-border/30">
            <p className="text-center text-sm font-medium text-foreground">
              Rate theirs too 👗
            </p>
            <p className="text-center text-xs text-muted-foreground mt-0.5 truncate">
              ootd.app{shareUrl}
            </p>
          </div>
        </div>

        {/* Action buttons (client component) */}
        <StoryCardActions shareUrl={shareUrl} username={username} />
      </div>

      {/* Footer hint */}
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Screenshot this card and share it to your Instagram Story, or use the
        buttons above to share the link directly.
      </p>
    </div>
  )
}
