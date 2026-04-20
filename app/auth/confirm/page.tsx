'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function ConfirmEmailPage() {
  const searchParams = useSearchParams()
  const nextPathRaw = searchParams.get('next') || '/upload'
  const nextPath = nextPathRaw.startsWith('/') ? nextPathRaw : '/upload'

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Confirm your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent you a verification link. After confirming, sign in to create your first OOTD and start getting ratings.
          </p>
        </div>

        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href={`/auth/signin?next=${encodeURIComponent(nextPath)}`}>
              Sign in and create your OOTD
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/feed">Browse ratings first</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
