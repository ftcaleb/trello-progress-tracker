export type Role = 'developer' | 'designer' | 'cybersecurity'
export type TaskStatus = 'approved' | 'in_progress' | 'blocked'

export interface Project {
  id: string
  name: string
  description: string | null
  standup_day: string
  standup_time: string
  initial_meet_date: string | null
  team_id: string | null
  created_at: string
}

export interface Phase {
  id: string
  project_id: string
  name: string
  week_number: number
  position: number
}

export interface Task {
  id: string
  project_id: string
  phase_id: string
  title: string
  status: TaskStatus
  position: number
  created_by?: string | null
}

export interface Intern {
  id: string
  name: string
  initials: string
  role: Role
  moodle_user_id: number | null
}

export interface ProjectIntern {
  project_id: string
  intern_id: string
}

export interface Comment {
  id: string
  task_id: string
  phase_id: string | null
  content: string
  created_at: string
  updated_at: string
  created_by?: string | null
}

export interface PublicProfile {
  id: string
  full_name: string | null
  moodle_username: string | null
}

export interface PhaseReport {
  id: string
  project_id: string
  phase_id: string
  content: string
  generated_at: string
  updated_at: string
}

export interface Team {
  id: string
  name: string
  position: number
  created_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  intern_id: string | null
  name: string
  initials: string
  role: Role
  is_active: boolean
  position: number
  created_at: string
}

export interface TeamProject {
  id: string
  team_id: string
  name: string
  position: number
  created_at: string
}

export interface StandupSession {
  id: string
  project_id: string
  session_date: string
  starts_at: string
  ends_at: string
  is_initial_meet: boolean
  created_at: string
}

export interface AttendanceRecord {
  id: string
  session_id: string
  intern_id: string
  status: 'present'
  marked_at: string
  marked_by: string | null
}

export interface ProjectAssignment {
  project_id: string
  intern_id: string
  assigned_at: string
}

export type AppRole = 'admin' | 'member'

export interface Profile {
  id: string
  moodle_user_id: number | null
  moodle_username: string | null
  email: string | null
  full_name: string | null
  app_role: AppRole
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

export const ROLE_LABELS: Record<Role, string> = {
  developer: 'Developer',
  designer: 'Designer',
  cybersecurity: 'Cybersecurity Analyst',
}

export const ROLE_ORDER: Role[] = ['developer', 'designer', 'cybersecurity']

export const STATUS_LABELS: Record<TaskStatus, string> = {
  approved: 'Approved',
  in_progress: 'In Progress',
  blocked: 'Blocked',
}

export const STATUS_ORDER: TaskStatus[] = ['in_progress', 'approved', 'blocked']

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export const WEEKDAY_SHORT: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
}
