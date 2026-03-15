# Implementation Plan: FocusFlow Enhancements

## Overview

Incremental implementation of seven enhancements to `src/App.tsx` (single-file React/TypeScript/Vite app) plus PWA assets in `public/`. Each task builds on the previous, ending with full integration.

## Tasks

- [x] 1. App title fix and PWA branding assets
  - [x] 1.1 Fix `index.html` title and add PWA meta tags
    - Change `<title>My Google AI Studio App</title>` to `<title>FocusFlow</title>`
    - Add `<link rel="manifest" href="/manifest.json">`, favicon link, and apple-touch-icon link
    - _Requirements: 6.1, 4.1, 4.6_

  - [x] 1.2 Create `public/manifest.json`
    - Set `name` and `short_name` to "FocusFlow", `theme_color` and `background_color` to `#050505`
    - Include icon entries for 192×192, 512×512, and 180×180 (apple-touch-icon)
    - _Requirements: 4.2, 4.5, 6.2, 6.3_

  - [x] 1.3 Create SVG-based PNG icon assets in `public/icons/`
    - Generate `icon-192.png`, `icon-512.png`, and `apple-touch-icon.png` as SVG data URI placeholders or inline canvas-drawn PNGs
    - Place `favicon.ico` in `public/`
    - _Requirements: 4.1, 4.3, 4.4, 4.6_

  - [ ]* 1.4 Write unit tests for manifest and HTML title
    - Parse `public/manifest.json`, assert `name === 'FocusFlow'`, `theme_color === '#050505'`, icon paths present
    - Read `index.html`, assert `<title>FocusFlow</title>` and manifest link tag present
    - Assert icon files exist at expected paths
    - _Requirements: 4.2, 4.5, 6.1_

- [x] 2. Custom timer durations (Feature 5)
  - [x] 2.1 Add `TimerSettings` interface, state, and localStorage persistence to `App.tsx`
    - Define `interface TimerSettings { work: number; shortBreak: number; longBreak: number }`
    - Add `DEFAULT_TIMER_SETTINGS = { work: 25, shortBreak: 5, longBreak: 15 }`
    - Initialize `timerSettings` state from `onyx_timer_settings` localStorage key with try/catch fallback
    - Replace static `MODES` duration references with a `useMemo`-derived `modes` object using `timerSettings`
    - Persist `timerSettings` to localStorage on change
    - _Requirements: 5.1, 5.5, 5.6_

  - [ ]* 2.2 Write property test for timer settings localStorage round-trip
    - **Property 12: Custom timer settings round-trip through localStorage**
    - **Validates: Requirements 5.5, 5.6**

  - [x] 2.3 Add timer duration inputs and reset button to the settings modal
    - Add three `<input type="number" min="1" max="120">` fields for Focus, Short Break, Long Break
    - Show inline validation error when value is outside [1, 120]; disable save while errors exist
    - Add "Reset to Defaults" button that restores `DEFAULT_TIMER_SETTINGS`
    - _Requirements: 5.2, 5.3, 5.4, 5.7_

  - [ ]* 2.4 Write property test for timer duration validation
    - **Property 11: Custom timer duration validation rejects out-of-range values**
    - **Validates: Requirements 5.4**

  - [ ]* 2.5 Write property test for reset restoring defaults
    - **Property 13: Resetting timer settings restores defaults**
    - **Validates: Requirements 5.7**

- [x] 3. Checkpoint — ensure timer and PWA tasks pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Due date visibility across all views (Feature 3)
  - [x] 4.1 Add `getDueDateLabel` helper and date picker to tasks view
    - Implement `getDueDateLabel(dueDate, today)` returning `{ label, colorClass } | null` with red/amber/muted classes
    - Add a date picker `<input type="date">` to each task row in the tasks view to set/update `dueDate`
    - _Requirements: 3.1, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 4.2 Write property test for due date label color
    - **Property 10: Due date label color reflects urgency**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

  - [x] 4.3 Render due date labels in Dashboard active tasks section
    - Call `getDueDateLabel` on each task card in the "Active Tasks" panel
    - _Requirements: 3.2_

  - [x] 4.4 Render due date labels in Timer task list panel
    - Call `getDueDateLabel` on each task shown in the timer's right-side task list
    - _Requirements: 3.3_

  - [x] 4.5 Render due date labels in Calendar view task cards
    - Call `getDueDateLabel` on each task card within calendar date cells
    - _Requirements: 3.4_

