/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Audit Action Constants & Labels
   Backend action values mapped to friendly UI descriptions.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export const AUDIT_ACTIONS = {
  LOGIN:                'login',
  LOGOUT:               'logout',
  PASSWORD_CHANGE:      'password_change',
  USER_CREATE:          'user_create',
  USER_STATUS_CHANGE:   'user_status_change',
  ROLE_CHANGE:          'role_change',
  TEAM_CREATE:          'team_create',
  TEAM_UPDATE:          'team_update',
  TEAM_LEAD_CHANGE:     'team_lead_change',
  TEAM_DELETE:          'team_delete',
  TEAM_MEMBER_ADD:      'team_member_add',
  TEAM_MEMBER_REMOVE:   'team_member_remove',
}

export const AUDIT_ACTION_LABELS = {
  login:              'Signed In',
  logout:             'Signed Out',
  password_change:    'Changed Password',
  user_create:        'Created User',
  user_status_change: 'Changed User Status',
  role_change:        'Changed User Role',
  team_create:        'Created Team',
  team_update:        'Updated Team',
  team_lead_change:   'Changed Team Lead',
  team_delete:        'Deleted Team',
  team_member_add:    'Added Team Member',
  team_member_remove: 'Removed Team Member',
}

