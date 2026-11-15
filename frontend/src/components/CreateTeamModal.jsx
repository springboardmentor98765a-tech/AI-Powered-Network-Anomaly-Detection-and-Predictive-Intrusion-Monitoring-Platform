/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CreateTeamModal — Admin dialog to create a new team
   - Name (2-100 characters)
   - Description (optional)
   - Lead: optional active user with role "team_lead"
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useState, useEffect } from 'react'
import Modal from './ui/Modal'
import FormField from './ui/FormField'
import Spinner from './ui/Spinner'
import { apiCreateTeam } from '../api/teams'
import { fetchAllUsers } from '../api/users'
import { errorMessage } from '../api/client'
import { useToast } from './ui/Toast'

export default function CreateTeamModal({ isOpen, onClose, onCreated }) {
  const [teamName, setTeamName]             = useState('')
  const [description, setDescription]       = useState('')
  const [leadUserId, setLeadUserId]         = useState('')
  const [availableLeads, setAvailableLeads] = useState([])
  const [loadingLeads, setLoadingLeads]     = useState(false)

  const [fieldErrors, setFieldErrors]       = useState({})
  const [generalError, setGeneralError]     = useState('')
  const [submitting, setSubmitting]         = useState(false)

  const { success } = useToast()

  // Load active team leads for the lead dropdown
  useEffect(() => {
    if (!isOpen) return
    let isMounted = true

    fetchAllUsers()
      .then((users) => {
        if (!isMounted) return
        const leads = users.filter(
          (u) => u.role?.role_name === 'team_lead' && u.status === 'active'
        )
        setAvailableLeads(leads)
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingLeads(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen])

  const resetForm = () => {
    setTeamName('')
    setDescription('')
    setLeadUserId('')
    setFieldErrors({})
    setGeneralError('')
  }

  const handleClose = () => {
    if (submitting) return
    resetForm()
    onClose()
  }

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
      const payload = {
        team_name: cleanName,
        description: description.trim() || undefined,
        lead_user_id: leadUserId ? Number(leadUserId) : undefined,
      }
      const created = await apiCreateTeam(payload)
      success(`Team "${created.team_name}" created successfully`)
      handleClose()
      onCreated?.()
    } catch (err) {
      const msg = errorMessage(err)
      if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate')) {
        setFieldErrors({ teamName: 'A team with this name already exists' })
      } else if (msg.toLowerCase().includes('lead')) {
        setFieldErrors({ leadUserId: msg })
      } else {
        setGeneralError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Security Team" maxWidth="480px">
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

        <FormField label="Team Name" id="team-name" required error={fieldErrors.teamName}>
          <input
            id="team-name"
            type="text"
            className={`input-glass ${fieldErrors.teamName ? 'has-error' : ''}`}
            placeholder="e.g. Incident Response Alpha"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            disabled={submitting}
            autoFocus
          />
        </FormField>

        <FormField label="Description" id="team-description" hint="Optional summary of team mission">
          <textarea
            id="team-description"
            className="input-glass"
            style={{ resize: 'vertical', minHeight: '80px' }}
            placeholder="Responsible for rapid containment and live telemetry monitoring..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
          />
        </FormField>

        <FormField
          label="Team Lead"
          id="team-lead"
          hint="Only active users with the Team Lead role are eligible"
          error={fieldErrors.leadUserId}
        >
          <select
            id="team-lead"
            className={`input-glass ${fieldErrors.leadUserId ? 'has-error' : ''}`}
            value={leadUserId}
            onChange={(e) => setLeadUserId(e.target.value)}
            disabled={submitting || loadingLeads}
            style={{ cursor: 'pointer' }}
          >
            <option value="" style={{ background: '#12161a', color: '#fff' }}>
              {loadingLeads ? 'Loading eligible leads...' : '— No lead assigned —'}
            </option>
            {availableLeads.map((lead) => (
              <option key={lead.id} value={lead.id} style={{ background: '#12161a', color: '#fff' }}>
                {lead.name ? `${lead.name} (@${lead.username})` : `@${lead.username}`}
              </option>
            ))}
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
            <span>Create Team</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}
