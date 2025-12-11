// app/layout.tsx - Root layout with metadata and fonts
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
})

export const metadata: Metadata = {
  title: 'Vercel Edge JSON API',
  description: 'High-performance JSON API built on Vercel Edge Runtime with global sub-50ms response times, advanced caching, and real-time monitoring.',
  keywords: [
    'JSON API',
    'Vercel Edge',
    'High Performance',
    'Serverless',
    'Edge Runtime',
    'Global CDN',
    'Real-time'
  ],
  authors: [{ name: 'Your Name' }],
  creator: 'Your Name',
  publisher: 'Vercel Edge JSON API',
  openGraph: {
    title: 'Vercel Edge JSON API',
    description: 'High-performance JSON API with sub-50ms global response times',
    url: 'https://your-project.vercel.app',
    siteName: 'Vercel Edge JSON API',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Vercel Edge JSON API'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vercel Edge JSON API',
    description: 'High-performance JSON API with sub-50ms global response times',
    images: ['/og-image.png']
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' }
  ]
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        <div id="root">
          {children}
        </div>
        
        {/* Analytics and monitoring */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Performance monitoring
              if (typeof window !== 'undefined') {
                window.addEventListener('load', function() {
                  // Log page load performance
                  const navTiming = performance.getEntriesByType('navigation')[0];
                  if (navTiming) {
                    console.log('Page Load Time:', Math.round(navTiming.loadEventEnd - navTiming.fetchStart) + 'ms');
                  }
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}