import './globals.css'

export const metadata = { title: 'KOPERLIN — Sistem Informasi Koperasi' }

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
