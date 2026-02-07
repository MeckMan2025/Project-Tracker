import { useState } from 'react'
import { useUser } from '../contexts/UserContext'

function LoginScreen() {
  const [nameInput, setNameInput] = useState('')
  const { login } = useUser()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!nameInput.trim()) return
    login(nameInput.trim())
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-80 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            Who is online?
          </h1>
          <p className="text-sm text-gray-500 mt-1">Enter your name to continue</p>
        </div>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Your name"
          className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pastel-blue focus:border-transparent text-center text-lg"
          autoFocus
        />
        <button
          type="submit"
          className="w-full py-3 bg-pastel-pink hover:bg-pastel-pink-dark rounded-xl font-semibold text-gray-700 transition-colors text-lg"
        >
          Join
        </button>
      </form>
    </div>
  )
}

export default LoginScreen
