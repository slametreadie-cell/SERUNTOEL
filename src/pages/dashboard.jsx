import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Dashboard from '../components/Dashboard'
import { useAuth } from '../components/AuthProvider'

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Memuat...</p>
      </div>
    )
  }

  return <Dashboard />
}
