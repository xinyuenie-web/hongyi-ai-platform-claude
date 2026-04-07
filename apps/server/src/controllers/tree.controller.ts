import { Request, Response } from 'express';
import { z } from 'zod';
import { Tree } from '../models/tree.model.js';
import { asyncHandler, NotFoundError } from '../middleware/error.js';
import type { ApiResponse, ITree } from '@hongyi/shared';

// Validation schemas
const treeQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  species: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  status: z.string().optional(),
  tags: z.string().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
});

const createTreeSchema = z.object({
  treeId: z.string().regex(/^HY\d{4}$/),
  name: z.string().min(1),
  species: z.string().min(1),
  age: z.number().optional(),
  specs: z.object({
    height: z.number().positive(),
    crown: z.number().positive(),
    trunkDiameter: z.number().optional(),
    rootBall: z.number().optional(),
  }),
  price: z.object({
    sale: z.number().positive(),
    excavation: z.number().optional(),
    packaging: z.number().optional(),
  }),
  coverImage: z.string().default(''),
  images: z.array(z.string()).default([]),
  video: z.string().optional(),
  fengshui: z
    .object({
      symbol: z.string(),
      positions: z.array(z.string()),
      element: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string()).default([]),
  location: z.string().optional(),
  status: z.enum(['available', 'reserved', 'sold', 'maintenance', 'archived']).default('available'),
});

/** GET /api/v1/trees - List trees with filtering and pagination */
export const listTrees = asyncHandler(async (req: Request, res: Response) => {
  const query = treeQuerySchema.parse(req.query);
  const { page, limit, species, minPrice, maxPrice, status, tags, search, sort } = query;

  // Build filter
  const filter: Record<string, any> = {};
  if (species) filter.species = species;
  if (status) filter.status = status;
  else filter.status = { $ne: 'archived' }; // Default: exclude archived
  if (minPrice || maxPrice) {
    filter['price.sale'] = {};
    if (minPrice) filter['price.sale'].$gte = minPrice;
    if (maxPrice) filter['price.sale'].$lte = maxPrice;
  }
  if (tags) filter.tags = { $in: tags.split(',') };
  if (search) filter.$text = { $search: search };

  // Build sort
  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort === 'price_asc') sortOption = { 'price.sale': 1 };
  else if (sort === 'price_desc') sortOption = { 'price.sale': -1 };
  else if (sort === 'newest') sortOption = { createdAt: -1 };
  else if (sort === 'name') sortOption = { name: 1 };

  const [trees, total] = await Promise.all([
    Tree.find(filter)
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Tree.countDocuments(filter),
  ]);

  const response: ApiResponse<ITree[]> = {
    success: true,
    data: trees as unknown as ITree[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
  res.json(response);
});

/** GET /api/v1/trees/:treeId - Get single tree */
export const getTree = asyncHandler(async (req: Request, res: Response) => {
  const tree = await Tree.findOne({ treeId: req.params.treeId }).lean();
  if (!tree) throw new NotFoundError('树木');

  const response: ApiResponse<ITree> = { success: true, data: tree as unknown as ITree };
  res.json(response);
});

/** POST /api/v1/trees - Create tree (admin) */
export const createTree = asyncHandler(async (req: Request, res: Response) => {
  const data = createTreeSchema.parse(req.body);
  const tree = await Tree.create(data);

  const response: ApiResponse<ITree> = { success: true, data: tree.toObject() as unknown as ITree };
  res.status(201).json(response);
});

/** PUT /api/v1/trees/:treeId - Update tree (admin) */
export const updateTree = asyncHandler(async (req: Request, res: Response) => {
  const tree = await Tree.findOneAndUpdate(
    { treeId: req.params.treeId },
    { $set: req.body },
    { new: true, runValidators: true },
  ).lean();
  if (!tree) throw new NotFoundError('树木');

  const response: ApiResponse<ITree> = { success: true, data: tree as unknown as ITree };
  res.json(response);
});

/** DELETE /api/v1/trees/:treeId - Soft delete (admin) */
export const deleteTree = asyncHandler(async (req: Request, res: Response) => {
  const tree = await Tree.findOneAndUpdate(
    { treeId: req.params.treeId },
    { $set: { status: 'archived' } },
    { new: true },
  ).lean();
  if (!tree) throw new NotFoundError('树木');

  const response: ApiResponse<null> = { success: true };
  res.json(response);
});

/** GET /api/v1/trees/meta/species - Get distinct species list */
export const getSpeciesList = asyncHandler(async (_req: Request, res: Response) => {
  const species = await Tree.distinct('species', { status: { $ne: 'archived' } });

  const response: ApiResponse<string[]> = { success: true, data: species };
  res.json(response);
});

/** GET /api/v1/trees/meta/stats - Get tree count by status */
export const getTreeStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await Tree.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const result = Object.fromEntries(stats.map((s) => [s._id, s.count]));

  const response: ApiResponse<Record<string, number>> = { success: true, data: result };
  res.json(response);
});
