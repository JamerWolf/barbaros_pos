import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { useAccountSockets } from './hooks/useAccountSockets.js'
import { DashboardPage } from './pages/DashboardPage.js'
import { AccountDetailPage } from './pages/AccountDetailPage.js'

function SocketInitializer(): JSX.Element | null {
  useAccountSockets()
  return null
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <SocketInitializer />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/accounts/:id" element={<AccountDetailPage />} />
      </Routes>
    </BrowserRouter>
  )
}
