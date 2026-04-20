'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OOTDCard } from '@/components/ootd-card'
import { Button } from '@/components/ui/button'
import { Loader2, Plus } from 'lucide-react'
import Link from 'next/link'

interface Post {
  id: string
  user_id: string
  caption: string
  created_at: string
  media_count: number
  users: {
    username: string
  }
  media: Array<{
    media_url: string
    media_type: string
  }>
  ratings: Array<{
    rating: number
  }>
}

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/signin')
        return
      }

      fetchPosts()
    }

    checkAuth()
  }, [mounted, supabase.auth, router])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          caption,
          created_at,
          media_count,
          users:user_id(username),
          media(media_url, media_type),
          ratings(rating)
        `)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Error fetching posts:', error)
        return
      }

      setPosts(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold">OOTD</Link>
          <div className="flex gap-3 items-center">
            <Link href="/profile">
              <Button variant="outline" className="border-border">
                Profile
              </Button>
            </Link>
            <Link href="/upload">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                <Plus className="w-4 h-4" />
                Share OOTD
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Feed */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {posts.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground text-lg">No posts yet</p>
            <p className="text-muted-foreground">Be the first to share your OOTD!</p>
            <Link href="/upload">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Share Your First OOTD
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => {
              const firstMedia = post.media?.[0]
              const averageRating =
                post.ratings.length > 0
                  ? post.ratings.reduce((sum, r) => sum + r.rating, 0) /
                    post.ratings.length
                  : 0

              return (
                <OOTDCard
                  key={post.id}
                  id={post.id}
                  mediaUrl={firstMedia?.media_url || '/placeholder.jpg'}
                  caption={post.caption}
                  username={post.users?.username || 'Anonymous'}
                  ratingCount={post.ratings.length}
                  averageRating={averageRating}
                  commentCount={0}
                />
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
