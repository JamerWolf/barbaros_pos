import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useAccountSockets } from './hooks/useAccountSockets.js'
import { useShapeSockets } from './hooks/useShapeSockets.js'
import { DashboardPage } from './pages/DashboardPage.js'
import { AccountDetailPage } from './pages/AccountDetailPage.js'
import { ReportsPage } from './pages/ReportsPage.js'

function SocketInitializer(): JSX.Element | null {
  useAccountSockets()
  useShapeSockets()
  return null
}

/** Blocks ghost clicks after navigation on mobile */
function TouchGuard(): JSX.Element | null {
  const location = useLocation()

  useEffect(() => {
    let lastTouchEnd = 0

    const onTouchEnd = (e: TouchEvent) => {
      lastTouchEnd = Date.now()
    }

    const onClick = (e: MouseEvent) => {
      // If a touch happened less than 400ms ago, it's a ghost click
      if (Date.now() - lastTouchEnd < 400) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener('touchend', onTouchEnd, true)
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('touchend', onTouchEnd, true)
      document.removeEventListener('click', onClick, true)
    }
  }, [location.pathname])

  return null
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <SocketInitializer />
      <TouchGuard />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/accounts/:id" element={<AccountDetailPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
