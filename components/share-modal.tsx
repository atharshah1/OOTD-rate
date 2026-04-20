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
import { Loader2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface ShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  postId: string
}

export function ShareModal({
  open,
  onOpenChange,
  postId,
}: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open && !shareUrl) {
      generateShareLink()
    }
  }, [open, supabase, postId])

  const generateShareLink = async () => {
    setLoading(true)
    try {
      // Generate a unique slug
      const slug = `${postId.slice(0, 8)}-${Math.random().toString(36).substr(2, 9)}`

      // Create or get share record
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
      const url = `${baseUrl}/share/${finalSlug}`
      setShareUrl(url)
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

  const shareToInstagram = () => {
    // Instagram share via WhatsApp or direct message suggestion
    const text = `Check out my OOTD! Rate it: ${shareUrl}`
    const encodedText = encodeURIComponent(text)
    window.open(`https://wa.me/?text=${encodedText}`, '_blank')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Your OOTD</DialogTitle>
          <DialogDescription>
            Share this link on Instagram stories or with friends
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

              {/* Share Buttons */}
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium">Quick Share</p>
                <div className="space-y-2">
                  <Button
                    onClick={shareToInstagram}
                    className="w-full bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:opacity-90 text-white"
                  >
                    Share to Instagram (via WhatsApp)
                  </Button>
                  <Button
                    onClick={() => {
                      const text = `Check out my OOTD! ${shareUrl}`
                      const encodedText = encodeURIComponent(text)
                      window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, '_blank')
                    }}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    Share on Twitter/X
                  </Button>
                  <Button
                    onClick={() => {
                      const text = `Check out my OOTD! ${shareUrl}`
                      const encodedText = encodeURIComponent(text)
                      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')
                    }}
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white"
                  >
                    Share on Facebook
                  </Button>
                </div>
              </div>

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
