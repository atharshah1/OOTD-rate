'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, Share2 } from 'lucide-react'
import { toast } from 'sonner'

interface StoryCardActionsProps {
  shareUrl: string
  username: string
}

export function StoryCardActions({ shareUrl, username }: StoryCardActionsProps) {
  const [copied, setCopied] = useState(false)

  const absoluteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${shareUrl}`
      : shareUrl

  const copyLink = async () => {
    if (!absoluteUrl) return
    try {
      await navigator.clipboard.writeText(absoluteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Link copied! Paste it as a link sticker on your Story.')
    } catch {
      toast.error('Unable to copy link. Please copy it manually.')
    }
  }

  const shareNative = () => {
    if (!absoluteUrl) return
    if (navigator.share) {
      navigator
        .share({
          title: `Rate @${username}'s OOTD`,
          text: 'Rate my outfit anonymously 👗',
          url: absoluteUrl,
        })
        .catch(() => {
          // User cancelled — no-op
        })
    } else {
      copyLink()
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <Button
        onClick={copyLink}
        className="w-full flex-1 gap-2 whitespace-normal bg-gradient-to-r from-primary to-accent text-white hover:opacity-90"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy link
          </>
        )}
      </Button>
      <Button
        onClick={shareNative}
        variant="outline"
        className="w-full flex-1 gap-2 whitespace-normal border-border"
      >
        <Share2 className="w-4 h-4" />
        Share
      </Button>
    </div>
  )
}
