import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

const allowedMimeTypes = new Set(config.upload.allowedMimeTypes.split(',').map((t) => t.trim()));

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
  if (allowedMimeTypes.has(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn('Rejected file upload with disallowed MIME type', {
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    cb(new Error(`File type ${file.mimetype} is not allowed. Accepted types: ${Array.from(allowedMimeTypes).join(', ')}`));
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxFileSizeMb * 1024 * 1024,
    files: 10,
  },
  fileFilter,
});

export const singleUpload = upload.single('file');
export const multiUpload = upload.array('files', 10);
