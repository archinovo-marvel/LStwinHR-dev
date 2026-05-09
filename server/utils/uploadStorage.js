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
      try {
        ensureTempUploadDir();
        cb(null, TEMP_UPLOAD_DIR);
      } catch (error) {
        cb(error);
      }
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

module.exports = {
  TEMP_UPLOAD_DIR,
  createDiskUpload,
  loadUploadedFileBuffer,
  cleanupUploadedFile
};