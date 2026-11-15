/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   NewUserModal — Admin dialog to create user accounts
   - Name, username, email, password, role_id
   - Mirror backend validation rules:
     Username: 3-30 chars, letters/digits/./_/- only, no "@"
     Password: 8-64 chars
     Role: 1, 2, or 3
   - Maps server 409/400 errors directly to matching fields
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Modal from './ui/Modal'
import FormField from './ui/FormField'
import Spinner from './ui/Spinner'
import { apiCreateUser } from '../api/users'
import { errorMessage } from '../api/client'
import { ROLE_IDS, ROLE_LABELS } from '../constants/roles'
import { useToast } from './ui/Toast'

export default function NewUserModal({ isOpen, onClose, onCreated }) {
  const [name, setName]                 = useState('')
  const [username, setUsername]         = useState('')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [roleId, setRoleId]             = useState(ROLE_IDS.security_analyst)
  const [showPassword, setShowPassword] = useState(false)

  const [fieldErrors, setFieldErrors]   = useState({})
  const [generalError, setGeneralError] = useState('')
  const [submitting, setSubmitting]     = useState(false)

  const { success } = useToast()

  const resetForm = () => {
    setName('')
    setUsername('')
    setEmail('')
    setPassword('')
    setRoleId(ROLE_IDS.security_analyst)
    setShowPassword(false)
    setFieldErrors({})
    setGeneralError('')
  }

  const handleClose = () => {
    if (submitting) return
    resetForm()
    onClose()
  }

  const validate = () => {
    const errors = {}

    if (!name.trim()) {
      errors.name = 'Full name is required'
    }

    const cleanUsername = username.trim()
    const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/
    if (!cleanUsername) {
      errors.username = 'Username is required'
    } else if (cleanUsername.includes('@')) {
      errors.username = 'Username cannot contain "@"'
    } else if (!usernameRegex.test(cleanUsername)) {
      errors.username = '3-30 chars, letters, digits, and . _ - only'
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email.trim()) {
      errors.email = 'Email address is required'
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Invalid email address format'
    }

    if (!password) {
      errors.password = 'Password is required'
    } else if (password.length < 8 || password.length > 64) {
      errors.password = 'Password must be between 8 and 64 characters'
    }

    if (!roleId) {
      errors.roleId = 'Please select a valid role'
    }

    return errors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGeneralError('')
    const clientErrors = validate()

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors)
      return
    }

    setFieldErrors({})
    setSubmitting(true)

    try {
      await apiCreateUser({
        name: name.trim(),
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        role_id: Number(roleId),
      })
      success(`User @${username.trim()} created successfully`)
      handleClose()
      onCreated?.()
    } catch (err) {
      const msg = errorMessage(err)

      // Map specific backend error messages to the relevant input field
      if (msg.toLowerCase().includes('email already')) {
        setFieldErrors({ email: 'Email is already registered' })
      } else if (msg.toLowerCase().includes('username already')) {
        setFieldErrors({ username: 'Username is already taken' })
      } else if (msg.toLowerCase().includes('invalid role')) {
        setFieldErrors({ roleId: 'Invalid role selected' })
      } else {
        setGeneralError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New User Account" maxWidth="480px">
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(248, 113, 113, 0.12)',
              border: '1px solid rgba(248, 113, 113, 0.3)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--danger)',
              fontSize: '13px',
              marginBottom: '16px',
            }}
            role="alert"
          >
            {generalError}
          </div>
        )}

        <FormField label="Full Name" id="new-name" required error={fieldErrors.name}>
          <input
            id="new-name"
            type="text"
            className={`input-glass ${fieldErrors.name ? 'has-error' : ''}`}
            placeholder="e.g. Alex Morgan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            autoFocus
          />
        </FormField>

        <FormField
          label="Username"
          id="new-username"
          required
          hint="Letters, digits, . _ - (no @ allowed)"
          error={fieldErrors.username}
        >
          <input
            id="new-username"
            type="text"
            className={`input-glass ${fieldErrors.username ? 'has-error' : ''}`}
            placeholder="alex.morgan"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={submitting}
            autoComplete="off"
          />
        </FormField>

        <FormField label="Email Address" id="new-email" required error={fieldErrors.email}>
          <input
            id="new-email"
            type="email"
            className={`input-glass ${fieldErrors.email ? 'has-error' : ''}`}
            placeholder="alex@netshield.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            autoComplete="off"
          />
        </FormField>

        <FormField
          label="Password"
          id="new-password"
          required
          hint="8 to 64 characters"
          error={fieldErrors.password}
        >
          <div style={{ position: 'relative' }}>
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              className={`input-glass ${fieldErrors.password ? 'has-error' : ''}`}
              style={{ paddingRight: '38px' }}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </FormField>

        <FormField label="Access Role" id="new-role" required error={fieldErrors.roleId}>
          <select
            id="new-role"
            className={`input-glass ${fieldErrors.roleId ? 'has-error' : ''}`}
            value={roleId}
            onChange={(e) => setRoleId(Number(e.target.value))}
            disabled={submitting}
            style={{ cursor: 'pointer' }}
          >
            <option value={ROLE_IDS.admin} style={{ background: '#12161a', color: '#fff' }}>
              {ROLE_LABELS.admin}
            </option>
            <option value={ROLE_IDS.security_analyst} style={{ background: '#12161a', color: '#fff' }}>
              {ROLE_LABELS.security_analyst}
            </option>
            <option value={ROLE_IDS.team_lead} style={{ background: '#12161a', color: '#fff' }}>
              {ROLE_LABELS.team_lead}
            </option>
          </select>
        </FormField>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '24px',
          }}
        >
          <button
            type="button"
            className="btn-glass"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
          >
            {submitting && <Spinner size={16} />}
            <span>Create User</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}

