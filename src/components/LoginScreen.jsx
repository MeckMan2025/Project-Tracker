import { useState } from 'react'
import { useUser } from '../contexts/UserContext'

function LoginScreen() {
  const { login, signup } = useUser()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      if (mode === 'signup') {
        if (!displayName.trim()) {
          setError('Display name is required')
          setSubmitting(false)
          return
        }
        await signup(email, password, displayName.trim())
      } else {
        await login(email, password)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-80 space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'signin' ? 'Welcome back' : 'Join the team'}
          </p>
        </div>

        {mode === 'signup' && (
          <input
            type="text"
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); setError('') }}
            placeholder="Display name"
            className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pastel-blue focus:border-transparent text-center text-lg"
            autoFocus
          />
        )}

        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError('') }}
          placeholder="Email"
          className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pastel-blue focus:border-transparent text-center text-lg"
          autoFocus={mode === 'signin'}
        />

        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError('') }}
          placeholder="Password"
          className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pastel-blue focus:border-transparent text-center text-lg"
        />

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-50 rounded-xl font-semibold text-gray-700 transition-colors text-lg"
        >
          {submitting
            ? (mode === 'signin' ? 'Signing in...' : 'Creating account...')
            : (mode === 'signin' ? 'Sign In' : 'Sign Up')}
        </button>

        <p className="text-sm text-center text-gray-500">
          {mode === 'signin' ? (
            <>
              No account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); setError('') }}
                className="text-pastel-pink-dark font-semibold hover:underline"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signin'); setError('') }}
                className="text-pastel-pink-dark font-semibold hover:underline"
              >
                Sign In
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  )
}

export default LoginScreen
