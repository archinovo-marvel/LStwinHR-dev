'use strict';

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const TEMP_UPLOAD_DIR = process.env.TEMP_UPLOAD_DIR
  ? path.resolve(process.env.TEMP_UPLOAD_DIR)
  : path.join(__dirname, '..', '..', 'uploads', 'tmp');

async function ensureTempUploadDir() {
  try {
    await fsPromises.access(TEMP_UPLOAD_DIR);
  } catch {
    await fsPromises.mkdir(TEMP_UPLOAD_DIR, { recursive: true });
  }
}

function createDiskUpload({ fileSize, allowedTypes, errorMessage }) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      ensureTempUploadDir().then(() => {
        cb(null, TEMP_UPLOAD_DIR);
      }).catch(error => {
        cb(error);
      });
    },
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname || '').toLowerCase();
      const uniqueSuffix = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      cb(null, `${Date.now()}-${uniqueSuffix}${extension}`);
    }
  });

  return multer({
    storage,
    limits: {
      fileSize
    },
    fileFilter: (req, file, cb) => {
      const extension = path.extname(file.originalname || '').toLowerCase();
      if (allowedTypes.includes(extension)) {
        cb(null, true);
        return;
      }
      cb(new Error(errorMessage));
    }
  });
}

async function loadUploadedFileBuffer(file) {
  if (!file) {
    return null;
  }

  if (Buffer.isBuffer(file.buffer)) {
    return file.buffer;
  }

  if (file.path) {
    return fsPromises.readFile(file.path);
  }

  throw new Error('上传文件内容不可用');
}

async function cleanupUploadedFile(file) {
  if (!file?.path) {
    return;
  }

  await fsPromises.unlink(file.path).catch(() => {});
}

function createMemoryUpload({ fileSize, allowedTypes, errorMessage }) {
  const storage = multer.memoryStorage();

  return multer({
    storage,
    limits: { fileSize },
    fileFilter: (req, file, cb) => {
      const extension = path.extname(file.originalname || '').toLowerCase();
      if (allowedTypes.includes(extension)) {
        cb(null, true);
        return;
      }
      cb(new Error(errorMessage));
    }
  });
}

/**
 * Factory: selects memoryStorage or diskStorage based on UPLOAD_STORAGE_MODE env var.
 * - 'memory' (default): files kept in memory as Buffer — avoids disk I/O bottleneck
 *   under high concurrency (no temp file writes, no rename dance).
 * - 'disk': legacy behavior, files written to uploads/tmp/ by Multer.
 */
function createUpload(opts) {
  const mode = process.env.UPLOAD_STORAGE_MODE || 'memory';
  if (mode === 'disk') {
    return createDiskUpload(opts);
  }
  return createMemoryUpload(opts);
}

module.exports = {
  TEMP_UPLOAD_DIR,
  createDiskUpload,
  createMemoryUpload,
  createUpload,
  loadUploadedFileBuffer,
  cleanupUploadedFile
};