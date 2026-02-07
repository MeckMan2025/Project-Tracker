import { useState } from 'react'
import { useUser } from '../contexts/UserContext'

function LoginScreen() {
  const { login, signup, checkWhitelist, resetPassword } = useUser()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signupStep, setSignupStep] = useState(1)
  const [whitelistRole, setWhitelistRole] = useState(null)
  const [rejected, setRejected] = useState(false)
  const [forgotPassword, setForgotPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const resetSignupState = () => {
    setSignupStep(1)
    setRejected(false)
    setWhitelistRole(null)
    setError('')
    setPassword('')
    setDisplayName('')
  }

  const handleCheckEmail = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const result = await checkWhitelist(email)
      if (result) {
        setWhitelistRole(result.role)
        setSignupStep(2)
        setRejected(false)
      } else {
        setRejected(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

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
        await signup(email, password, displayName.trim(), whitelistRole)
      } else {
        await login(email, password)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const wrapper = 'min-h-screen bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30 flex items-center justify-center'
  const card = 'bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-80 space-y-5'
  const input = 'w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pastel-blue focus:border-transparent text-center text-lg'
  const btn = 'w-full py-3 bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-50 rounded-xl font-semibold text-gray-700 transition-colors text-lg'
  const heading = 'text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent'

  // Rejection screen
  if (mode === 'signup' && rejected) {
    return (
      <div className={wrapper}>
        <div className={`${card} text-center`}>
          <h1 className={heading}>Not on the Whitelist</h1>
          <p className="text-sm text-gray-600">
            Sorry, your email is not on the whitelist. This app is for robotics team members, mentors, and coaches only.
          </p>
          <p className="text-sm text-gray-600">
            Please talk to a team lead to have your email added.
          </p>
          <button
            type="button"
            onClick={() => { setMode('signin'); resetSignupState(); setEmail('') }}
            className={btn}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  // Signup step 1: email check
  if (mode === 'signup' && signupStep === 1) {
    return (
      <div className={wrapper}>
        <form onSubmit={handleCheckEmail} className={card}>
          <div className="text-center">
            <h1 className={heading}>Create Account</h1>
            <p className="text-sm text-gray-500 mt-1">Enter your email to get started</p>
          </div>

          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError('') }}
            placeholder="Email"
            className={input}
            autoFocus
            required
          />

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button type="submit" disabled={submitting} className={btn}>
            {submitting ? 'Checking...' : 'Continue'}
          </button>

          <p className="text-sm text-center text-gray-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => { setMode('signin'); resetSignupState() }}
              className="text-pastel-pink-dark font-semibold hover:underline"
            >
              Sign In
            </button>
          </p>
        </form>
      </div>
    )
  }

  // Signup step 2: display name + password
  if (mode === 'signup' && signupStep === 2) {
    return (
      <div className={wrapper}>
        <form onSubmit={handleSubmit} className={card}>
          <div className="text-center">
            <h1 className={heading}>Welcome!</h1>
            <p className="text-sm text-gray-500 mt-1">Create your account</p>
          </div>

          <div className="text-center text-sm text-gray-500">
            <span className="font-medium text-gray-700">{email}</span>
            <span className="ml-1 text-green-500">&#10003;</span>
          </div>

          <input
            type="text"
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); setError('') }}
            placeholder="Display name"
            className={input}
            autoFocus
          />

          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            placeholder="Password"
            className={input}
          />

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button type="submit" disabled={submitting} className={btn}>
            {submitting ? 'Creating account...' : 'Sign Up'}
          </button>

          <p className="text-sm text-center text-gray-500">
            <button
              type="button"
              onClick={() => { setSignupStep(1); setPassword(''); setDisplayName(''); setError('') }}
              className="text-pastel-pink-dark font-semibold hover:underline"
            >
              Back
            </button>
          </p>
        </form>
      </div>
    )
  }

  // Forgot password screen
  if (forgotPassword) {
    if (resetSent) {
      return (
        <div className={wrapper}>
          <div className={`${card} text-center`}>
            <h1 className={heading}>Check Your Email</h1>
            <p className="text-sm text-gray-600">
              We sent a password reset link to <span className="font-medium text-gray-700">{email}</span>.
            </p>
            <p className="text-sm text-gray-600">
              Check your inbox and follow the link to reset your password.
            </p>
            <button
              type="button"
              onClick={() => { setForgotPassword(false); setResetSent(false); setError('') }}
              className={btn}
            >
              Back to Sign In
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className={wrapper}>
        <form onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          setSubmitting(true)
          try {
            await resetPassword(email)
            setResetSent(true)
          } catch (err) {
            setError(err.message)
          } finally {
            setSubmitting(false)
          }
        }} className={card}>
          <div className="text-center">
            <h1 className={heading}>Reset Password</h1>
            <p className="text-sm text-gray-500 mt-1">Enter your email to receive a reset link</p>
          </div>

          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError('') }}
            placeholder="Email"
            className={input}
            autoFocus
            required
          />

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button type="submit" disabled={submitting} className={btn}>
            {submitting ? 'Sending...' : 'Send Reset Link'}
          </button>

          <p className="text-sm text-center text-gray-500">
            <button
              type="button"
              onClick={() => { setForgotPassword(false); setError('') }}
              className="text-pastel-pink-dark font-semibold hover:underline"
            >
              Back to Sign In
            </button>
          </p>
        </form>
      </div>
    )
  }

  // Sign-in form
  return (
    <div className={wrapper}>
      <form onSubmit={handleSubmit} className={card}>
        <div className="text-center">
          <h1 className={heading}>Sign In</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back</p>
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError('') }}
          placeholder="Email"
          className={input}
          autoFocus
        />

        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError('') }}
          placeholder="Password"
          className={input}
        />

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <button type="submit" disabled={submitting} className={btn}>
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>

        <p className="text-sm text-center text-gray-500">
          <button
            type="button"
            onClick={() => { setForgotPassword(true); setError('') }}
            className="text-pastel-pink-dark font-semibold hover:underline"
          >
            Forgot password?
          </button>
        </p>

        <p className="text-sm text-center text-gray-500">
          No account?{' '}
          <button
            type="button"
            onClick={() => { setMode('signup'); resetSignupState() }}
            className="text-pastel-pink-dark font-semibold hover:underline"
          >
            Sign Up
          </button>
        </p>
      </form>
    </div>
  )
}

export default LoginScreen
