export type Role = { id: number; role_name: string; description: string };
export type User = { id: number; name: string; username: string; email: string; is_active: boolean; role: Role; created_at: string; updated_at: string };
export type Team = { id: number; team_name: string; description?: string; created_at: string; member_count: number; members?: any[] };
export type Audit = { id: number; actor_user_id?: number; action: string; target_type: string; target_id?: number; status: string; timestamp: string; details?: string };
