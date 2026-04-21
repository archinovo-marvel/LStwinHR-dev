const contentTypeMap = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

const getContentType = (filename) => {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return contentTypeMap[ext] || 'application/octet-stream';
};

module.exports = { contentTypeMap, getContentType };
