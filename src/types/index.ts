export type TimerMode = 'work' | 'shortBreak' | 'longBreak';
export type Priority = 'low' | 'medium' | 'high';
export type CalendarView = 'day' | 'week' | 'month';
export type AppView = 'dashboard' | 'timer' | 'tasks' | 'calendar' | 'goals' | 'journal' | 'board' | 'performance' | 'strategy' | 'network' | 'settings' | 'advanced_tasks' | 'docforge' | 'study';
export type GoalType = 'weekly' | 'monthly' | 'yearly';
export type GoalCategory = 'Health' | 'Career' | 'Finance' | 'Education' | 'Personal';
export type Theme = 'light' | 'dark' | 'system' | 'midnight' | 'nordic' | 'cyberpunk' | 'snow';
export type Workspace = 'Personal' | 'Work' | 'Project';

export interface Subject {
  id: string;
  name: string;
  workspaceId: string;
  createdAt: number;
}

export interface StudyMaterial {
  id: string;
  subjectId: string;
  name: string;
  content: string;
  fileUrl?: string;
  size: number;
  mimetype: string;
  createdAt: number;
}

export interface Flashcard {
  id: string;
  subjectId: string;
  question: string;
  answer: string;
  difficulty: number;
  interval: number;
  repetitions: number;
  nextReviewDate: number;
  createdAt: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctOption: number;
  explanation: string;
}

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
  recurrenceInterval?: number;
  recurrenceUnit?: string;
  recurrenceEnds?: string;
  recurrenceEndDate?: string;
  recurrenceEndOccurrences?: number;
  recurrenceCount?: number;
  parentId?: string;
  subTasks: SubTask[];
  goalId?: string;
  workspaceId?: string;
  archived: number;
  importance: number;
  urgency: number;
  cognitiveCost: number;
  dependencyIds: string[];
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
  aiProtocol?: 'gentle' | 'strategic' | 'hardcore' | 'tars';
  themeOpacity?: number;
  glowIntensity?: number;
  telemetryMasking?: boolean;
  stealthMode?: boolean;
  humorLevel?: number;
}

export interface Achievement {
  id: string;
  badgeId: string;
  unlockedAt: number;
}

export interface JournalAttachment {
  name: string;
  url: string;
  mimetype: string;
  size: number;
}

export interface JournalEntry {
  id: string;
  workspaceId: Workspace;
  date: string;
  content: string;
  folder?: string;
  title?: string;
  tags?: string[];
  attachments?: JournalAttachment[];
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

export interface NeuralSector {
  id: string;
  name: string;
  description: string;
  icon: string;
  baseTime: number; // in minutes
  activeNodes: number;
}

export interface NeuralNode {
  id: string;
  sectorId: string;
  joinedAt: number;
}
