'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Copy, Check, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface ShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  postId: string
  /** First media item for direct Instagram posting */
  mediaUrl?: string
  mediaType?: string
  caption?: string
}

export function ShareModal({
  open,
  onOpenChange,
  postId,
  mediaUrl,
  mediaType,
  caption,
}: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hasInstagramToken, setHasInstagramToken] = useState(false)
  const [igPosting, setIgPosting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      if (!shareUrl) generateShareLink()
      checkInstagramConnection()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, postId])

  const checkInstagramConnection = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('user_oauth_tokens')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'instagram')
      .maybeSingle()

    setHasInstagramToken(!!data)
  }

  const generateShareLink = async () => {
    setLoading(true)
    try {
      const slug = `${postId.slice(0, 8)}-${Math.random().toString(36).substr(2, 9)}`

      const { data: existingShare } = await supabase
        .from('shares')
        .select('share_slug')
        .eq('post_id', postId)
        .single()

      let finalSlug = slug
      if (existingShare) {
        finalSlug = existingShare.share_slug
      } else {
        const { error } = await supabase.from('shares').insert({
          post_id: postId,
          share_slug: slug,
        })

        if (error && !error.message.includes('duplicate')) {
          toast.error('Failed to generate share link')
          setLoading(false)
          return
        }
      }

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      setShareUrl(`${baseUrl}/share/${finalSlug}`)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Failed to generate share link')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Link copied!')
  }

  const postToInstagram = async () => {
    if (!mediaUrl) {
      toast.error('No media available to post')
      return
    }

    setIgPosting(true)
    try {
      // Videos are posted as Instagram Reels; images go to the Feed
      const endpoint =
        mediaType === 'video' ? '/api/instagram/reel' : '/api/instagram/post'
      const body =
        mediaType === 'video'
          ? { postId, videoUrl: mediaUrl, caption }
          : { postId, mediaUrl, caption }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Failed to post to Instagram')
      } else {
        toast.success('Posted to Instagram! 🎉')
        onOpenChange(false)
      }
    } catch {
      toast.error('An error occurred while posting to Instagram')
    } finally {
      setIgPosting(false)
    }
  }

  const shareNative = () => {
    if (!shareUrl) return
    if (navigator.share) {
      navigator.share({
        title: 'Check out my OOTD!',
        text: 'Rate my outfit on OOTD 👗',
        url: shareUrl,
      }).catch(() => {
        // User cancelled or browser doesn't support – fall back silently
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Your OOTD</DialogTitle>
          <DialogDescription>
            Share your link or post directly to Instagram
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Share Link */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Share Link</label>
                <div className="flex gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="bg-input border-border text-sm"
                  />
                  <Button
                    onClick={copyToClipboard}
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Direct Instagram posting */}
              {hasInstagramToken && mediaUrl && (
                <div className="space-y-2 pt-2">
                  <p className="text-sm font-medium">Post to Instagram</p>
                  <Button
                    onClick={postToInstagram}
                    disabled={igPosting}
                    className="w-full bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:opacity-90 text-white"
                  >
                    {igPosting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Posting…
                      </>
                    ) : mediaType === 'video' ? (
                      'Post as Instagram Reel'
                    ) : (
                      'Post to Instagram Feed'
                    )}
                  </Button>
                </div>
              )}

              {/* Quick Share */}
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium">Quick Share</p>
                <div className="space-y-2">
                  {/* Native share (mobile) */}
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <Button
                      onClick={shareNative}
                      className="w-full bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:opacity-90 text-white"
                    >
                      Share via Instagram / Stories
                    </Button>
                  )}

                  {/* Twitter/X */}
                  <Button
                    onClick={() => {
                      const text = encodeURIComponent(`Check out my OOTD! ${shareUrl}`)
                      window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
                    }}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Share on Twitter/X
                  </Button>

                  {/* Facebook */}
                  <Button
                    onClick={() => {
                      const url = encodeURIComponent(shareUrl)
                      window.open(
                        `https://www.facebook.com/sharer/sharer.php?u=${url}`,
                        '_blank'
                      )
                    }}
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Share on Facebook
                  </Button>

                  {/* WhatsApp */}
                  <Button
                    onClick={() => {
                      const text = encodeURIComponent(
                        `Check out my OOTD! Rate it: ${shareUrl}`
                      )
                      window.open(`https://wa.me/?text=${text}`, '_blank')
                    }}
                    variant="outline"
                    className="w-full border-border"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Share via WhatsApp
                  </Button>
                </div>
              </div>

              {/* Connect Instagram prompt */}
              {!hasInstagramToken && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  <a
                    href="/auth/signin"
                    className="text-primary hover:underline"
                  >
                    Connect Instagram
                  </a>{' '}
                  to post directly to your feed or Reels.
                </p>
              )}

              <p className="text-xs text-muted-foreground text-center pt-2">
                Anyone with this link can view and rate your OOTD
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
