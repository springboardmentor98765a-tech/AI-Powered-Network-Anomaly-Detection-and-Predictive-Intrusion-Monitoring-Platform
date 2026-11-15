/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   EditTeamModal — Edit team name & description
   Allowed for Admin or that team's Lead.
   Sending "" for description clears it.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useState } from 'react'
import Modal from './ui/Modal'
import FormField from './ui/FormField'
import Spinner from './ui/Spinner'
import { apiUpdateTeam } from '../api/teams'
import { errorMessage } from '../api/client'
import { useToast } from './ui/Toast'

function EditTeamForm({ team, onClose, onUpdated }) {
  const [teamName, setTeamName]         = useState(team?.team_name || '')
  const [description, setDescription]   = useState(team?.description || '')
  const [fieldErrors, setFieldErrors]   = useState({})
  const [generalError, setGeneralError] = useState('')
  const [submitting, setSubmitting]     = useState(false)

  const { success } = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGeneralError('')
    const errors = {}

    const cleanName = teamName.trim()
    if (!cleanName) {
      errors.teamName = 'Team name is required'
    } else if (cleanName.length < 2 || cleanName.length > 100) {
      errors.teamName = 'Team name must be between 2 and 100 characters'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setSubmitting(true)

    try {
      // Backend contract: send "" to clear description
      const updated = await apiUpdateTeam(team.id, {
        team_name: cleanName,
        description: description.trim(),
      })
      success(`Team "${updated.team_name}" updated successfully`)
      onClose()
      onUpdated?.(updated)
    } catch (err) {
      const msg = errorMessage(err)
      if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate')) {
        setFieldErrors({ teamName: 'A team with this name already exists' })
      } else {
        setGeneralError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
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

      <FormField label="Team Name" id="edit-team-name" required error={fieldErrors.teamName}>
        <input
          id="edit-team-name"
          type="text"
          className={`input-glass ${fieldErrors.teamName ? 'has-error' : ''}`}
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          disabled={submitting}
          autoFocus
        />
      </FormField>

      <FormField
        label="Description"
        id="edit-team-description"
        hint="Leave empty to clear team description"
      >
        <textarea
          id="edit-team-description"
          className="input-glass"
          style={{ resize: 'vertical', minHeight: '80px' }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={submitting}
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
          onClick={onClose}
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
          <span>Save Changes</span>
        </button>
      </div>
    </form>
  )
}

export default function EditTeamModal({ isOpen, onClose, team, onUpdated }) {
  if (!isOpen || !team) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Team Details" maxWidth="480px">
      <EditTeamForm team={team} onClose={onClose} onUpdated={onUpdated} />
    </Modal>
  )
}
