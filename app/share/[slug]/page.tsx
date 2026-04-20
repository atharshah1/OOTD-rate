import { createClient } from '@/lib/supabase/server'
import { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import Image from 'next/image'

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

  return {
    title: `${post.users?.username}'s OOTD on OOTD`,
    description: post.caption || `Check out this outfit rated ${averageRating.toFixed(1)}/5`,
    openGraph: {
      title: `${post.users?.username}'s OOTD`,
      description: post.caption || 'Check out this outfit',
      images: firstMedia
        ? [
            {
              url: firstMedia.media_url,
              width: 1200,
              height: 1200,
              alt: 'OOTD',
            },
          ]
        : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.users?.username}'s OOTD`,
      description: post.caption || 'Check out this outfit',
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-bold">Share Not Found</h1>
        <p className="text-muted-foreground">
          This share link may have expired or been removed.
        </p>
        <Link href="/">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Go Home
          </Button>
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-bold">Post Not Found</h1>
        <Link href="/">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Go Home
          </Button>
        </Link>
      </div>
    )
  }

  const firstMedia = post.media?.[0]
  const averageRating =
    post.ratings.length > 0
      ? post.ratings.reduce(
          (sum: number, r: { rating: number }) => sum + r.rating,
          0
        ) / post.ratings.length
      : 0

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/" className="text-2xl font-bold">
            OOTD
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Media */}
          <div className="space-y-4">
            {firstMedia && (
              <div className="aspect-square bg-muted rounded-xl overflow-hidden relative">
                {firstMedia.media_type === 'image' ? (
                  <Image
                    src={firstMedia.media_url}
                    alt="OOTD"
                    fill
                    className="object-cover"
                    priority
                  />
                ) : (
                  <video
                    src={firstMedia.media_url}
                    controls
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-6 flex flex-col justify-center">
            <Card className="p-6 bg-card border-border/50">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">By</p>
                  <p className="text-2xl font-bold">@{post.users?.username}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(post.created_at).toLocaleDateString()}
                  </p>
                </div>

                {post.caption && (
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-base">{post.caption}</p>
                  </div>
                )}

                <div className="pt-4 border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold">
                      {averageRating.toFixed(1)}
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Average Rating</p>
                      <p className="text-xs text-muted-foreground">
                        {post.ratings.length} rating
                        {post.ratings.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Link href={`/post/${post.id}`}>
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-base h-12">
                View Full Post & Rate
              </Button>
            </Link>

            <Link href="/">
              <Button
                variant="outline"
                className="w-full border-border text-base h-12"
              >
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
