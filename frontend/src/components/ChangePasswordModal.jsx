/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ChangePasswordModal — Dialog to change password
   - Old password, new password, confirm password
   - Client checks: new is 8-64 chars and matches confirm
   - Shows server 400 messages inline
   - Shows success toast on 204, then closes
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useState } from 'react'
import Modal from './ui/Modal'
import FormField from './ui/FormField'
import Spinner from './ui/Spinner'
import { apiChangePassword } from '../api/auth'
import { errorMessage } from '../api/client'
import { useToast } from './ui/Toast'

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { success } = useToast()

  const resetForm = () => {
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setFieldErrors({})
    setServerError('')
  }

  const handleClose = () => {
    if (submitting) return
    resetForm()
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')
    const errors = {}

    if (!oldPassword) {
      errors.oldPassword = 'Old password is required'
    }

    if (!newPassword) {
      errors.newPassword = 'New password is required'
    } else if (newPassword.length < 8 || newPassword.length > 64) {
      errors.newPassword = 'Password must be between 8 and 64 characters'
    }

    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setSubmitting(true)

    try {
      await apiChangePassword(oldPassword, newPassword)
      success('Password changed successfully')
      handleClose()
    } catch (err) {
      const msg = errorMessage(err)
      setServerError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Change Password" maxWidth="440px">
      <form onSubmit={handleSubmit} noValidate>
        {serverError && (
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
            {serverError}
          </div>
        )}

        <FormField
          label="Current Password"
          id="old-password"
          required
          error={fieldErrors.oldPassword}
        >
          <input
            id="old-password"
            type="password"
            className={`input-glass ${fieldErrors.oldPassword ? 'has-error' : ''}`}
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            disabled={submitting}
            autoComplete="current-password"
          />
        </FormField>

        <FormField
          label="New Password"
          id="new-password"
          required
          hint="Must be between 8 and 64 characters"
          error={fieldErrors.newPassword}
        >
          <input
            id="new-password"
            type="password"
            className={`input-glass ${fieldErrors.newPassword ? 'has-error' : ''}`}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={submitting}
            autoComplete="new-password"
          />
        </FormField>

        <FormField
          label="Confirm New Password"
          id="confirm-password"
          required
          error={fieldErrors.confirmPassword}
        >
          <input
            id="confirm-password"
            type="password"
            className={`input-glass ${fieldErrors.confirmPassword ? 'has-error' : ''}`}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
            autoComplete="new-password"
          />
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
            <span>Update Password</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}

