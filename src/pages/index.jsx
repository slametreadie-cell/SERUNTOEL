import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../components/AuthProvider'

export default function Home() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/dashboard' : '/login')
    }
  }, [user, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Memuat...</p>
    </div>
  )
}
