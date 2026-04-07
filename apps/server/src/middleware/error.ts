import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@hongyi/shared';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource}不存在`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('Error:', err);

  // Custom AppError
  if (err instanceof AppError) {
    const response: ApiResponse<null> = {
      success: false,
      error: { code: err.code, message: err.message },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const response: ApiResponse<null> = {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message },
    };
    res.status(400).json(response);
    return;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    const response: ApiResponse<null> = {
      success: false,
      error: { code: 'INVALID_ID', message: '无效的ID格式' },
    };
    res.status(400).json(response);
    return;
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const response: ApiResponse<null> = {
      success: false,
      error: { code: 'DUPLICATE', message: '数据已存在' },
    };
    res.status(409).json(response);
    return;
  }

  // Default server error
  const response: ApiResponse<null> = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
    },
  };
  res.status(500).json(response);
}

/** Wrap async route handlers to catch errors */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
