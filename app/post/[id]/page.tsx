'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CommentsSection } from '@/components/comments-section'
import { RatingDialog } from '@/components/rating-dialog'
import { ShareModal } from '@/components/share-modal'
import { Loader2, Star, Share2, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'

interface Post {
  id: string
  user_id: string
  caption: string
  created_at: string
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

export default function PostPage() {
  const params = useParams()
  const postId = params.id as string
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showRatingDialog, setShowRatingDialog] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchCurrentUser()
    fetchPost()
  }, [postId, supabase])

  const fetchCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    setCurrentUserId(user?.id ?? null)
  }

  const fetchPost = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          caption,
          created_at,
          users:user_id(username),
          media(media_url, media_type),
          ratings(rating)
        `)
        .eq('id', postId)
        .single()

      if (error) {
        console.error('Error fetching post:', error)
        router.push('/feed')
        return
      }

      setPost(data)
    } catch (error) {
      console.error('Error:', error)
      router.push('/feed')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Post not found</p>
        <Link href="/feed">
          <Button>Back to Feed</Button>
        </Link>
      </div>
    )
  }

  const currentMedia = post.media?.[currentMediaIndex]
  const isOwner = post.user_id === currentUserId
  const averageRating =
    post.ratings.length > 0
      ? post.ratings.reduce((sum, r) => sum + r.rating, 0) / post.ratings.length
      : 0

  const usernamePossessive = (username: string) =>
    username.toLowerCase().endsWith('s') ? `${username}'` : `${username}'s`

  const shareOverallScore = async () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const postUrl = `${baseUrl}/post/${postId}`
    const displayName = post.users?.username || 'someone'
    const message =
      post.ratings.length > 0
        ? `@${usernamePossessive(displayName)} OOTD is currently rated ${averageRating.toFixed(1)}/5 from ${post.ratings.length} rating${post.ratings.length !== 1 ? 's' : ''}. Rate it here 👗`
        : `Be the first to rate @${usernamePossessive(displayName)} OOTD 👗`

    try {
      if (navigator.share) {
        await navigator.share({
          title: `@${usernamePossessive(displayName)} OOTD score`,
          text: message,
          url: postUrl,
        })
        return
      }

      await navigator.clipboard.writeText(`${message} ${postUrl}`)
      toast.success('Copied! Paste this into your Instagram Story or post.')
    } catch {
      toast.error('Unable to share right now')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/feed">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">OOTD</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Media */}
          <div className="lg:col-span-2 space-y-4">
            {currentMedia && (
              <div className="space-y-4">
                <div className="aspect-square bg-muted rounded-xl overflow-hidden relative">
                  {currentMedia.media_type === 'image' ? (
                    <Image
                      src={currentMedia.media_url}
                      alt="OOTD"
                      fill
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <video
                      src={currentMedia.media_url}
                      controls
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                {/* Media Navigation */}
                {post.media.length > 1 && (
                  <div className="flex gap-2">
                    {post.media.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentMediaIndex(index)}
                        className={`flex-1 h-2 rounded-full transition-all ${
                          index === currentMediaIndex
                            ? 'bg-primary'
                            : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* User Info */}
            <Card className="p-4 bg-card border-border/50">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Posted by</p>
                  <p className="font-semibold text-lg">@{post.users?.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(post.created_at).toLocaleDateString()}
                  </p>
                </div>

                {post.caption && (
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-sm">{post.caption}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Rating Stats */}
            <Card className="p-4 bg-card border-border/50">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                    <span className="text-2xl font-bold">
                      {averageRating.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {post.ratings.length} rating{post.ratings.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = post.ratings.filter(
                      (r) => r.rating === star
                    ).length
                    const percentage =
                      post.ratings.length > 0
                        ? (count / post.ratings.length) * 100
                        : 0

                    return (
                      <div key={star} className="flex items-center gap-2 text-sm">
                        <span className="w-6">{star}★</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-muted-foreground">
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <Button
                  onClick={shareOverallScore}
                  variant="outline"
                  className="w-full border-border mt-2"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Overall Score
                </Button>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-2">
              {!isOwner && (
                <Button
                  onClick={() => setShowRatingDialog(true)}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  size="lg"
                >
                  Rate This OOTD
                </Button>
              )}
              {isOwner && (
                <Button
                  onClick={() => setShowShareModal(true)}
                  variant="outline"
                  className="w-full border-border"
                  size="lg"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="mt-12 max-w-2xl">
          <CommentsSection postId={postId} username={post.users?.username || 'someone'} />
        </div>
      </main>

      {/* Rating Dialog */}
      {!isOwner && (
        <RatingDialog
          open={showRatingDialog}
          onOpenChange={setShowRatingDialog}
          postId={postId}
        />
      )}

      {/* Share Modal */}
      {isOwner && (
        <ShareModal
          open={showShareModal}
          onOpenChange={setShowShareModal}
          postId={postId}
          username={post.users?.username}
          mediaUrl={currentMedia?.media_url}
          mediaType={currentMedia?.media_type}
          caption={post.caption}
        />
      )}
    </div>
  )
}
