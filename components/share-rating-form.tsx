'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Star, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface ShareRatingFormProps {
  postId: string
  username: string
}

const RATING_LABELS: Record<number, string> = {
  1: 'Needs Work 😬',
  2: 'Not Bad 🙂',
  3: 'Looks Good 👍',
  4: 'Really Nice ✨',
  5: 'Outfit Goals 🔥',
}

export function ShareRatingForm({ postId, username }: ShareRatingFormProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const supabase = createClient()

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating first')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.from('ratings').insert({
        post_id: postId,
        user_id: null,
        rating,
        comment: comment.trim() || null,
        is_anonymous: true,
      })

      if (error) {
        toast.error('Failed to send rating. Try again.')
        return
      }

      setSubmitted(true)
    } catch {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-6 py-4 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Sent! ✨</h2>
          <p className="text-muted-foreground text-sm">
            Your anonymous rating was delivered to{' '}
            <span className="font-semibold text-foreground">@{username}</span>
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full pt-2">
          <Link href="/auth/signup">
            <Button className="w-full h-12 text-base bg-gradient-to-r from-primary via-accent to-secondary hover:opacity-90 text-white font-semibold">
              Share Your Own OOTD →
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full border-border"
            onClick={() => {
              setRating(0)
              setComment('')
              setSubmitted(false)
            }}
          >
            Rate Again
          </Button>
        </div>
      </div>
    )
  }

  const activeRating = hoverRating || rating

  return (
    <div className="space-y-5">
      {/* Stars */}
      <div className="space-y-2">
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="transition-transform hover:scale-125 active:scale-110 focus:outline-none"
              aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
            >
              <Star
                className={`w-10 h-10 transition-colors duration-100 ${
                  star <= activeRating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-muted-foreground/30'
                }`}
              />
            </button>
          ))}
        </div>
        <div className="h-5 flex items-center justify-center">
          {activeRating > 0 && (
            <p className="text-sm font-medium text-primary animate-in fade-in slide-in-from-bottom-1">
              {RATING_LABELS[activeRating]}
            </p>
          )}
        </div>
      </div>

      {/* Comment */}
      <Textarea
        placeholder="Add a comment... (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={300}
        className="bg-input border-border resize-none"
        rows={3}
      />

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={loading || rating === 0}
        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary via-accent to-secondary hover:opacity-90 text-white disabled:opacity-40"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Sending…
          </>
        ) : (
          'Send Anonymously 👻'
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Your identity is completely hidden
      </p>
    </div>
  )
}
