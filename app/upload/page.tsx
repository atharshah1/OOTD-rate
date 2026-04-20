'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UploadForm } from '@/components/upload-form'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function UploadPage() {
  const [mounted, setMounted] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/signin')
      }
    }
    checkAuth()
  }, [supabase.auth, router])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/feed" className="text-2xl font-bold">OOTD</Link>
          <h1 className="text-lg font-semibold">Share Your OOTD</h1>
          <div className="w-12" /> {/* Spacer */}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="space-y-8">
          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-bold">Upload Your Outfit</h2>
            <p className="text-muted-foreground">
              Share your OOTD and let the community rate your style
            </p>
          </div>

          <UploadForm />
        </div>
      </main>
    </div>
  )
}
