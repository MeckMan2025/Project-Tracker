import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { UserProvider } from './contexts/UserContext'
import { ToastProvider } from './components/ToastProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <UserProvider>
        <App />
      </UserProvider>
    </ToastProvider>
  </React.StrictMode>,
)

// Register service worker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('SW registration failed:', err)
    })
  })
}
