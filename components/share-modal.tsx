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
import {
  Loader2,
  Copy,
  Check,
  Download,
  Share2,
  ExternalLink,
  Instagram,
  Images,
  Link2,
} from 'lucide-react'
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

const STORY_CARD_WIDTH = 1080
const STORY_CARD_HEIGHT = 1920
const APP_LAUNCH_CHECK_DELAY_MS = 1400
const APP_LAUNCH_TIMEOUT_MS = 2200
const SLUG_SUFFIX_LENGTH = 12

function generateSlugSuffix() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, SLUG_SUFFIX_LENGTH)
  }

  if (globalThis.crypto?.getRandomValues) {
    const buffer = new Uint8Array(SLUG_SUFFIX_LENGTH)
    globalThis.crypto.getRandomValues(buffer)
    return Array.from(buffer, (value) => value.toString(16).padStart(2, '0')).join('').slice(0, SLUG_SUFFIX_LENGTH)
  }

  throw new Error(
    'Your browser does not support secure random values. Please update it and try again.'
  )
}

function ellipsize(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

function getShareLabel(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.host.replace(/^www\./, '')}${parsed.pathname}`
  } catch {
    return url.replace(/^https?:\/\//, '')
  }
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + safeRadius, y)
  ctx.lineTo(x + width - safeRadius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  ctx.lineTo(x + width, y + height - safeRadius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  ctx.lineTo(x + safeRadius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  ctx.lineTo(x, y + safeRadius)
  ctx.quadraticCurveTo(x, y, x + safeRadius, y)
  ctx.closePath()
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  roundedRectPath(ctx, x, y, width, height, radius)
  ctx.fill()
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
) {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let currentLine = ''
  let truncated = false

  for (const word of words) {
    if (!currentLine && ctx.measureText(word).width > maxWidth) {
      let shortenedWord = word
      while (ctx.measureText(`${shortenedWord}…`).width > maxWidth && shortenedWord.length > 0) {
        shortenedWord = shortenedWord.slice(0, -1)
      }
      lines.push(`${shortenedWord}…`)
      truncated = true
      continue
    }

    const nextLine = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(nextLine).width <= maxWidth) {
      currentLine = nextLine
      continue
    }

    if (currentLine) {
      lines.push(currentLine)
    }
    currentLine = word

    if (lines.length === maxLines - 1) {
      truncated = true
      break
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine)
  }

  const renderedLines = lines.slice(0, maxLines).map((line, index, array) => {
    if (index !== array.length - 1 || !truncated) {
      return line
    }

    let truncatedLine = line
    while (
      ctx.measureText(`${truncatedLine}…`).width > maxWidth &&
      truncatedLine.length > 0
    ) {
      truncatedLine = truncatedLine.slice(0, -1)
    }
    return `${truncatedLine}…`
  })

  renderedLines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight)
  })

  return y + renderedLines.length * lineHeight
}

async function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Unable to load image from ${url}`))
    image.src = url
  })
}

