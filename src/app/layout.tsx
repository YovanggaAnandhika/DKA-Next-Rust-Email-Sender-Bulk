import './globals.css'

export const metadata = {
  title: 'DKA Email Sender AI Automatically Tools',
  description: 'Send emails with attachments',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
