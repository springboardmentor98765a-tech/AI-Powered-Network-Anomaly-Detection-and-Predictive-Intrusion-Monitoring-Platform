/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Role constants.
   Role IDs match the backend seed order; there is no
   /roles endpoint — do not fetch these from the API.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** Backend role_name strings */
export const ROLES = {
  ADMIN:   'admin',
  ANALYST: 'security_analyst',
  LEAD:    'team_lead',
}

/** Human-readable labels for display */
export const ROLE_LABELS = {
  admin:            'Administrator',
  security_analyst: 'Security Analyst',
  team_lead:        'Team Lead',
}

/** Numeric IDs from the seed — only used when POSTing users */
export const ROLE_IDS = {
  admin:            1,
  security_analyst: 2,
  team_lead:        3,
}

/** Badge variant per role (used in Topbar, Users table, etc.) */
export const ROLE_BADGE_VARIANT = {
  admin:            'accent',
  security_analyst: 'info',
  team_lead:        'neutral',
}

