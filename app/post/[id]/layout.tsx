import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'

interface PostLayoutProps {
  children: ReactNode
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: PostLayoutProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()

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
    .eq('id', id)
    .single()

  if (!post) {
    return {
      title: 'OOTD - Post Not Found',
      description: 'This post may have been removed.',
    }
  }

  const username = (post.users as { username?: string } | null)?.username ?? 'someone'
  const firstMedia = post.media?.[0]
  const averageRating =
    post.ratings.length > 0
      ? post.ratings.reduce(
          (sum: number, rating: { rating: number }) => sum + rating.rating,
          0
        ) / post.ratings.length
      : 0

  return {
    title: `@${username}'s OOTD`,
    description:
      post.caption ||
      `Rate this outfit anonymously. Current average: ${averageRating.toFixed(1)}/5`,
    openGraph: {
      title: `Rate @${username}'s OOTD — anonymously 👗`,
      description: post.caption || 'Tap to rate this outfit anonymously',
      images: firstMedia
        ? [
            {
              url: firstMedia.media_url,
              width: 1200,
              height: 1200,
              alt: post.caption || 'Outfit of the day photo',
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

export default function PostLayout({ children }: PostLayoutProps) {
  return children
}