- [-] 5. Sub-task UI audit and completion (Feature 1)
  - [x] 5.1 Audit and fix Task Dashboard sub-task UI
    - Verify expansion toggle is shown for all tasks with subTasks
    - Ensure inline add-subtask input is always visible when expanded (not hover-only)
    - Ensure progress bar renders on every task card that has subTasks
    - Ensure edit (inline text field pre-filled), delete, and reorder (up/down) controls are present
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.8, 1.10, 1.12_

  - [ ]* 5.2 Write property test for sub-task toggle round-trip
    - **Property 1: Sub-task toggle is a round trip**
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 5.3 Write property test for adding a non-empty sub-task
    - **Property 2: Adding a non-empty sub-task grows the subTasks array**
    - **Validates: Requirements 1.5**

  - [ ]* 5.4 Write property test for adding an empty sub-task is a no-op
    - **Property 3: Adding an empty or whitespace-only sub-task is a no-op**
    - **Validates: Requirements 1.6**

  - [ ]* 5.5 Write property test for sub-task completion toggle round-trip
    - **Property 4: Sub-task completion toggle is a round trip**
    - **Validates: Requirements 1.7**

  - [ ]* 5.6 Write property test for task progress percentage
    - **Property 5: Task progress percentage is correct**
    - **Validates: Requirements 1.8**

  - [ ]* 5.7 Write property test for deleting a sub-task
    - **Property 6: Deleting a sub-task removes it from the array**
    - **Validates: Requirements 1.9**

  - [ ]* 5.8 Write property test for sub-task reorder round-trip
    - **Property 7: Sub-task reorder swaps adjacent items**
    - **Validates: Requirements 1.12**

- [x] 6. Calendar color-coded status and task management (Feature 2)
  - [x] 6.1 Add `getTaskStatusColor` helper and apply to calendar task indicators
    - Implement `getTaskStatusColor(task, today)` returning green/red/amber Tailwind classes
    - Replace hardcoded color classes on task indicators in month/week/day calendar cells
    - Apply same color logic to SubTask indicators within expanded calendar cells
    - _Requirements: 2.6, 2.7_

  - [ ]* 6.2 Write property test for task status color-coding
    - **Property 9: Task status color-coding is correct**
    - **Validates: Requirements 2.6, 2.7**

  - [x] 6.3 Add inline add-task form for empty calendar date cells
    - When user clicks an empty date cell, show an inline form with the date pre-filled as `dueDate`
    - On submit, add task to state and persist to localStorage
    - _Requirements: 2.2, 2.3_

  - [x] 6.4 Add sub-task expansion and completion toggles in calendar cells
    - Reuse `expandedTasks` state and `toggleExpanded` handler for calendar cell sub-task lists
    - Add completion toggle for tasks and sub-tasks directly from calendar cells
    - _Requirements: 2.4, 2.5, 2.8, 2.9_

  - [ ]* 6.5 Write property test for calendar grouping by due date
    - **Property 8: Calendar groups tasks by due date**
    - **Validates: Requirements 2.1**

- [x] 7. Checkpoint — ensure calendar and sub-task tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Real-time notifications with toast fallback (Feature 7)
  - [x] 8.1 Implement `useNotifications` hook in `App.tsx`
    - Request `Notification.permission` on mount; skip if already granted/denied
    - Track dispatched keys in `useRef<Set<string>>` for session-level deduplication
    - Expose `notify(key, title, body)` that fires a browser notification or falls back to toast
    - Expose `toasts` state array and `dismissToast(id)` handler
    - Guard against `typeof Notification === 'undefined'`
    - _Requirements: 7.1, 7.2, 7.6, 7.8_

  - [ ]* 8.2 Write property test for notification deduplication
    - **Property 14: Notification deduplication within a session**
    - **Validates: Requirements 7.6**

  - [ ]* 8.3 Write property test for toast fallback
    - **Property 15: Toast fallback when Notifications API is unavailable**
    - **Validates: Requirements 7.8**

  - [x] 8.4 Wire timer-end notifications
    - In the `timeLeft === 0` effect, call `notify` with mode-specific title and body
    - Key format: `timer-end-{mode}-{YYYY-MM-DD}`
    - _Requirements: 7.3_

  - [x] 8.5 Wire due-today and overdue task notifications on page load
    - On mount (and when `tasks` changes), check each task's `dueDate` against today
    - Dispatch `due-today-{taskId}-{date}` notification for tasks due today
    - Dispatch `overdue-{taskId}-{date}` notification for overdue incomplete tasks
    - _Requirements: 7.4, 7.5_

  - [x] 8.6 Render toast overlay and notification status badge
    - Add fixed bottom-right toast overlay; auto-dismiss after 5 seconds with manual dismiss button
    - Show bell icon badge in header when `Notification.permission === 'granted'`
    - _Requirements: 7.7, 7.8_

- [x] 9. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All changes are confined to `src/App.tsx` and `public/` assets — no new source files
- Each task references specific requirements for traceability
- Property tests use vitest + fast-check (`npm install --save-dev vitest @testing-library/react @testing-library/user-event fast-check`)
- Notification deduplication keys are session-only (in-memory ref, not localStorage)
