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

  const copyLink = () => {
    navigator.clipboard.writeText(absoluteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Link copied! Paste it as a link sticker on your Story.')
  }

  const shareNative = () => {
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
    <div className="flex gap-2 mt-4">
      <Button
        onClick={copyLink}
        className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white gap-2"
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
        className="flex-1 border-border gap-2"
      >
        <Share2 className="w-4 h-4" />
        Share
      </Button>
    </div>
  )
}
