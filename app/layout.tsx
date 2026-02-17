import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: '🧟 Zombie MMORPG',
    description: 'Canvas-based Quarter-view Zombie MMORPG Open World Game',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    )
}
