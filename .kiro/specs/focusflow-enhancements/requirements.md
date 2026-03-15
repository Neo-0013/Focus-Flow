# Requirements Document

## Introduction

This document defines requirements for a set of enhancements to the FocusFlow productivity app — a React/TypeScript Pomodoro-style application. The enhancements cover sub-task UI completion, a calendar dashboard with task management and color-coded status, due date visibility across all views, favicon/PWA branding, custom timer durations, HTML title correction, and real-time task/break notifications.

## Glossary

- **App**: The FocusFlow React/TypeScript/Vite web application.
- **Task**: A top-level work item stored in localStorage with text, priority, due date, and sub-tasks.
- **SubTask**: A child work item nested under a Task, with its own completion state.
- **Timer**: The Pomodoro countdown component supporting Focus, Short Break, and Long Break modes.
- **Calendar_View**: The calendar dashboard showing tasks by due date.
- **Task_Dashboard**: The tasks list view where users manage tasks and sub-tasks.
- **Dashboard**: The main overview screen showing stats, heatmap, and active tasks.
- **Notification**: A browser Web Notification API alert shown to the user.
- **PWA**: Progressive Web App — the installable version of the App.
- **Favicon**: The icon displayed in browser tabs and on the device home screen when installed as a PWA.
- **Due_Date**: An ISO date string (YYYY-MM-DD) associated with a Task indicating when it must be completed.
- **Overdue**: A Task whose Due_Date is earlier than the current date and is not completed.
- **In_Progress**: A Task that has a Due_Date on or after the current date and is not completed.
- **Completed**: A Task or SubTask whose completed field is true.
- **Timer_Mode**: One of three states — Focus (work), Short Break (shortBreak), or Long Break (longBreak).

---

## Requirements

### Requirement 1: Sub-Task UI in Task Dashboard

**User Story:** As a user, I want to add, view, edit, reorder, and delete sub-tasks directly in the Task Dashboard, so that I can break down tasks into smaller steps without leaving the task list.

#### Acceptance Criteria

1. THE Task_Dashboard SHALL display a sub-task expansion toggle for every Task that has one or more SubTasks.
2. WHEN the user clicks the expansion toggle on a Task, THE Task_Dashboard SHALL reveal the list of SubTasks for that Task.
3. WHEN the user clicks the expansion toggle on an already-expanded Task, THE Task_Dashboard SHALL collapse the SubTask list.
4. THE Task_Dashboard SHALL display an inline input field for adding a new SubTask to any Task.
5. WHEN the user submits a non-empty SubTask text, THE Task_Dashboard SHALL append the new SubTask to the parent Task's subTasks array and persist it to localStorage.
6. IF the user submits an empty SubTask text, THEN THE Task_Dashboard SHALL not create a SubTask and SHALL keep the input field focused.
7. WHEN the user clicks the complete toggle on a SubTask, THE Task_Dashboard SHALL toggle the SubTask's completed state and update the completion progress indicator on the parent Task.
8. THE Task_Dashboard SHALL display a progress bar on each Task showing the ratio of completed SubTasks to total SubTasks as a percentage.
9. WHEN the user clicks the delete button on a SubTask, THE Task_Dashboard SHALL remove that SubTask from the parent Task and persist the change to localStorage.
10. WHEN the user clicks the edit button on a SubTask, THE Task_Dashboard SHALL display an inline editable text field pre-filled with the SubTask's current text.
11. WHEN the user saves a SubTask edit with non-empty text, THE Task_Dashboard SHALL update the SubTask text and persist the change to localStorage.
12. THE Task_Dashboard SHALL display reorder controls (up/down) on each SubTask to allow changing SubTask order within a parent Task.

---

### Requirement 2: Calendar Dashboard Task Management and Color-Coded Status

**User Story:** As a user, I want to manage tasks and sub-tasks from the Calendar View and see their completion status at a glance using color coding, so that I can plan and track work by date.

#### Acceptance Criteria

1. THE Calendar_View SHALL display all Tasks with a Due_Date on their corresponding calendar date cell.
2. WHEN the user clicks an empty date cell, THE Calendar_View SHALL display an inline form to add a new Task with that date pre-filled as the Due_Date.
3. WHEN the user submits a new Task from the Calendar_View, THE App SHALL add the Task to the tasks list and persist it to localStorage.
4. THE Calendar_View SHALL display each Task's SubTasks in an expandable section within the Task's calendar cell.
5. WHEN the user clicks the SubTask expansion toggle in a calendar cell, THE Calendar_View SHALL reveal or hide the SubTask list for that Task.
6. THE Calendar_View SHALL color-code each Task indicator using the following rules:
   - WHERE a Task is Completed, THE Calendar_View SHALL render the Task indicator in green.
   - WHERE a Task is Overdue (Due_Date is before today and not Completed), THE Calendar_View SHALL render the Task indicator in red.
   - WHERE a Task is In_Progress (Due_Date is today or in the future and not Completed), THE Calendar_View SHALL render the Task indicator in yellow.
7. THE Calendar_View SHALL apply the same color-coding rules to SubTask indicators within expanded Task cells.
8. WHEN the user toggles a Task's completion state from the Calendar_View, THE App SHALL update the Task's completed field and persist the change to localStorage.
9. WHEN the user toggles a SubTask's completion state from the Calendar_View, THE App SHALL update the SubTask's completed field and persist the change to localStorage.

