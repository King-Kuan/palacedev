import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PalaceDev — AI Coding Studio',
  description: 'AI-powered IDE that generates full codebases from natural language. Built by The Palace, Inc.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
