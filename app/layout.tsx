import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'YT Converter',
  description: 'Convert YouTube videos to MP3 or MP4',
  generator: 'Next.js',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.png" />
      </head>
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  )
}
