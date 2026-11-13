const API_BASE = '/api/v1';

export function getToken() {
  return localStorage.getItem('netshield_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('netshield_token', token);
  } else {
    localStorage.removeItem('netshield_token');
  }
}

export function removeToken() {
  localStorage.removeItem('netshield_token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    // Session expired or token revoked
    removeToken();
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.detail || data?.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Authentication
  login: (username_or_email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username_or_email, password }),
    }),

  logout: () =>
    request('/auth/logout', {
      method: 'POST',
    }),

  getMe: () => request('/auth/me'),

  changePassword: (current_password, new_password) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    }),

  // User Management
  getUsers: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '')
    ).toString();
    return request(`/users${query ? `?${query}` : ''}`);
  },

  createUser: (userData) =>
    request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  getUser: (id) => request(`/users/${id}`),

  updateUser: (id, userData) =>
    request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),

  toggleUserStatus: (id, is_active) =>
    request(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    }),

  resetUserPassword: (id, new_password) =>
    request(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password }),
    }),

  // Team Management
  getTeams: () => request('/teams'),

  createTeam: (teamData) =>
    request('/teams', {
      method: 'POST',
      body: JSON.stringify(teamData),
    }),

  getTeam: (id) => request(`/teams/${id}`),

  updateTeam: (id, teamData) =>
    request(`/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(teamData),
    }),

  deleteTeam: (id) =>
    request(`/teams/${id}`, {
      method: 'DELETE',
    }),

  addTeamMember: (teamId, userId) =>
    request(`/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  removeTeamMember: (teamId, userId) =>
    request(`/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    }),

  // Audit Logging
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '')
    ).toString();
    return request(`/audit${query ? `?${query}` : ''}`);
  },

  getAuditStats: () => request('/audit/stats'),
};
