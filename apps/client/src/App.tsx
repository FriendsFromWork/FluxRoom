import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { Toaster } from '@/components/ui/sonner'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'

const Home = lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })))
const Setup = lazy(() => import('@/pages/Setup').then((m) => ({ default: m.Setup })))
const Room = lazy(() => import('@/pages/Room').then((m) => ({ default: m.Room })))

function App() {
  const resolvedTheme = useResolvedTheme()

  return (
    <MotionConfig reducedMotion="user">
      <Suspense fallback={<div className="min-h-svh bg-background" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/r/:roomId" element={<Room />} />
        </Routes>
      </Suspense>
      <Toaster richColors position="top-center" theme={resolvedTheme} />
    </MotionConfig>
  )
}

export default App
