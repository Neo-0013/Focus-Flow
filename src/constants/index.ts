import { Zap, Trophy, Flame, Check, Shield, Moon, Brain, Target, BookOpen, Swords, Crown, Star } from 'lucide-react';
import { TimerMode, SoundOption } from '../types';

export const BADGES = [
  // Tier 1 — Initiation
  { id: 'early_bird',      title: 'Early Bird',          description: 'Complete a task before 8 AM',            icon: Zap,      color: 'text-amber-400'   },
  { id: 'weekend_warrior', title: 'Weekend Warrior',     description: 'Complete a task on a weekend',           icon: Trophy,   color: 'text-purple-400'  },
  { id: 'dedicated_focus', title: 'Dedicated Focus',     description: 'Finish your first focus session',        icon: Flame,    color: 'text-orange-500'  },
  { id: 'first_focus',     title: 'First Contact',       description: 'Complete your very first focus session', icon: Zap,      color: 'text-cyan-400'    },
  { id: 'task_master',     title: 'Task Master',         description: 'Complete 10 tasks total',                icon: Check,    color: 'text-emerald-400' },
  { id: 'habit_starter',   title: 'Habit Starter',       description: 'Maintain a habit for 3 days straight',  icon: Flame,    color: 'text-orange-400'  },
  // Tier 2 — Consistency
  { id: 'week_warrior',    title: 'Week Warrior',        description: 'Achieve a 5-day focus streak',          icon: Shield,   color: 'text-blue-400'    },
  { id: 'night_owl',       title: 'Night Owl',           description: 'Complete a focus session after 10 PM',  icon: Moon,     color: 'text-indigo-400'  },
  { id: 'deep_architect',  title: 'Deep Architect',      description: 'Log 10+ hours of deep work in a week', icon: Brain,    color: 'text-purple-400'  },
  { id: 'goal_setter',     title: 'Goal Setter',         description: 'Create your first Goal',                icon: Target,   color: 'text-emerald-400' },
  { id: 'journal_entry',   title: 'Chronicler',          description: 'Write your first journal entry',        icon: BookOpen, color: 'text-amber-400'   },
  { id: 'planner',         title: 'Planner',             description: 'Add 5 tasks with due dates',           icon: Trophy,   color: 'text-blue-400'    },
  // Tier 3 — Discipline
  { id: 'iron_week',       title: 'Iron Week',           description: 'Hit your daily goal 7 days in a row',  icon: Swords,   color: 'text-red-400'     },
  { id: 'centurion',       title: 'Centurion',           description: 'Complete 100 tasks total',              icon: Crown,    color: 'text-amber-400'   },
  { id: 'marathon_man',    title: 'Marathon Session',    description: 'Complete a 90-minute focus session',   icon: Zap,      color: 'text-cyan-400'    },
  { id: 'void_mode_user',  title: 'Into The Void',       description: 'Activate Void Mode once',              icon: Shield,   color: 'text-violet-400'  },
  { id: 'sub_task_pro',    title: 'Sub-Task Pro',        description: 'Add 25 sub-tasks total',               icon: Check,    color: 'text-emerald-400' },
  { id: 'habit_week',      title: 'Habit Machine',       description: 'Complete all habits in a single day',  icon: Flame,    color: 'text-orange-500'  },
  // Tier 4 — Mastery
  { id: 'level_5',         title: 'Level 5',             description: 'Reach Level 5',                        icon: Star,     color: 'text-yellow-400'  },
  { id: 'level_10',        title: 'Level 10 Architect',  description: 'Reach Level 10',                      icon: Crown,    color: 'text-yellow-400'  },
  { id: 'sessions_50',     title: 'Fifty Sessions',      description: 'Complete 50 focus sessions',           icon: Flame,    color: 'text-orange-400'  },
  { id: 'multi_workspace', title: 'Multi-Operator',      description: 'Use all 3 workspaces',                 icon: Brain,    color: 'text-purple-400'  },
  { id: 'perfect_day',     title: 'Perfect Day',         description: 'Complete 5 or more tasks',             icon: Star,     color: 'text-yellow-400'  },
  { id: 'deep_diver',      title: 'Deep Diver',          description: 'Activate the Ambient Soundscape',     icon: Moon,     color: 'text-blue-400'    },
  // Tier 5 — Elite
  { id: 'sessions_100',    title: 'Century Sessions',    description: 'Complete 100 focus sessions',          icon: Trophy,   color: 'text-amber-500'   },
  { id: 'hours_100',       title: 'One Hundred Hours',   description: '100 hours of total deep work logged',  icon: Zap,      color: 'text-cyan-400'    },
  { id: 'habit_legend',    title: 'Habit Legend',        description: 'Maintain any habit for 30 days',      icon: Crown,    color: 'text-amber-400'   },
  { id: 'night_grind',     title: 'Night Grind',         description: 'Complete 3 sessions after midnight',  icon: Moon,     color: 'text-violet-400'  },
  { id: 'task_century',    title: 'Task Century',        description: 'Add 100 or more tasks total',         icon: Check,    color: 'text-emerald-500' },
  { id: 'the_architect',   title: 'The Architect',       description: 'Unlock 15 or more badges',            icon: Crown,    color: 'text-yellow-300'  },
];

export const API_BASE = 'http://localhost:3002';

export const DEFAULT_SOUNDS: SoundOption[] = [
  { id: 'bell', name: 'Alarm Bell', url: '/audio/bell.mp3' },
  { id: 'rain', name: 'Rain Drop', url: '/audio/rain.mp3' },
  { id: 'cafe', name: 'Cafe Buzz', url: '/audio/cafe.mp3' }
];

export const DEFAULT_DURATIONS = { work: 25, shortBreak: 5, longBreak: 15 };

export const MODES_META: Record<TimerMode, { label: string, color: string, icon: any }> = {
  work: { label: 'Deep Focus', color: 'text-accent', icon: Brain },
  shortBreak: { label: 'Short Break', color: 'text-emerald-400', icon: Zap },
  longBreak: { label: 'Long Break', color: 'text-blue-400', icon: Moon },
};