async function buildStoryCardImage({
  mediaUrl,
  mediaType,
  shareUrl,
  username,
  caption,
}: {
  mediaUrl?: string
  mediaType?: string
  shareUrl: string
  username: string
  caption?: string
}) {
  const canvas = document.createElement('canvas')
  canvas.width = STORY_CARD_WIDTH
  canvas.height = STORY_CARD_HEIGHT
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Canvas is unavailable')
  }

  const backgroundGradient = ctx.createLinearGradient(0, 0, STORY_CARD_WIDTH, STORY_CARD_HEIGHT)
  backgroundGradient.addColorStop(0, '#ff006e')
  backgroundGradient.addColorStop(0.5, '#8f00ff')
  backgroundGradient.addColorStop(1, '#00d9ff')
  ctx.fillStyle = backgroundGradient
  ctx.fillRect(0, 0, STORY_CARD_WIDTH, STORY_CARD_HEIGHT)

  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath()
  ctx.arc(180, 220, 180, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(900, 1500, 220, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(8,8,8,0.18)'
  fillRoundedRect(ctx, 56, 72, 968, 1776, 56)

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 44px sans-serif'
  ctx.fillText('Save this story card', 104, 154)

  ctx.fillStyle = 'rgba(255,255,255,0.84)'
  ctx.font = '500 28px sans-serif'
  ctx.fillText('It already includes your outfit + the exact sharing steps.', 104, 202)

  ctx.fillStyle = '#0f0f12'
  fillRoundedRect(ctx, 104, 258, 872, 1264, 44)

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 38px sans-serif'
  ctx.fillText(`@${username}`, 148, 324)

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '500 28px sans-serif'
  ctx.fillText('Rate my OOTD anonymously 👗', 148, 368)

  const imageX = 148
  const imageY = 416
  const imageWidth = 784
  const imageHeight = 700
  const imageRadius = 36

  if (mediaUrl && mediaType !== 'video') {
    try {
      const mediaImage = await loadImage(mediaUrl)
      const scale = Math.max(imageWidth / mediaImage.width, imageHeight / mediaImage.height)
      const drawWidth = mediaImage.width * scale
      const drawHeight = mediaImage.height * scale
      const drawX = imageX + (imageWidth - drawWidth) / 2
      const drawY = imageY + (imageHeight - drawHeight) / 2

      ctx.save()
      roundedRectPath(ctx, imageX, imageY, imageWidth, imageHeight, imageRadius)
      ctx.clip()
      ctx.drawImage(mediaImage, drawX, drawY, drawWidth, drawHeight)
      ctx.restore()
    } catch (error) {
      console.warn('Falling back to a gradient story card background:', error)
      const fallbackGradient = ctx.createLinearGradient(imageX, imageY, imageX + imageWidth, imageY + imageHeight)
      fallbackGradient.addColorStop(0, '#2b2b40')
      fallbackGradient.addColorStop(1, '#111827')
      ctx.fillStyle = fallbackGradient
      fillRoundedRect(ctx, imageX, imageY, imageWidth, imageHeight, imageRadius)
    }
  } else {
    const fallbackGradient = ctx.createLinearGradient(imageX, imageY, imageX + imageWidth, imageY + imageHeight)
    fallbackGradient.addColorStop(0, '#2b2b40')
    fallbackGradient.addColorStop(1, '#111827')
    ctx.fillStyle = fallbackGradient
    fillRoundedRect(ctx, imageX, imageY, imageWidth, imageHeight, imageRadius)
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 44px sans-serif'
    ctx.fillText('Your story background', imageX + 48, imageY + 100)
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.font = '500 28px sans-serif'
    ctx.fillText('Save this card, then pick it from Instagram gallery.', imageX + 48, imageY + 148)
  }

  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  fillRoundedRect(ctx, imageX + 36, imageY + imageHeight - 152, imageWidth - 72, 112, 28)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 34px sans-serif'
  ctx.fillText('Tap the Link sticker after you upload this image', imageX + 68, imageY + imageHeight - 88)

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 34px sans-serif'
  ctx.fillText('How to post it', 148, 1200)

  const steps = [
    '1. Save this image to your phone',
    '2. Open Instagram and start a Story',
    '3. Pick this saved image from your gallery',
    '4. Paste the copied link into the Link sticker',
  ]

  ctx.font = '500 30px sans-serif'
  let stepY = 1262
  for (const step of steps) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    fillRoundedRect(ctx, 148, stepY - 42, 784, 80, 22)
    ctx.fillStyle = '#ffffff'
    drawWrappedText(ctx, step, 176, stepY + 6, 728, 34, 2)
    stepY += 102
  }

  if (caption) {
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.font = '500 26px sans-serif'
    drawWrappedText(ctx, ellipsize(caption, 100), 148, 1688, 784, 30, 2)
  }

  ctx.fillStyle = '#ffffff'
  fillRoundedRect(ctx, 148, 1768, 784, 64, 24)
  ctx.fillStyle = '#0f0f12'
  ctx.font = '700 28px sans-serif'
  ctx.fillText(getShareLabel(shareUrl), 180, 1811)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }
      reject(
        new Error('Failed to generate story card image. Please try again in a moment.')
      )
    }, 'image/png')
  })
}

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
  const [storyCardUrl, setStoryCardUrl] = useState('')
  const [storyCardLoading, setStoryCardLoading] = useState(false)
  const [storyCardSaved, setStoryCardSaved] = useState(false)
  const instagramFallbackTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      if (!shareUrl) generateShareLink()
      checkInstagramConnection()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, postId])

  useEffect(() => {
    if (!open || !shareUrl) return

    let cancelled = false

    const prepareStoryCard = async () => {
      setStoryCardLoading(true)

      try {
        const blob = await buildStoryCardImage({
          mediaUrl,
          mediaType,
          shareUrl,
          username,
          caption,
        })

        if (cancelled) return

        const nextUrl = URL.createObjectURL(blob)
        setStoryCardUrl((currentUrl) => {
          if (currentUrl.startsWith('blob:')) {
            URL.revokeObjectURL(currentUrl)
          }
          return nextUrl
        })
      } catch (error) {
        console.error('Story card generation failed:', error)
        if (!cancelled) {
          setStoryCardUrl('')
        }
      } finally {
        if (!cancelled) {
          setStoryCardLoading(false)
        }
      }
    }

    prepareStoryCard()

    return () => {
      cancelled = true
    }
  }, [open, shareUrl, mediaUrl, mediaType, username, caption])

  useEffect(() => {
    if (!storyCardUrl.startsWith('blob:')) return

    return () => {
      URL.revokeObjectURL(storyCardUrl)
    }
  }, [storyCardUrl])

  useEffect(() => {
    if (!open) {
      setCopied(false)
      setStoryCardSaved(false)
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (instagramFallbackTimeoutRef.current !== null) {
        window.clearTimeout(instagramFallbackTimeoutRef.current)
      }
    }
  }, [])

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
        return `${postId.slice(0, 8)}-${generateSlugSuffix()}`
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
        let lastInsertError: { code?: string; message?: string } | null = null

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

          lastInsertError = insertError
          if (insertError.code !== '23505') {
            break
          }
        }

        if (lastInsertError && lastInsertError.code !== '23505') {
          console.error('Share link insert failed:', lastInsertError)
          toast.error('Could not create a share link right now')
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

  const copyToClipboard = async (options?: { quiet?: boolean }) => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      if (!options?.quiet) {
        toast.success('Link copied! Paste it as a link sticker on your Story 📲')
      }
      return true
    } catch {
      if (!options?.quiet) {
        toast.error('Unable to copy link. Please copy it manually.')
      }
      return false
    }
  }

  const downloadStoryCard = (options?: { quiet?: boolean }) => {
    if (!storyCardUrl) {
      if (!options?.quiet) {
        toast.error('Story card is still preparing. Please try again in a moment.')
      }
      return false
    }

    const link = document.createElement('a')
    link.href = storyCardUrl
    link.download = `${username || 'ootd'}-story-card.png`
    link.rel = 'noopener'
    link.click()
    setStoryCardSaved(true)

    if (!options?.quiet) {
      toast.success('Story card download started. Next, pick it from your Instagram gallery.')
    }

    return true
  }

  const openInstagramApp = () => {
    if (instagramFallbackTimeoutRef.current !== null) {
      window.clearTimeout(instagramFallbackTimeoutRef.current)
    }

    window.location.assign('instagram://camera')

    instagramFallbackTimeoutRef.current = window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        openInNewTab('https://www.instagram.com/')
      }
      instagramFallbackTimeoutRef.current = null
    }, Math.min(APP_LAUNCH_CHECK_DELAY_MS, APP_LAUNCH_TIMEOUT_MS))
  }

  const openInstagramStory = async () => {
    const storyLink = shareUrl.trim()

    if (!storyLink) {
      toast.error('Share link is still generating. Please try again in a moment.')
      return
    }

    if (!storyCardUrl) {
      toast.error('Story card is still preparing. Please wait a moment, then try again.')
      return
    }

    const copiedLink = await copyToClipboard({ quiet: true })
    const savedStoryCard = downloadStoryCard({ quiet: true })

    if (!copiedLink) {
      toast.error('Unable to copy the link automatically. Please use "Copy Link for Stories".')
    }

    openInstagramApp()
    toast.success(
      savedStoryCard
        ? 'Saved your full story card and opened Instagram. Create a Story, pick the saved image from your gallery, then paste the link sticker.'
        : 'Instagram opened. Pick the saved story card from your gallery, then paste the copied link sticker.'
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
      <DialogContent className="border-border bg-card max-h-[90svh] overflow-y-auto p-4 sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle>Share to Instagram Story 📲</DialogTitle>
          <DialogDescription>
            Save the ready-made story image, open Instagram, then paste your link sticker.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {loading || storyCardLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-[26px] border border-border/60 bg-background/60 shadow-lg">
                <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Full story image</p>
                    <p className="text-xs text-muted-foreground">
                      This is the saved background image users should pick from gallery.
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold text-primary">
                    {storyCardSaved ? 'Saved' : 'Ready'}
                  </span>
                </div>
                <div className="bg-gradient-to-br from-primary/15 via-accent/10 to-secondary/15 p-3">
                  {storyCardUrl ? (
                    <img
                      src={storyCardUrl}
                      alt="Generated Instagram Story card preview"
                      className="mx-auto w-full max-w-[230px] rounded-[24px] border border-white/10 object-cover shadow-2xl"
                    />
                  ) : (
                    <div className="flex aspect-[9/16] items-center justify-center rounded-[24px] border border-dashed border-border/60 bg-background/70 px-6 text-center text-sm text-muted-foreground">
                      Story image preview will appear here once the share link is ready.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border border-border/50 bg-background/50 p-4">
                <p className="text-sm font-semibold text-foreground">Follow the same 4 steps shown on the card</p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-3 rounded-xl bg-muted/25 p-3">
                    <Download className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p>Save the full story image first so your background and instructions stay together.</p>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-muted/25 p-3">
                    <Instagram className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p>
                      Open Instagram. If it does not land on Story automatically, tap the{' '}
                      <span className="font-medium text-foreground">plus button</span> and
                      choose the <span className="font-medium text-foreground">Story</span>{' '}
                      option.
                    </p>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-muted/25 p-3">
                    <Images className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p>Pick the saved image from your gallery or downloads so followers see the full background.</p>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-muted/25 p-3">
                    <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p>Paste the copied link into Instagram's Link sticker, then post your Story.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={openInstagramStory}
                  disabled={!shareUrl || !storyCardUrl}
                  className="h-auto min-h-11 w-full gap-2 whitespace-normal bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-500 py-3 text-sm font-semibold text-white hover:opacity-90"
                >
                  <Instagram className="w-4 h-4" />
                  Save card &amp; open Instagram
                </Button>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={() => downloadStoryCard()}
                    disabled={!storyCardUrl}
                    className="h-auto min-h-11 w-full gap-2 whitespace-normal bg-gradient-to-r from-primary to-accent py-3 text-sm font-semibold text-white hover:opacity-90"
                  >
                    <Download className="w-4 h-4" />
                    Save story image
                  </Button>

                  <Button
                    onClick={() => copyToClipboard()}
                    disabled={!shareUrl}
                    variant="outline"
                    className="h-auto min-h-11 w-full gap-2 whitespace-normal border-border py-3"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy link for sticker
                      </>
                    )}
                  </Button>
                </div>

                <Button
                  onClick={shareNative}
                  disabled={!shareUrl}
                  variant="outline"
                  className="h-auto min-h-11 w-full gap-2 whitespace-normal border-border py-3"
                >
                  <Share2 className="w-4 h-4" />
                  Share via…
                </Button>
              </div>

              {hasInstagramToken && mediaUrl && (
                <div className="space-y-2 pt-1 border-t border-border/30">
                  <p className="text-xs font-medium text-muted-foreground text-center">
                    Or post directly to Instagram
                  </p>
                  <Button
                    onClick={postToInstagram}
                    disabled={igPosting}
                    className="h-auto min-h-11 w-full whitespace-normal bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 py-3 text-white hover:opacity-90"
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
                    className="h-auto min-h-11 w-full whitespace-normal bg-blue-500 py-3 text-sm text-white hover:bg-blue-600"
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
                    className="h-auto min-h-11 w-full whitespace-normal bg-blue-700 py-3 text-sm text-white hover:bg-blue-800"
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
                    className="h-auto min-h-11 w-full whitespace-normal border-border py-3 text-sm"
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
