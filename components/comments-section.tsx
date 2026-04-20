'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Share2 } from 'lucide-react'
import { toast } from 'sonner'

interface Comment {
  id: string
  user_id: string | null
  comment: string
  rating: number
  is_anonymous: boolean
  created_at: string
  users?: {
    username: string
  }
}

interface CommentsSectionProps {
  postId: string
  username: string
}

export function CommentsSection({ postId, username }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchComments()
  }, [postId, supabase])

  const fetchComments = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('ratings')
        .select(`
          id,
          user_id,
          comment,
          rating,
          is_anonymous,
          created_at,
          users:user_id(username)
        `)
        .eq('post_id', postId)
        .not('comment', 'is', null)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching comments:', error)
        return
      }

      setComments(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  const shareComment = async (comment: Comment) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const postUrl = `${baseUrl}/post/${postId}`
    const commentText = comment.comment.trim().slice(0, 180)
    const message = `Anonymous feedback on @${username}'s OOTD: "${commentText}" 👗`

    try {
      if (navigator.share) {
        await navigator.share({
          title: `@${username}'s OOTD feedback`,
          text: message,
          url: postUrl,
        })
        return
      }

      await navigator.clipboard.writeText(`${message} ${postUrl}`)
      toast.success('Copied! Paste this into your Instagram Story or post.')
    } catch {
      toast.error('Unable to share this comment right now')
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Comments</h3>
      
      {comments.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No comments yet</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <Card key={comment.id} className="p-4 bg-card border-border/50">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">
                      {comment.is_anonymous
                        ? 'Anonymous'
                        : `@${comment.users?.username || 'Unknown'}`}
                    </p>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          className={`text-lg ${
                            i < comment.rating
                              ? 'text-yellow-500'
                              : 'text-muted'
                          }`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-sm">{comment.comment}</p>
                <Button
                  onClick={() => shareComment(comment)}
                  variant="outline"
                  size="sm"
                  className="border-border mt-2"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share comment
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
