'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SignInForm } from '@/components/auth/sign-in-form'
import { Sparkles } from 'lucide-react'

export default function SignInPage() {
  const [mounted, setMounted] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/feed')
      }
    }
    checkAuth()
  }, [supabase.auth, router])

  if (!mounted) return null

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-secondary via-primary to-accent flex-col justify-between p-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">OOTD</span>
        </Link>

        <div className="space-y-6 text-white">
          <h2 className="text-4xl font-bold">Welcome Back</h2>
          <p className="text-lg opacity-90">Rate outfits, discover trends, and connect with fashion enthusiasts.</p>
          
          <div className="space-y-3 pt-4">
            <div className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-1">✓</div>
              <p>Continue rating outfits</p>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-1">✓</div>
              <p>View your OOTD stats</p>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-1">✓</div>
              <p>Share with Instagram</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-6 sm:p-12">
        <div className="max-w-sm mx-auto w-full space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Sign In</h1>
            <p className="text-muted-foreground">Welcome back to the OOTD community</p>
          </div>

          <SignInForm />

          <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-primary hover:underline">
              Create one
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
