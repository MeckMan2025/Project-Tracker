// LOCAL DEV HARNESS. Stands in for the main app's shell (sidebar, real
// accounts) so SwotView can be tested on its own. Do not merge this file;
// in the main app SwotView is rendered from src/App.jsx like DesignMatrix.
import { useState } from 'react'
import { LogOut, Lock } from 'lucide-react'
import { useUser, DEV_ROLES } from './contexts/UserContext'
import SwotView from './components/SwotView'

const wrapper = 'min-h-screen bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30'

// Local testing gate only: it runs in the browser, so it keeps honest testers
// out of the lead view but is not real security. Override with
// VITE_LEAD_PASSWORD in .env.local.
const LEAD_PASSWORD = import.meta.env.VITE_LEAD_PASSWORD || 'scrumlead'

const inputClass = 'w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pastel-blue focus:border-transparent focus:outline-none text-center text-lg'

const ROLE_BUTTONS = {
  lead: 'bg-pastel-pink hover:bg-pastel-pink-dark',
  teammate: 'bg-pastel-blue hover:bg-pastel-blue-dark',
  guest: 'bg-pastel-orange hover:bg-pastel-orange-dark',
}

function DevSignIn() {
  const { login } = useUser()
  const [name, setName] = useState('')
  const [askingPassword, setAskingPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const choose = (key) => {
    if (key === 'lead') {
      setAskingPassword(true)
      return
    }
    login(name.trim(), key)
  }

  const submitPassword = (e) => {
    e.preventDefault()
    if (password === LEAD_PASSWORD) {
      login(name.trim(), 'lead')
    } else {
      setError('Incorrect password')
      setPassword('')
    }
  }

  const cancelPassword = () => {
    setAskingPassword(false)
    setPassword('')
    setError('')
  }

  return (
    <div className={`${wrapper} flex items-center justify-center p-4`}>
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-80 space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            SWOT Analysis
          </h1>
          <p className="text-sm text-gray-500 mt-1">Local test sign-in</p>
        </div>
        {askingPassword ? (
          <form onSubmit={submitPassword} className="space-y-3">
            <p className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <Lock size={14} /> Lead password
            </p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              placeholder="Password"
              className={inputClass}
            />
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <button
              type="submit"
              disabled={!password}
              className={`w-full py-3 ${ROLE_BUTTONS.lead} disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-gray-700 transition-colors`}
            >
              Sign in as Lead
            </button>
            <button
              type="button"
              onClick={cancelPassword}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Back
            </button>
          </form>
        ) : (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className={inputClass}
            />
            <div className="space-y-2">
              {Object.entries(DEV_ROLES).map(([key, role]) => (
                <button
                  key={key}
                  disabled={!name.trim()}
                  onClick={() => choose(key)}
                  className={`w-full py-3 ${ROLE_BUTTONS[key]} disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-gray-700 transition-colors`}
                >
                  Continue as {role.label}
                </button>
              ))}
            </div>
          </>
        )}
        <p className="text-xs text-gray-400 text-center">
          Testing only. In the main app your account role decides this.
        </p>
      </div>
    </div>
  )
}

function App() {
  const { username, devRole, logout } = useUser()

  if (!username) return <DevSignIn />

  return (
    <div className={`${wrapper} flex flex-col`}>
      <SwotView />
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-dashed border-amber-400 rounded-full shadow-md pl-3 pr-1 py-1 text-xs text-gray-600">
        <span className="font-bold text-amber-600">DEV</span>
        <span>{username} · {DEV_ROLES[devRole].label}</span>
        <button
          onClick={logout}
          className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
        >
          <LogOut size={12} /> Switch
        </button>
      </div>
    </div>
  )
}

export default App
