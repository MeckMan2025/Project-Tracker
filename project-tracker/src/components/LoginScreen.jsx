import { useState } from 'react'
import { useUser } from '../contexts/UserContext'
import PasswordInput from './PasswordInput'
import { HOME_TEAM_NUMBER, teamLoginEmail, isHomeTeamNumber } from '../data/team'

function LoginScreen({ sessionExpired, linkError, onBack }) {
  const { login, signup, checkWhitelist, resetPassword, updatePassword, passwordRecovery } = useUser()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Visiting teams sign in by number; the password box below is shared.
  const [teamNumber, setTeamNumber] = useState('')
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

  const handleTeamSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const n = teamNumber.trim()
    if (!n || !password.trim()) return
    // Our own number is not a visiting-team login, and never should be.
    if (isHomeTeamNumber(n)) {
      setError(`${HOME_TEAM_NUMBER} is us — sign in with your email above.`)
      return
    }
    setSubmitting(true)
    try {
      await login(teamLoginEmail(n), password)
    } catch (err) {
      setError(err.message?.includes('Invalid login')
        ? 'Invalid team number or password'
        : err.message)
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
        await login(email.trim(), password)
      }
    } catch (err) {
      // A team got here by number, so "invalid email or password" would be
      // telling them about a field they never filled in.
      const isTeam = /^\d+$/.test((email || '').trim())
      if (err.message?.includes('Invalid login')) {
        setError(isTeam ? 'Invalid team number or password' : 'Invalid email or password')
      } else {
        setError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const wrapper = 'min-h-screen bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30 flex items-center justify-center'
  const card = 'bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-80 space-y-5'
  const input = 'w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pastel-blue focus:border-transparent text-center text-lg'
  const btn = 'w-full py-3 bg-pastel-pink hover:bg-pastel-pink-dark disabled:opacity-50 rounded-xl font-semibold text-gray-700 transition-colors text-lg'
  const heading = 'text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent'

  // Password recovery — user clicked reset link in email
  if (passwordRecovery) {
    return (
      <div className={wrapper}>
        <form onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          if (password.length < 6) {
            setError('Password must be at least 6 characters')
            return
          }
          setSubmitting(true)
          try {
            await updatePassword(password)
          } catch (err) {
            setError(err.message)
          } finally {
            setSubmitting(false)
          }
        }} className={card}>
          <div className="text-center">
            <h1 className={heading}>Set New Password</h1>
            <p className="text-sm text-gray-500 mt-1">Enter your new password below</p>
          </div>

          <PasswordInput
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            placeholder="New password"
            className={input}
            autoFocus
            required
          />

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button type="submit" disabled={submitting} className={btn}>
            {submitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    )
  }

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

          {/* Said here because this is where the choice gets made, and it is
              only discovered later — when the reset email never arrives and
              nobody can do anything about it from this end. */}
          <p className="text-xs text-gray-400 text-center -mt-1">
            Use a personal email if you can. School accounts often block the
            password reset email, and there's no way to get you back in without it.
          </p>

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

          {onBack && (
            <p className="text-sm text-center text-gray-500">
              <button
                type="button"
                onClick={onBack}
                className="text-pastel-blue-dark font-semibold hover:underline"
              >
                &larr; Back to Welcome
              </button>
            </p>
          )}
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

          <PasswordInput
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
              Check your inbox (and spam/junk folder) and follow the link to reset your password. Only the link in the newest email works.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Note: Emails can take a few minutes. If it never arrives, ask a team lead to reset your password from the Supabase dashboard.
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

          <p className="text-xs text-gray-400 text-center -mt-1">
            If this is a school address and nothing arrives, it was probably
            blocked — ask a lead to change your email to a personal one.
          </p>

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

  // Sign-in form, with the visiting-team box beneath it.
  return (
    <div className={`${wrapper} flex-col py-8`}>
        <form onSubmit={handleSubmit} className={card}>
          <div className="text-center">
            <h1 className={heading}>Sign In</h1>
            <p className="text-sm text-gray-500 mt-1">Welcome back</p>
          </div>

          {linkError && (
            <div className="bg-pastel-orange/30 text-orange-700 text-sm text-center px-3 py-2 rounded-lg">
              {linkError}
            </div>
          )}

          {sessionExpired && (
            <div className="bg-pastel-orange/30 text-orange-700 text-sm text-center px-3 py-2 rounded-lg">
              Your session has expired. Please log in again.
            </div>
          )}

          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError('') }}
            placeholder="Email"
            className={input}
            autoFocus
          />

          <PasswordInput
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

          <p className="text-xs text-center text-gray-400">
            No account? Ask a team lead to add you.
          </p>

          {onBack && (
            <p className="text-sm text-center text-gray-500">
              <button
                type="button"
                onClick={onBack}
                className="text-pastel-blue-dark font-semibold hover:underline"
              >
                &larr; Back to Welcome
              </button>
            </p>
          )}
        </form>

      {/* ── Visiting teams ──────────────────────────────────────────────── */}
      {/* Its own form, so Enter in the number field signs the team in instead
          of submitting the email above. Teams sign in as
          team<number>@teams.radical — an address that isn't real and couldn't
          be typed from memory, which is why the number is all they need. */}
      <form onSubmit={handleTeamSubmit} className={`${card} mt-4`}>
        <div className="text-center">
          <h2 className="text-sm font-semibold text-gray-600">Visiting FTC team?</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Use the team number and password your host team gave you.
          </p>
        </div>

        <input
          type="text"
          inputMode="numeric"
          value={teamNumber}
          onChange={(e) => { setTeamNumber(e.target.value.replace(/[^0-9]/g, '')); setError('') }}
          placeholder="Team number"
          className={input}
        />

        <PasswordInput
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError('') }}
          placeholder="Password"
          className={input}
        />

        <button type="submit" disabled={submitting} className={btn}>
          {submitting ? 'Signing in...' : 'Team Sign In'}
        </button>

        {/* No "forgot password" on purpose: team addresses can't receive
            email, so the link would do nothing. Say who can actually fix it. */}
        <p className="text-[11px] text-center text-gray-400">
          Forgotten it? Ask the team who gave you this login — they can set a
          new one.
        </p>
      </form>
    </div>
  )
}

export default LoginScreen
