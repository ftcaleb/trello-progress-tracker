export type Role = 'developer' | 'designer' | 'cybersecurity'
export type TaskStatus = 'approved' | 'in_progress' | 'blocked'

export interface Project {
  id: string
  name: string
  description: string | null
  standup_day: string
  standup_time: string
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
}

export interface Intern {
  id: string
  name: string
  initials: string
  role: Role
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
}

export interface PhaseReport {
  id: string
  project_id: string
  phase_id: string
  content: string
  generated_at: string
  updated_at: string
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
