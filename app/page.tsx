import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sparkles, Share2, MessageCircle, Users } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-card/30">
      {/* Navigation */}
      <nav className="border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">OOTD</span>
          </div>
          <div className="flex gap-3">
            <Link href="/auth/signin">
              <Button variant="outline" className="border-border">Sign In</Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-20 space-y-8">
        <div className="text-center space-y-6">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-balance">
            Share Your <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">Style</span>, Get Real <span className="bg-gradient-to-r from-secondary via-primary to-accent bg-clip-text text-transparent">Feedback</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
            Upload your OOTD and get honest, anonymous ratings and comments from the community. Discover trending styles and express yourself freely.
          </p>

          <div className="flex gap-4 justify-center pt-4">
            <Link href="/auth/signup">
              <Button size="lg" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white text-primary-foreground">
                Start Rating Now
              </Button>
            </Link>
            <Link href="/feed">
              <Button size="lg" variant="outline" className="border-border hover:bg-card">
                Browse Feed
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 pt-12">
          <div className="p-6 rounded-xl border border-border/50 bg-card/50 backdrop-blur space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
              <Share2 className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold">Share Freely</h3>
            <p className="text-muted-foreground">Upload photos or videos of your outfits and share with the community instantly.</p>
          </div>

          <div className="p-6 rounded-xl border border-border/50 bg-card/50 backdrop-blur space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-black" />
            </div>
            <h3 className="text-lg font-semibold">Get Feedback</h3>
            <p className="text-muted-foreground">Receive ratings and comments from the community, anonymously or identified.</p>
          </div>

          <div className="p-6 rounded-xl border border-border/50 bg-card/50 backdrop-blur space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent to-accent/50 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold">Discover Trends</h3>
            <p className="text-muted-foreground">Explore random OOTDs from the community and find styling inspiration.</p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-20 p-8 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 backdrop-blur text-center space-y-4">
          <h2 className="text-3xl font-bold">Ready to showcase your style?</h2>
          <p className="text-muted-foreground max-w-md mx-auto">Join thousands of fashion enthusiasts sharing and rating outfits every day.</p>
          <Link href="/auth/signup">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Create Account
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