---

### Requirement 3: Due Date Visibility Across All Views

**User Story:** As a user, I want to see due dates on tasks in every view of the app, so that I always know when tasks are due without switching screens.

#### Acceptance Criteria

1. THE Task_Dashboard SHALL display the Due_Date of each Task that has one set, formatted as a human-readable date string (e.g., "Jan 15").
2. THE Dashboard SHALL display the Due_Date of each Task shown in the Active Tasks section.
3. THE Timer SHALL display the Due_Date of each Task shown in the task list panel.
4. THE Calendar_View SHALL display the Due_Date on each Task card within its date cell.
5. WHEN a Task's Due_Date is in the past and the Task is not Completed, THE App SHALL render the due date label in red across all views.
6. WHEN a Task's Due_Date is today and the Task is not Completed, THE App SHALL render the due date label in amber across all views.
7. WHEN a Task's Due_Date is in the future and the Task is not Completed, THE App SHALL render the due date label in the default muted color across all views.
8. THE Task_Dashboard SHALL provide a date picker input to set or update the Due_Date on an existing Task.

---

### Requirement 4: Favicon and PWA Branding

**User Story:** As a user, I want FocusFlow to display its own favicon in the browser tab and on my device home screen when installed as a PWA, so that the app is visually identifiable.

#### Acceptance Criteria

1. THE App SHALL display a FocusFlow-branded favicon in the browser tab (replacing the default Vite favicon).
2. THE App SHALL include a web app manifest file (`manifest.json`) declaring the app name as "FocusFlow", short name as "FocusFlow", and referencing icon assets.
3. THE App SHALL include icon assets at minimum sizes of 192×192px and 512×512px for PWA installation.
4. WHEN a user installs the App as a PWA, THE App SHALL display the FocusFlow icon on the device home screen or app launcher.
5. THE App SHALL set `theme_color` and `background_color` in the manifest to match the app's dark background (`#050505`).
6. THE App SHALL include an Apple touch icon for iOS home screen installation.

---

### Requirement 5: Custom Timer Durations

**User Story:** As a user, I want to set custom durations for Focus, Short Break, and Long Break timer modes, so that I can adapt the Pomodoro technique to my personal workflow.

#### Acceptance Criteria

1. THE Timer SHALL display the current configured duration for each Timer_Mode (Focus, Short Break, Long Break) in the settings panel.
2. WHEN the user opens the settings panel, THE App SHALL display numeric input fields for Focus duration (in minutes), Short Break duration (in minutes), and Long Break duration (in minutes).
3. WHEN the user saves a custom duration value that is a positive integer between 1 and 120 (inclusive), THE Timer SHALL use that value as the duration for the corresponding Timer_Mode.
4. IF the user enters a duration value outside the range of 1 to 120, THEN THE App SHALL display a validation error message and SHALL NOT update the Timer_Mode duration.
5. WHEN the user saves custom durations, THE App SHALL persist the values to localStorage so they are restored on next page load.
6. WHEN custom durations are loaded from localStorage on startup, THE Timer SHALL initialize each Timer_Mode with the stored custom duration.
7. WHEN the user resets a Timer_Mode duration to default, THE Timer SHALL restore the original default values (Focus: 25 min, Short Break: 5 min, Long Break: 15 min).

---

### Requirement 6: App Title Correction

**User Story:** As a user, I want the browser tab and PWA title to read "FocusFlow" instead of "My Google AI Studio App", so that the app is correctly identified in the browser and on my device.

#### Acceptance Criteria

1. THE App SHALL set the HTML `<title>` element in `index.html` to "FocusFlow".
2. THE App SHALL set the `name` field in the PWA manifest to "FocusFlow".
3. THE App SHALL set the `short_name` field in the PWA manifest to "FocusFlow".
4. WHEN the App is installed as a PWA, THE App SHALL display "FocusFlow" as the application name in the device app launcher.

---

### Requirement 7: Real-Time Notifications

**User Story:** As a user, I want to receive real-time notifications when a task is due, when a task needs attention, or when a timer session ends, so that I stay on track without constantly watching the screen.

#### Acceptance Criteria

1. WHEN the App loads for the first time, THE App SHALL request browser notification permission from the user via the Web Notifications API.
2. IF the user denies notification permission, THEN THE App SHALL continue to function normally without notifications and SHALL NOT request permission again in the same session.
3. WHEN a Timer_Mode countdown reaches zero, THE App SHALL dispatch a browser notification with a title of "FocusFlow" and a body message indicating which session ended (e.g., "Focus session complete — time for a break!" or "Break time is over — back to focus!").
4. WHEN the current date matches a Task's Due_Date and the Task is not Completed, THE App SHALL dispatch a browser notification at the start of the day (on page load if not already sent that day) with the Task name and due date.
5. WHEN a Task becomes Overdue (the current date passes the Task's Due_Date and the Task is not Completed), THE App SHALL dispatch a browser notification indicating the Task is overdue.
6. THE App SHALL not dispatch duplicate notifications for the same event within the same browser session.
7. WHERE the user has granted notification permission, THE App SHALL display a notification icon or badge in the UI to indicate notifications are active.
8. IF the browser does not support the Web Notifications API, THEN THE App SHALL fall back to displaying an in-app toast or banner message for timer completion events.
