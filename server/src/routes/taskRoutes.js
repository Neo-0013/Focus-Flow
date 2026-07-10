import express from 'express';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getActivity,
  archiveCompletedTasks
} from '../controllers/taskController.js';

const router = express.Router();

router.get('/tasks', getTasks);
router.post('/tasks', createTask);
router.patch('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);
router.post('/tasks/archive-completed', archiveCompletedTasks);
router.get('/activity', getActivity);

export default router;
