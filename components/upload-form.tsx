'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'media'

export function UploadForm() {
  const [files, setFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      // Limit to 5 files
      setFiles((prev) => [...prev, ...newFiles].slice(0, 5))
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file))
    setPreviewUrls(urls)

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [files])

  const cleanupUploads = async (paths: string[]) => {
    if (paths.length === 0) return

    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths)
    if (error) {
      console.error('Error cleaning up uploaded files:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (files.length === 0) {
      toast.error('Please select at least one image or video')
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('You must be logged in')
        return
      }

      // Create post
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          caption: caption || null,
          visibility,
          media_count: files.length,
        })
        .select()
        .single()

      if (postError) {
        toast.error('Failed to create post')
        return
      }

      // Upload media files
      const uploadedMedia = []
      const uploadedPaths: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileExt = file.name.split('.').pop() || 'bin'
        const fileName = `${user.id}/${post.id}/${Date.now()}-${i}.${fileExt}`
        let uploadedPath: string | null = null
        
        try {
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type,
            })

          if (uploadError) {
            throw uploadError
          }

          uploadedPath = uploadData.path

          const { data: publicUrlData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(uploadData.path)

          if (!publicUrlData.publicUrl) {
            throw new Error('No public URL returned from storage')
          }

          uploadedMedia.push({
            post_id: post.id,
            media_url: publicUrlData.publicUrl,
            media_type: file.type.startsWith('image') ? 'image' : 'video',
            order_index: i,
          })

          uploadedPaths.push(uploadedPath)
        } catch (error) {
          if (uploadedPath) {
            await cleanupUploads([uploadedPath])
          }
          console.error('Error uploading file:', error)
          toast.error(`Failed to upload file ${i + 1}`)
        }
      }

      if (uploadedMedia.length === 0) {
        await cleanupUploads(uploadedPaths)
        await supabase.from('posts').delete().eq('id', post.id)
        toast.error('Failed to upload media')
        return
      }

      // Insert media records
      const { error: mediaError } = await supabase
        .from('media')
        .insert(uploadedMedia)

      if (mediaError) {
        await cleanupUploads(uploadedPaths)
        await supabase.from('posts').delete().eq('id', post.id)
        toast.error('Failed to save media')
        return
      }

      toast.success('OOTD posted successfully!')
      router.push(`/post/${post.id}`)
      router.refresh()
    } catch (error) {
      console.error('Error:', error)
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {/* File Upload */}
      <Card className="border-2 border-dashed border-border/50 hover:border-primary/50 transition-colors">
        <label className="block p-8 cursor-pointer">
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileChange}
            disabled={loading}
            className="hidden"
          />
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Drop files here or click to select</p>
              <p className="text-sm text-muted-foreground">
                Images or videos (up to 5 files)
              </p>
            </div>
          </div>
        </label>
      </Card>

      {/* Preview */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Selected Files ({files.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {files.map((file, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
                  {file.type.startsWith('image') ? (
                    <Image src={previewUrls[index] || ''} alt={`Preview ${index}`} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-card text-muted-foreground">
                      <span className="text-xs">Video</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Caption */}
      <div className="space-y-2">
        <label htmlFor="caption" className="text-sm font-medium">
          Caption (Optional)
        </label>
        <Textarea
          id="caption"
          placeholder="Describe your OOTD..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={500}
          className="bg-input border-border"
          rows={4}
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground text-right">
          {caption.length}/500
        </p>
      </div>

      {/* Visibility */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Visibility</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="visibility"
              value="public"
              checked={visibility === 'public'}
              onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
              disabled={loading}
              className="w-4 h-4"
            />
            <span className="text-sm">Public</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="visibility"
              value="private"
              checked={visibility === 'private'}
              onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
              disabled={loading}
              className="w-4 h-4"
            />
            <span className="text-sm">Private</span>
          </label>
        </div>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={loading || files.length === 0}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-base h-12"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Posting...
          </>
        ) : (
          'Post OOTD'
        )}
      </Button>
    </form>
  )
}
