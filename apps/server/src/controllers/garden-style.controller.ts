import { Request, Response } from 'express';
import { GardenStyle } from '../models/garden-style.model.js';
import { asyncHandler, NotFoundError } from '../middleware/error.js';
import type { ApiResponse, IGardenStyleConfig } from '@hongyi/shared';

/** GET /api/v1/garden-styles - List all garden styles */
export const listStyles = asyncHandler(async (_req: Request, res: Response) => {
  const styles = await GardenStyle.find().sort({ styleId: 1 }).lean();

  const response: ApiResponse<IGardenStyleConfig[]> = {
    success: true,
    data: styles as unknown as IGardenStyleConfig[],
  };
  res.json(response);
});

/** GET /api/v1/garden-styles/:styleId - Get single style */
export const getStyle = asyncHandler(async (req: Request, res: Response) => {
  const style = await GardenStyle.findOne({ styleId: req.params.styleId }).lean();
  if (!style) throw new NotFoundError('庭院风格');

  const response: ApiResponse<IGardenStyleConfig> = {
    success: true,
    data: style as unknown as IGardenStyleConfig,
  };
  res.json(response);
});
