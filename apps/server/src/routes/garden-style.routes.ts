import { Router } from 'express';
import { listStyles, getStyle } from '../controllers/garden-style.controller.js';

export const gardenStyleRouter = Router();

gardenStyleRouter.get('/', listStyles);
gardenStyleRouter.get('/:styleId', getStyle);
