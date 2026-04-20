'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, LogOut, Edit2, Plus } from 'lucide-react'
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

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editedUsername, setEditedUsername] = useState('')
  const [editedBio, setEditedBio] = useState('')
  const [mounted, setMounted] = useState(false)
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
        // User doesn't exist yet, create profile
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

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

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

        {/* Posts Section */}
        <div className="space-y-6">
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
        </div>
      </main>
    </div>
  )
}
