import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.js'
import './index.css'

const rootElement = document.getElementById('root')

if (rootElement == null) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      console.info('Service worker registered:', registration.scope)
    })
    .catch((error) => {
      console.warn('Service worker registration failed:', error)
    })
}
