import { useEffect, useRef } from 'react'
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
  const navTime = useRef(0)

  // Track when route changes
  useEffect(() => {
    navTime.current = Date.now()
  }, [location.pathname])

  // Block only the first click within 300ms of a route change
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (Date.now() - navTime.current < 300) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
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
