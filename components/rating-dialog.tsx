'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Star, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface RatingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  postId: string
}

export function RatingDialog({
  open,
  onOpenChange,
  postId,
}: RatingDialogProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: postData } = await supabase
          .from('posts')
          .select('user_id')
          .eq('id', postId)
          .maybeSingle()

        if (postData?.user_id === user.id) {
          toast.error('You cannot rate your own OOTD')
          return
        }

        const { data: existingRating } = await supabase
          .from('ratings')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (existingRating) {
          toast.error('You have already rated this OOTD')
          return
        }
      }

      const { error } = await supabase.from('ratings').insert({
        post_id: postId,
        user_id: user?.id ?? null,
        rating,
        comment: comment || null,
        is_anonymous: isAnonymous,
      })

      if (error) {
        if (error.code === '23505') {
          toast.error('You have already rated this OOTD')
          return
        }
        toast.error('Failed to submit rating')
      } else {
        toast.success('Rating submitted!')
        onOpenChange(false)
        setRating(0)
        setComment('')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rate This OOTD</DialogTitle>
          <DialogDescription>
            Share your honest opinion and feedback
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Rating Stars */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= (hoverRating || rating)
                        ? 'fill-yellow-500 text-yellow-500'
                        : 'text-muted-foreground'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label htmlFor="comment" className="text-sm font-medium">
              Add a Comment (Optional)
            </label>
            <Textarea
              id="comment"
              placeholder="Share your thoughts..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              className="bg-input border-border resize-none"
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500
            </p>
          </div>

          {/* Anonymous Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/50">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Anonymous</label>
              <p className="text-xs text-muted-foreground">
                {isAnonymous
                  ? 'Your identity is hidden'
                  : 'Your profile will be visible'}
              </p>
            </div>
            <Switch
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
            />
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={loading || rating === 0}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Rating'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
