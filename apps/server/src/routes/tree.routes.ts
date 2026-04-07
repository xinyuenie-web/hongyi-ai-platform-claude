import { Router } from 'express';
import {
  listTrees,
  getTree,
  createTree,
  updateTree,
  deleteTree,
  getSpeciesList,
  getTreeStats,
} from '../controllers/tree.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const treeRouter = Router();

// Public routes
treeRouter.get('/meta/species', getSpeciesList);
treeRouter.get('/meta/stats', getTreeStats);
treeRouter.get('/', listTrees);
treeRouter.get('/:treeId', getTree);

// Admin routes
treeRouter.post('/', requireAuth, createTree);
treeRouter.put('/:treeId', requireAuth, updateTree);
treeRouter.delete('/:treeId', requireAuth, deleteTree);
