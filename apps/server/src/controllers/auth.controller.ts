import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Admin } from '../models/admin.model.js';
import { config } from '../config/index.js';
import { asyncHandler, AppError } from '../middleware/error.js';
import type { ApiResponse } from '@hongyi/shared';

/** POST /api/v1/auth/login */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    throw new AppError(400, 'MISSING_FIELDS', '请输入用户名和密码');
  }

  const admin = await Admin.findOne({ username });
  if (!admin || !(await admin.comparePassword(password))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', '用户名或密码错误');
  }

  const token = jwt.sign(
    { userId: admin._id.toString(), role: 'admin' as const },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );

  const response: ApiResponse<{ token: string; expiresIn: string }> = {
    success: true,
    data: { token, expiresIn: config.jwtExpiresIn },
  };
  res.json(response);
});
