'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Star, MessageCircle, Share2 } from 'lucide-react'
import { RatingDialog } from './rating-dialog'
import { ShareModal } from './share-modal'

interface OOTDCardProps {
  id: string
  mediaUrl: string
  caption?: string
  username: string
  ratingCount: number
  averageRating: number
  commentCount: number
  mediaType?: string
  isOwner?: boolean
}

export function OOTDCard({
  id,
  mediaUrl,
  caption,
  username,
  ratingCount,
  averageRating,
  commentCount,
  mediaType,
  isOwner = false,
}: OOTDCardProps) {
  const [showRatingDialog, setShowRatingDialog] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)

  return (
    <>
      <Card className="overflow-hidden bg-card border-border/50 hover:border-primary/50 transition-all">
        {/* Media */}
        <div className="aspect-square bg-muted relative overflow-hidden group">
          <Image
            src={mediaUrl}
            alt="OOTD"
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Caption and User */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">@{username}</p>
            {caption && (
              <p className="text-sm line-clamp-2">{caption}</p>
            )}
          </div>

          {/* Rating Stats */}
          <div className="flex items-center gap-4 py-2 border-t border-b border-border/50">
            <div className="flex items-center gap-1 text-sm">
              <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
              <span className="font-medium">{averageRating.toFixed(1)}</span>
              <span className="text-muted-foreground">({ratingCount})</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MessageCircle className="w-4 h-4" />
              <span>{commentCount}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {isOwner ? (
              <Button
                onClick={() => setShowShareModal(true)}
                variant="outline"
                size="sm"
                className="ml-auto border-border"
                aria-label="Share post"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={() => setShowRatingDialog(true)}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-sm"
              >
                Rate & Comment
              </Button>
            )}
          </div>
        </div>
      </Card>

      {!isOwner && (
        <RatingDialog
          open={showRatingDialog}
          onOpenChange={setShowRatingDialog}
          postId={id}
        />
      )}

      {isOwner && (
        <ShareModal
          open={showShareModal}
          onOpenChange={setShowShareModal}
          postId={id}
          username={username}
          mediaUrl={mediaUrl}
          mediaType={mediaType}
          caption={caption}
        />
      )}
    </>
  )
}
