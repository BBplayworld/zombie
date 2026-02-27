import type { Metadata } from 'next'
import { Cinzel_Decorative } from 'next/font/google'
import './globals.css'

const cinzelDecorative = Cinzel_Decorative({
    subsets: ['latin'],
    weight: ['400', '700'],
    display: 'swap',
})

export const metadata: Metadata = {
    title: '🧟 MMORPG',
    description: 'Canvas-based Quarter-view Zombie MMORPG Open World Game',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ko">
            <body className={cinzelDecorative.className}>{children}</body>
        </html>
    )
}
