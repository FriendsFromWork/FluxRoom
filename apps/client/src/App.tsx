import { Routes, Route } from 'react-router-dom'
import { Home } from '@/pages/Home'
import { Setup } from '@/pages/Setup'
import { Room } from '@/pages/Room'
import { Toaster } from '@/components/ui/sonner'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'

function App() {
  const resolvedTheme = useResolvedTheme()

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/r/:roomId" element={<Room />} />
      </Routes>
      <Toaster richColors position="top-center" theme={resolvedTheme} />
    </>
  )
}

export default App
