'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Copy, Check, Share2, ExternalLink, Instagram } from 'lucide-react'
import { toast } from 'sonner'

interface ShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  postId: string
  /** Username of the post owner */
  username?: string
  /** First media item for direct Instagram posting */
  mediaUrl?: string
  mediaType?: string
  caption?: string
}

// Keeps fallback responsive while giving the native app time to open.
const APP_LAUNCH_FALLBACK_MS = 1400
const STORY_SHARE_CTA = 'Rate my OOTD anonymously 👗'
const hasTouchInterface = () =>
  navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches

export function ShareModal({
  open,
  onOpenChange,
  postId,
  username = 'you',
  mediaUrl,
  mediaType,
  caption,
}: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hasInstagramToken, setHasInstagramToken] = useState(false)
  const [igPosting, setIgPosting] = useState(false)
  const storyLaunchCleanupRef = useRef<(() => void) | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      if (!shareUrl) generateShareLink()
      checkInstagramConnection()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, postId])

  useEffect(
    () => () => {
      storyLaunchCleanupRef.current?.()
      storyLaunchCleanupRef.current = null
    },
    []
  )

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
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const fallbackPostUrl = `${baseUrl}/post/${postId}`

    try {
      const makeSlug = () => {
        const randomSuffix = globalThis.crypto?.randomUUID
          ? globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 9)
          : Math.random().toString(36).slice(2, 11).padEnd(9, '0')
        return `${postId.slice(0, 8)}-${randomSuffix}`
      }

      const { data: existingShare } = await supabase
        .from('shares')
        .select('share_slug')
        .eq('post_id', postId)
        .maybeSingle()

      let finalSlug: string | null = null
      if (existingShare?.share_slug) {
        finalSlug = existingShare.share_slug
      } else {
        for (let attempt = 0; attempt < 3; attempt++) {
          const candidateSlug = makeSlug()
          const { error: insertError } = await supabase.from('shares').insert({
            post_id: postId,
            share_slug: candidateSlug,
          })

          if (!insertError) {
            finalSlug = candidateSlug
            break
          }

          if (insertError.code !== '23505') {
            break
          }
        }

        if (!finalSlug) {
          const { data: fallbackShare } = await supabase
            .from('shares')
            .select('share_slug')
            .eq('post_id', postId)
            .maybeSingle()

          if (fallbackShare?.share_slug) {
            finalSlug = fallbackShare.share_slug
          }
        }
      }

      if (!finalSlug) {
        setShareUrl(fallbackPostUrl)
        toast.info('Using post link for sharing')
        return
      }

      setShareUrl(`${baseUrl}/share/${finalSlug}`)
    } catch (error) {
      console.error('Error:', error)
      setShareUrl(fallbackPostUrl)
      toast.info('Using post link for sharing')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Link copied! Paste it as a link sticker on your Story 📲')
    } catch {
      toast.error('Unable to copy link. Please copy it manually.')
    }
  }

  const buildStoryClipboardText = () => {
    const cleanedCaption = caption?.trim()
    const captionBlock = cleanedCaption ? `${cleanedCaption}\n\n` : ''
    return `${captionBlock}${STORY_SHARE_CTA}\n${shareUrl}`
  }

  const openInstagramStory = async () => {
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(buildStoryClipboardText())
    } catch {
      toast.error('Unable to copy story text automatically')
    }

    const storyWebUrl = 'https://www.instagram.com/create/story/'

    if (!hasTouchInterface()) {
      openInNewTab(storyWebUrl)
      toast.success(
        'Story text copied. Paste it in Instagram Story and add the link/reply sticker.'
      )
      return
    }

    storyLaunchCleanupRef.current?.()

    let fallbackTimer: ReturnType<typeof window.setTimeout> | undefined

    const onVisibilityChange = () => {
      if (document.hidden) {
        cleanup()
        storyLaunchCleanupRef.current = null
      }
    }

    const cleanup = () => {
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer)
      }
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }

    fallbackTimer = window.setTimeout(() => {
      cleanup()
      window.location.assign(storyWebUrl)
    }, APP_LAUNCH_FALLBACK_MS)

    storyLaunchCleanupRef.current = cleanup
    document.addEventListener('visibilitychange', onVisibilityChange)
    // Instagram deep link opens the native Story camera when installed; otherwise fallback timer redirects to web.
    window.location.href = 'instagram://story-camera'
    toast.success(
      'Opening Instagram Story… text copied, now paste and add the link/reply sticker.'
    )
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
      navigator
        .share({
          title: `Rate @${username}'s OOTD`,
          text: 'Rate my outfit anonymously 👗',
          url: shareUrl,
        })
        .catch(() => {
          // User cancelled — no-op
        })
    } else {
      copyToClipboard()
    }
  }

  const openInNewTab = (url: string) => {
    if (!url) return
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (!opened) {
      toast.error('Unable to open share link. Please allow pop-ups and try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Share to Stories 📲</DialogTitle>
          <DialogDescription>
            Get anonymous ratings from your followers — just like NGL
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Story Card Preview — simulates how it looks as an Instagram link sticker */}
              <div className="rounded-2xl overflow-hidden border border-border/50 shadow-lg">
                {/* Card "screen" */}
                <div className="bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20 px-5 py-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent mx-auto flex items-center justify-center text-white text-lg font-bold">
                    {username[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-base">@{username}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Rate my OOTD anonymously 👗
                    </p>
                  </div>
                  <div className="pt-1 px-4 py-2 rounded-xl bg-background/60 text-xs text-muted-foreground truncate">
                    {shareUrl || 'generating link…'}
                  </div>
                </div>
                {/* Card footer */}
                <div className="bg-card px-4 py-2 flex items-center justify-between border-t border-border/30">
                  <span className="text-xs text-muted-foreground">Tap to rate ✨</span>
                  <span className="text-xs font-semibold text-primary">OOTD</span>
                </div>
              </div>

              {/* How to share instructions */}
              <div className="text-xs text-muted-foreground text-center space-y-0.5">
                <p>Tap Open Instagram Story to launch the app (or web fallback)</p>
                <p className="font-medium text-foreground">
                  Then paste and add the link/reply sticker 🔗
                </p>
              </div>

              {/* Primary CTAs */}
              <div className="space-y-2">
                <Button
                  onClick={openInstagramStory}
                  disabled={!shareUrl}
                  className="w-full h-11 text-sm font-semibold bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-500 hover:opacity-90 text-white gap-2"
                >
                  <Instagram className="w-4 h-4" />
                  Open Instagram Story
                </Button>

                <Button
                  onClick={copyToClipboard}
                  disabled={!shareUrl}
                  className="w-full h-11 text-sm font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Link for Stories
                    </>
                  )}
                </Button>

                <Button
                  onClick={shareNative}
                  disabled={!shareUrl}
                  variant="outline"
                  className="w-full border-border gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share via…
                </Button>
              </div>

              {/* Direct Instagram posting (if authenticated) */}
              {hasInstagramToken && mediaUrl && (
                <div className="space-y-2 pt-1 border-t border-border/30">
                  <p className="text-xs font-medium text-muted-foreground text-center">
                    Or post directly to Instagram
                  </p>
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

              {/* More sharing options (collapsed secondary) */}
              <details className="group">
                <summary className="text-xs text-muted-foreground text-center cursor-pointer hover:text-foreground transition-colors">
                  More sharing options ↓
                </summary>
                <div className="space-y-2 pt-3">
                  <Button
                    onClick={() => {
                      const text = encodeURIComponent(
                        `Rate my OOTD anonymously 👗 ${shareUrl}`
                      )
                      openInNewTab(`https://twitter.com/intent/tweet?text=${text}`)
                    }}
                    disabled={!shareUrl}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Share on Twitter/X
                  </Button>
                  <Button
                    onClick={() => {
                      openInNewTab(
                        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
                      )
                    }}
                    disabled={!shareUrl}
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white text-sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Share on Facebook
                  </Button>
                  <Button
                    onClick={() => {
                      const text = encodeURIComponent(
                        `Rate my OOTD anonymously 👗 ${shareUrl}`
                      )
                      openInNewTab(`https://wa.me/?text=${text}`)
                    }}
                    disabled={!shareUrl}
                    variant="outline"
                    className="w-full border-border text-sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Share via WhatsApp
                  </Button>
                </div>
              </details>

              {/* Connect Instagram prompt */}
              {!hasInstagramToken && (
                <p className="text-xs text-muted-foreground text-center">
                  <a href="/auth/signin" className="text-primary hover:underline">
                    Connect Instagram
                  </a>{' '}
                  to post directly to your feed or Reels.
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
