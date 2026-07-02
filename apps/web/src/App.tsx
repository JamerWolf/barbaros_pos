import { BrowserRouter, Route, Routes } from 'react-router-dom'
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

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <SocketInitializer />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/accounts/:id" element={<AccountDetailPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
