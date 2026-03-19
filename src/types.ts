export type TimerMode = 'work' | 'shortBreak' | 'longBreak';
export type Priority = 'low' | 'medium' | 'high';
export type CalendarView = 'day' | 'week' | 'month';
export type AppView = 'dashboard' | 'timer' | 'tasks' | 'calendar' | 'goals' | 'journal' | 'board';
export type GoalType = 'weekly' | 'monthly' | 'yearly';
export type GoalCategory = 'Health' | 'Career' | 'Finance' | 'Education' | 'Personal';
export type Theme = 'light' | 'dark' | 'system';
export type Workspace = 'Personal' | 'Work' | 'Project';

export interface SubTask {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  taskId: string;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  status?: 'todo' | 'in_progress' | 'done';
  priority: Priority;
  position: number;
  createdAt: number;
  dueDate?: string;
  timeSlot?: string;
  parentId?: string;
  subTasks: SubTask[];
  goalId?: string;
  archived: number;
}

export interface Habit {
  id: string;
  title: string;
  streak: number;
  lastCompletedAt: number | null;
  createdAt: number;
}

export interface Profile {
  id: number;
  xp: number;
  level: number;
}

export interface Achievement {
  id: string;
  badgeId: string;
  unlockedAt: number;
}

export interface JournalEntry {
  id: string;
  workspaceId: Workspace;
  date: string;
  content: string;
}

export interface Goal {
  id: string;
  title: string;
  type: GoalType;
  category: GoalCategory;
  target: number;
  done: number;
  parentId?: string;
  position: number;
  yearId?: string;
  monthId?: string;
  autoProgress: number;
  createdAt: number;
}

export interface SoundOption {
  id: string;
  name: string;
  url: string;
}
