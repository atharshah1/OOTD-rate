'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, LogOut, Edit2, Plus, Star, ExternalLink, Send } from 'lucide-react'
import { OOTDCard } from '@/components/ootd-card'
import { toast } from 'sonner'
import Image from 'next/image'

interface UserProfile {
  id: string
  username: string
  email: string
  avatar_url?: string
  bio?: string
}

interface Post {
  id: string
  user_id: string
  caption: string
  created_at: string
  users: {
    username: string
  }
  media: Array<{
    media_url: string
  }>
  ratings: Array<{
    rating: number
  }>
}

interface InboxRating {
  id: string
  rating: number
  comment: string | null
  reply: string | null
  is_anonymous: boolean
  created_at: string
  posts: {
    id: string
    caption: string | null
    media: Array<{ media_url: string }>
  }
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [inbox, setInbox] = useState<InboxRating[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editedUsername, setEditedUsername] = useState('')
  const [editedBio, setEditedBio] = useState('')
  const [mounted, setMounted] = useState(false)
  // keyed by ratingId → reply draft text
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [savingReply, setSavingReply] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/signin')
        return
      }

      fetchProfile(session.user.id)
      fetchUserPosts(session.user.id)
      fetchInbox(session.user.id)
    }

    checkAuth()
  }, [mounted, supabase.auth, router])

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select()
        .eq('id', userId)
        .single()

      if (error && error.code === 'PGRST116') {
        const { data: { user } } = await supabase.auth.getUser()
        const newProfile = {
          id: userId,
          email: user?.email || '',
          username: user?.email?.split('@')[0] || 'user',
          avatar_url: null,
          bio: null,
        }
        setUser(newProfile)
        setEditedUsername(newProfile.username)
        setEditedBio(newProfile.bio || '')
      } else if (data) {
        setUser(data)
        setEditedUsername(data.username)
        setEditedBio(data.bio || '')
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const fetchUserPosts = async (userId: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          caption,
          created_at,
          users:user_id(username),
          media(media_url),
          ratings(rating)
        `)
        .eq('user_id', userId)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching posts:', error)
        return
      }

      setPosts(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchInbox = async (userId: string) => {
    try {
      // Get all ratings for all of the user's posts
      const { data, error } = await supabase
        .from('ratings')
        .select(`
          id,
          rating,
          comment,
          reply,
          is_anonymous,
          created_at,
          posts:post_id(id, caption, media(media_url))
        `)
        .order('created_at', { ascending: false })
        // Filter to only ratings on the current user's posts
        .filter('posts.user_id', 'eq', userId)

      if (error) {
        console.error('Error fetching inbox:', error)
        return
      }

      // Extra client-side filter since Supabase doesn't allow filtering on joined tables in all versions
      const myPostIds = (posts.length > 0 ? posts : await getMyPostIds(userId)).map(
        (p: { id: string }) => p.id
      )
      const filtered = (data || []).filter((r: any) => {
        const postId = r.posts?.id
        return postId && myPostIds.includes(postId)
      })

      setInbox(filtered as InboxRating[])

      // Initialise reply drafts with existing replies
      const drafts: Record<string, string> = {}
      filtered.forEach((r: any) => {
        drafts[r.id] = r.reply ?? ''
      })
      setReplyDrafts(drafts)
    } catch (error) {
      console.error('Error fetching inbox:', error)
    }
  }

  const getMyPostIds = async (userId: string) => {
    const { data } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', userId)
    return data || []
  }

  // Re-fetch inbox once posts are loaded (we need post IDs for filtering)
  useEffect(() => {
    if (posts.length > 0 && user) {
      fetchInbox(user.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts])

  const handleUpdateProfile = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const { error } = await supabase
        .from('users')
        .upsert({
          id: authUser.id,
          email: authUser.email || '',
          username: editedUsername,
          bio: editedBio,
        })

      if (error) {
        toast.error('Failed to update profile')
      } else {
        toast.success('Profile updated!')
        setEditing(false)
        setUser({
          ...user!,
          username: editedUsername,
          bio: editedBio,
        })
      }
    } catch (error) {
      toast.error('An error occurred')
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/')
    } catch (error) {
      toast.error('Failed to sign out')
    }
  }

  const handleSaveReply = async (ratingId: string) => {
    const replyText = (replyDrafts[ratingId] ?? '').trim()
    setSavingReply(ratingId)
    try {
      const { error } = await supabase
        .from('ratings')
        .update({ reply: replyText || null })
        .eq('id', ratingId)

      if (error) {
        toast.error('Failed to save reply')
      } else {
        toast.success('Reply saved!')
        setInbox((prev) =>
          prev.map((r) =>
            r.id === ratingId ? { ...r, reply: replyText || null } : r
          )
        )
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setSavingReply(null)
    }
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const newRatingsCount = inbox.filter((r) => !r.reply).length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/feed" className="text-2xl font-bold">OOTD</Link>
          <Button
            variant="outline"
            className="border-border"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Profile Section */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Profile Card */}
        <Card className="p-8 bg-card border-border/50 mb-12">
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary via-accent to-secondary flex-shrink-0 flex items-center justify-center text-white text-3xl font-bold">
              {editedUsername?.[0]?.toUpperCase()}
            </div>

            {/* Profile Info */}
            <div className="flex-1 space-y-4 w-full">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Username</label>
                    <Input
                      value={editedUsername}
                      onChange={(e) => setEditedUsername(e.target.value)}
                      className="bg-input border-border mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Bio</label>
                    <Input
                      value={editedBio}
                      onChange={(e) => setEditedBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      className="bg-input border-border mt-1"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleUpdateProfile}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      className="border-border"
                      onClick={() => setEditing(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h1 className="text-3xl font-bold">@{user?.username}</h1>
                    <p className="text-muted-foreground text-sm">{user?.email}</p>
                  </div>
                  {user?.bio && (
                    <p className="text-muted-foreground">{user.bio}</p>
                  )}
                  <Button
                    variant="outline"
                    className="border-border"
                    onClick={() => setEditing(true)}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          <Card className="p-4 bg-card border-border/50 text-center">
            <p className="text-2xl font-bold text-primary">{posts.length}</p>
            <p className="text-sm text-muted-foreground">OOTDs</p>
          </Card>
          <Card className="p-4 bg-card border-border/50 text-center">
            <p className="text-2xl font-bold text-secondary">
              {posts.reduce((sum, post) => sum + post.ratings.length, 0)}
            </p>
            <p className="text-sm text-muted-foreground">Ratings</p>
          </Card>
          <Card className="p-4 bg-card border-border/50 text-center">
            <p className="text-2xl font-bold text-accent">
              {posts.length > 0
                ? (
                    posts.reduce(
                      (sum, post) =>
                        sum +
                        (post.ratings.length > 0
                          ? post.ratings.reduce((s, r) => s + r.rating, 0) /
                            post.ratings.length
                          : 0),
                      0
                    ) / posts.length
                  ).toFixed(1)
                : '0'}
            </p>
            <p className="text-sm text-muted-foreground">Avg Rating</p>
          </Card>
        </div>

        {/* Tabs: My OOTDs | Ratings Inbox */}
        <Tabs defaultValue="ootds" className="space-y-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="ootds" className="flex-1 sm:flex-none px-6">
              My OOTDs
            </TabsTrigger>
            <TabsTrigger value="inbox" className="flex-1 sm:flex-none px-6 relative">
              Ratings Inbox
              {newRatingsCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-xs font-bold">
                  {newRatingsCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* My OOTDs tab */}
          <TabsContent value="ootds" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Your OOTDs</h2>
              <Link href="/upload">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                  <Plus className="w-4 h-4" />
                  New OOTD
                </Button>
              </Link>
            </div>

            {posts.length === 0 ? (
              <Card className="p-12 text-center bg-card border-border/50">
                <p className="text-muted-foreground mb-4">No OOTDs yet</p>
                <Link href="/upload">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Share Your First OOTD
                  </Button>
                </Link>
              </Card>
            ) : (
              <div className="space-y-6">
                {posts.map((post) => (
                  <OOTDCard
                    key={post.id}
                    id={post.id}
                    mediaUrl={post.media?.[0]?.media_url || '/placeholder.jpg'}
                    caption={post.caption}
                    username={post.users?.username || 'Anonymous'}
                    ratingCount={post.ratings.length}
                    averageRating={
                      post.ratings.length > 0
                        ? post.ratings.reduce((sum, r) => sum + r.rating, 0) /
                          post.ratings.length
                        : 0
                    }
                    commentCount={0}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Ratings Inbox tab */}
          <TabsContent value="inbox" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Ratings Inbox</h2>
              <p className="text-sm text-muted-foreground">
                {inbox.length} rating{inbox.length !== 1 ? 's' : ''} received
              </p>
            </div>

            {inbox.length === 0 ? (
              <Card className="p-12 text-center bg-card border-border/50 space-y-4">
                <p className="text-muted-foreground">No ratings yet</p>
                <p className="text-sm text-muted-foreground">
                  Share your OOTD link to your Instagram Story to start getting
                  anonymous ratings!
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {inbox.map((item) => (
                  <InboxCard
                    key={item.id}
                    item={item}
                    replyDraft={replyDrafts[item.id] ?? item.reply ?? ''}
                    onReplyChange={(text) =>
                      setReplyDrafts((prev) => ({ ...prev, [item.id]: text }))
                    }
                    onSaveReply={() => handleSaveReply(item.id)}
                    savingReply={savingReply === item.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

// ─── Inbox card sub-component ───────────────────────────────────────────────

interface InboxCardProps {
  item: InboxRating
  replyDraft: string
  onReplyChange: (text: string) => void
  onSaveReply: () => void
  savingReply: boolean
}

function InboxCard({
  item,
  replyDraft,
  onReplyChange,
  onSaveReply,
  savingReply,
}: InboxCardProps) {
  const [showReply, setShowReply] = useState(false)

  return (
    <Card className="p-4 bg-card border-border/50 space-y-3">
      <div className="flex gap-3">
        {/* Post thumbnail */}
        {item.posts?.media?.[0]?.media_url && (
          <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 relative">
            <Image
              src={item.posts.media[0].media_url}
              alt="Post"
              fill
              className="object-cover"
            />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1">
          {/* Stars */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= item.rating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-muted-foreground/30'
                }`}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-1">
              {new Date(item.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Comment */}
          {item.comment && (
            <p className="text-sm leading-relaxed">&ldquo;{item.comment}&rdquo;</p>
          )}
          {!item.comment && (
            <p className="text-xs text-muted-foreground italic">
              No comment — just a rating
            </p>
          )}

          {/* Existing reply */}
          {item.reply && !showReply && (
            <div className="mt-1 pl-3 border-l-2 border-primary/50">
              <p className="text-xs text-muted-foreground">Your reply:</p>
              <p className="text-sm">{item.reply}</p>
            </div>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="flex gap-2 flex-wrap pt-1">
        <Button
          size="sm"
          variant="outline"
          className="border-border text-xs gap-1"
          onClick={() => setShowReply((v) => !v)}
        >
          <Send className="w-3 h-3" />
          {item.reply ? 'Edit Reply' : 'Reply'}
        </Button>

        <Link href={`/story/${item.id}`} target="_blank">
          <Button
            size="sm"
            className="bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:opacity-90 text-white text-xs gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Share to Story
          </Button>
        </Link>
      </div>

      {/* Reply textarea (toggle) */}
      {showReply && (
        <div className="space-y-2 pt-1">
          <Textarea
            placeholder="Write a reply..."
            value={replyDraft}
            onChange={(e) => onReplyChange(e.target.value)}
            maxLength={300}
            rows={2}
            className="bg-input border-border resize-none text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={savingReply}
              onClick={onSaveReply}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {savingReply ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                'Save Reply'
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowReply(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

