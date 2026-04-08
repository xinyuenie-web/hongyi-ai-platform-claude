import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists (absolute path based on cwd)
const uploadsDir = path.join(process.cwd(), 'uploads', 'inquiries');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|heic)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 jpg/png/gif/webp/heic 图片格式'));
    }
  },
});

// Wrap multer to handle errors gracefully - still parse body even if file fails
export function uploadPhotos(req: any, res: any, next: any) {
  upload.array('photos', 5)(req, res, (err: any) => {
    if (err) {
      // Log but don't block - text fields should still be in req.body
      console.error('Upload error:', err.message);
    }
    next();
  });
}
