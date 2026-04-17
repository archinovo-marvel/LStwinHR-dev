const crypto = require('crypto');
const { dbConfig, pool } = require('../db');
const {
  getDefaultPositionProfiles,
  normalizePositionConfig,
  buildPositionDescription
} = require('./resume/positionConfig');

const DEFAULT_DB_PREFIX = process.env.CANDIDATE_DB_PREFIX || 'lstwin_candidates_user_';
const initPromises = new Map();

const LIST_COLUMNS = [
  'id',
  'owner_user_id',
  'owner_user_name',
  'owner_user_email',
  'submission_source',
  'name',
  'position',
  'position_description',
  'position_profile',
  'phone',
  'email',
  'mbti',
  'submit_time',
  'status',
  'resume_file_name',
  'resume_original_name',
  'resume_mime_type',
  'resume_size',
  'resume_analysis',
  'resume_analysis_meta',
  'analysis_details',
  'resume_analysis_result',
  'recommendation',
  'mbti_score',
  'resume_score',
  'match_score',
  'final_score',
  'has_interview',
  'interview_score',
  'interview_details',
  'interview_date',
  'interview_records',
  'latest_interview_record',
  'created_at',
  'updated_at'
].join(', ');

const POSITION_LIST_COLUMNS = [
  'id',
  'owner_user_id',
  'name',
  'description',
  'config',
  'created_at',
  'updated_at'
].join(', ');

function normalizeUserId(userId) {
  const normalized = Number(userId);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new Error('无效的用户ID，无法访问候选人数据库');
  }
  return normalized;
}

function getCandidateDatabaseName(userId) {
  return `${DEFAULT_DB_PREFIX}${normalizeUserId(userId)}`;
}

function getCandidateTableName(userId) {
  return `${getCandidateDatabaseName(userId)}_candidates`;
}

function getInterviewSessionTableName(userId) {
  return `${getCandidateDatabaseName(userId)}_interview_sessions`;
}

function getPositionTableName(userId) {
  return `${getCandidateDatabaseName(userId)}_positions`;
}

function escapeIdentifier(identifier) {
  return `\`${String(identifier).replace(/`/g, '``')}\``;
}

function parseJsonValue(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function serializeJsonValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return JSON.stringify(value);
}

function toDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? null : next;
}

function toIsoString(value) {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : null;
}

function inferResumeMimeType(candidate) {
  if (candidate?.resumeMimeType) {
    return candidate.resumeMimeType;
  }

  const fileName = candidate?.resumeOriginalName || candidate?.resumeFileName || '';
  const lowerName = String(fileName).toLowerCase();

  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  if (lowerName.endsWith('.doc')) return 'application/msword';
  if (lowerName.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.png')) return 'image/png';

  return 'application/octet-stream';
}

function buildResumePointer(candidateId) {
  return candidateId ? `db://candidate/${candidateId}/resume` : null;
}

function buildCreateCandidateTableSql(tableName) {
  return `
    CREATE TABLE IF NOT EXISTS ${escapeIdentifier(tableName)} (
      id BIGINT NOT NULL PRIMARY KEY,
      owner_user_id BIGINT NOT NULL,
      owner_user_name VARCHAR(255) NULL,
      owner_user_email VARCHAR(255) NULL,
      submission_source VARCHAR(64) NULL,
      name VARCHAR(255) NOT NULL,
      position VARCHAR(255) NOT NULL,
      position_description TEXT NULL,
      position_profile LONGTEXT NULL,
      phone VARCHAR(64) NOT NULL,
      email VARCHAR(255) NOT NULL,
      mbti VARCHAR(32) NULL,
      submit_time VARCHAR(128) NULL,
      status VARCHAR(64) NULL,
      resume_file_name VARCHAR(512) NULL,
      resume_original_name VARCHAR(512) NULL,
      resume_mime_type VARCHAR(255) NULL,
      resume_size BIGINT NOT NULL DEFAULT 0,
      resume_file_blob LONGBLOB NULL,
      resume_analysis LONGTEXT NULL,
      resume_analysis_meta LONGTEXT NULL,
      analysis_details LONGTEXT NULL,
      resume_analysis_result LONGTEXT NULL,
      recommendation TEXT NULL,
      mbti_score DECIMAL(10, 2) NULL,
      resume_score DECIMAL(10, 2) NULL,
      match_score DECIMAL(10, 2) NULL,
      final_score DECIMAL(10, 2) NULL,
      has_interview TINYINT(1) NOT NULL DEFAULT 0,
      interview_score DECIMAL(10, 2) NULL,
      interview_details LONGTEXT NULL,
      interview_date VARCHAR(128) NULL,
      interview_records LONGTEXT NULL,
      latest_interview_record LONGTEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      KEY idx_created_at (created_at),
      KEY idx_name (name),
      KEY idx_email (email),
      KEY idx_phone (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
}

function buildCreateInterviewSessionTableSql(tableName) {
  return `
    CREATE TABLE IF NOT EXISTS ${escapeIdentifier(tableName)} (
      id BIGINT NOT NULL PRIMARY KEY,
      owner_user_id BIGINT NOT NULL,
      candidate_id BIGINT NULL,
      candidate_name VARCHAR(255) NULL,
      position VARCHAR(255) NULL,
      status VARCHAR(64) NOT NULL,
      conversation LONGTEXT NULL,
      scoring LONGTEXT NULL,
      metadata LONGTEXT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      KEY idx_status (status),
      KEY idx_candidate_id (candidate_id),
      KEY idx_start_time (start_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
}

function buildCreatePositionTableSql(tableName) {
  return `
    CREATE TABLE IF NOT EXISTS ${escapeIdentifier(tableName)} (
      id BIGINT NOT NULL PRIMARY KEY,
      owner_user_id BIGINT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      config LONGTEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      UNIQUE KEY uk_name (name),
      KEY idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
}

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [dbConfig.database, tableName, columnName]
  );

  return rows.length > 0;
}

async function ensureTableColumn(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) {
    return;
  }

  await pool.query(
    `ALTER TABLE ${escapeIdentifier(tableName)} ADD COLUMN ${escapeIdentifier(columnName)} ${definition}`
  );
}

function mapRowToCandidate(row, options = {}) {
  const includeBlob = Boolean(options.includeBlob);
  const hasResumeBlob = includeBlob
    ? Buffer.isBuffer(row.resume_file_blob) && row.resume_file_blob.length > 0
    : Number(row.resume_size) > 0;
  const positionProfile = parseJsonValue(row.position_profile, null);

  return {
    id: Number(row.id),
    ownerUserId: Number(row.owner_user_id),
    ownerUserName: row.owner_user_name || '',
    ownerUserEmail: row.owner_user_email || '',
    submissionSource: row.submission_source || null,
    name: row.name || '',
    position: row.position || '',
    positionDescription: row.position_description || '',
    phone: row.phone || '',
    email: row.email || '',
    positionProfile: positionProfile
      ? {
          ...positionProfile,
          config: normalizePositionConfig(positionProfile.config || {})
        }
      : null,
    mbti: row.mbti || '',
    submitTime: row.submit_time || '',
    status: row.status || '已提交',
    resumeFileName: row.resume_file_name || null,
    resumeOriginalName: row.resume_original_name || null,
    resumeMimeType: row.resume_mime_type || null,
    resumeSize: Number(row.resume_size) || 0,
    resumeFilePath: hasResumeBlob ? buildResumePointer(row.id) : null,
    resumeFileBuffer: includeBlob && Buffer.isBuffer(row.resume_file_blob) ? row.resume_file_blob : null,
    resumeAnalysis: parseJsonValue(row.resume_analysis, null),
    resumeAnalysisMeta: parseJsonValue(row.resume_analysis_meta, null),
    analysisDetails: parseJsonValue(row.analysis_details, null),
    resumeAnalysisResult: parseJsonValue(row.resume_analysis_result, null),
    recommendation: row.recommendation || null,
    mbtiScore: row.mbti_score === null || row.mbti_score === undefined ? null : Number(row.mbti_score),
    resumeScore: row.resume_score === null || row.resume_score === undefined ? null : Number(row.resume_score),
    matchScore: row.match_score === null || row.match_score === undefined ? null : Number(row.match_score),
    finalScore: row.final_score === null || row.final_score === undefined ? null : Number(row.final_score),
    hasInterview: Boolean(row.has_interview),
    interviewScore: row.interview_score === null || row.interview_score === undefined ? null : Number(row.interview_score),
    interviewDetails: parseJsonValue(row.interview_details, null),
    interviewDate: row.interview_date || null,
    interviewRecords: parseJsonValue(row.interview_records, []),
    latestInterviewRecord: parseJsonValue(row.latest_interview_record, null),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapCandidateToRow(candidate) {
  const now = new Date();
  const createdAt = toDate(candidate.createdAt) || now;
  const updatedAt = toDate(candidate.updatedAt) || now;
  const resumeBuffer = Buffer.isBuffer(candidate.resumeFileBuffer) ? candidate.resumeFileBuffer : null;

  return {
    id: Number(candidate.id),
    ownerUserId: normalizeUserId(candidate.ownerUserId),
    ownerUserName: candidate.ownerUserName || '',
    ownerUserEmail: candidate.ownerUserEmail || '',
    submissionSource: candidate.submissionSource || null,
    name: candidate.name || '',
    position: candidate.position || '',
    positionDescription: candidate.positionDescription || '',
    phone: candidate.phone || '',
    email: candidate.email || '',
    positionProfile: serializeJsonValue(candidate.positionProfile),
    mbti: candidate.mbti || '',
    submitTime: candidate.submitTime || '',
    status: candidate.status || '已提交',
    resumeFileName: candidate.resumeFileName || null,
    resumeOriginalName: candidate.resumeOriginalName || null,
    resumeMimeType: inferResumeMimeType(candidate),
    resumeSize: Number(candidate.resumeSize) || 0,
    resumeFileBlob: resumeBuffer,
    resumeAnalysis: serializeJsonValue(candidate.resumeAnalysis),
    resumeAnalysisMeta: serializeJsonValue(candidate.resumeAnalysisMeta),
    analysisDetails: serializeJsonValue(candidate.analysisDetails),
    resumeAnalysisResult: serializeJsonValue(candidate.resumeAnalysisResult),
    recommendation: candidate.recommendation || null,
    mbtiScore: candidate.mbtiScore === null || candidate.mbtiScore === undefined ? null : Number(candidate.mbtiScore),
    resumeScore: candidate.resumeScore === null || candidate.resumeScore === undefined ? null : Number(candidate.resumeScore),
    matchScore: candidate.matchScore === null || candidate.matchScore === undefined ? null : Number(candidate.matchScore),
    finalScore: candidate.finalScore === null || candidate.finalScore === undefined ? null : Number(candidate.finalScore),
    hasInterview: candidate.hasInterview ? 1 : 0,
    interviewScore: candidate.interviewScore === null || candidate.interviewScore === undefined ? null : Number(candidate.interviewScore),
    interviewDetails: serializeJsonValue(candidate.interviewDetails),
    interviewDate: candidate.interviewDate || null,
    interviewRecords: serializeJsonValue(candidate.interviewRecords || []),
    latestInterviewRecord: serializeJsonValue(candidate.latestInterviewRecord),
    createdAt,
    updatedAt
  };
}

function mapRowToInterviewSession(row) {
  return {
    id: Number(row.id),
    ownerUserId: Number(row.owner_user_id),
    candidateId: row.candidate_id === null || row.candidate_id === undefined ? null : Number(row.candidate_id),
    candidateName: row.candidate_name || '',
    position: row.position || '',
    startTime: toIsoString(row.start_time),
    endTime: toIsoString(row.end_time),
    status: row.status || 'in_progress',
    conversation: parseJsonValue(row.conversation, {
      questions: [],
      candidateAnswers: [],
      aiReplies: [],
      timestamps: []
    }),
    scoring: parseJsonValue(row.scoring, null),
    metadata: parseJsonValue(row.metadata, {
      totalQuestions: 0,
      totalAnswers: 0,
      averageAnswerLength: 0,
      sessionDuration: 0
    }),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapInterviewSessionToRow(session) {
  const now = new Date();
  return {
    id: Number(session.id),
    ownerUserId: normalizeUserId(session.ownerUserId),
    candidateId: session.candidateId === null || session.candidateId === undefined ? null : Number(session.candidateId),
    candidateName: session.candidateName || '',
    position: session.position || '',
    status: session.status || 'in_progress',
    conversation: serializeJsonValue(session.conversation || {
      questions: [],
      candidateAnswers: [],
      aiReplies: [],
      timestamps: []
    }),
    scoring: serializeJsonValue(session.scoring),
    metadata: serializeJsonValue(session.metadata || {
      totalQuestions: 0,
      totalAnswers: 0,
      averageAnswerLength: 0,
      sessionDuration: 0
    }),
    startTime: toDate(session.startTime) || now,
    endTime: toDate(session.endTime),
    createdAt: toDate(session.createdAt) || now,
    updatedAt: toDate(session.updatedAt) || now
  };
}

function mapRowToPosition(row) {
  return {
    id: Number(row.id),
    ownerUserId: Number(row.owner_user_id),
    name: row.name || '',
    description: row.description || '',
    config: normalizePositionConfig(parseJsonValue(row.config, {})),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapPositionToRow(position) {
  const now = new Date();

  return {
    id: Number(position.id),
    ownerUserId: normalizeUserId(position.ownerUserId),
    name: String(position.name || '').trim(),
    description: String(position.description || '').trim(),
    config: serializeJsonValue(normalizePositionConfig(position.config)),
    createdAt: toDate(position.createdAt) || now,
    updatedAt: toDate(position.updatedAt) || now
  };
}

function areSameJsonShape(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isPureAutoSeedPositionSet(currentPositions) {
  const defaultProfiles = getDefaultPositionProfiles().sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  const sortedCurrentPositions = [...currentPositions].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

  if (sortedCurrentPositions.length !== defaultProfiles.length) {
    return false;
  }

  return sortedCurrentPositions.every((position, index) => {
    const profile = defaultProfiles[index];
    if (!profile || position.name !== profile.name) {
      return false;
    }

    return position.description === profile.description &&
      areSameJsonShape(position.config, profile.config);
  });
}

async function cleanupAutoSeededPositions(userId) {
  const tableName = escapeIdentifier(getPositionTableName(userId));
  const [rows] = await pool.query(
    `SELECT ${POSITION_LIST_COLUMNS} FROM ${tableName} ORDER BY created_at ASC, id ASC`
  );

  if (!rows.length) {
    return;
  }

  const currentPositions = rows.map(mapRowToPosition);

  if (!isPureAutoSeedPositionSet(currentPositions)) {
    return;
  }

  await pool.query(`DELETE FROM ${tableName}`);
}

async function ensureCandidateDatabase(userId) {
  const normalizedUserId = normalizeUserId(userId);
  const logicalName = getCandidateDatabaseName(normalizedUserId);

  if (!initPromises.has(logicalName)) {
    initPromises.set(logicalName, (async () => {
      const candidateTableName = getCandidateTableName(normalizedUserId);
      const interviewSessionTableName = getInterviewSessionTableName(normalizedUserId);
      const positionTableName = getPositionTableName(normalizedUserId);

      await pool.query(buildCreateCandidateTableSql(candidateTableName));
      await pool.query(buildCreateInterviewSessionTableSql(interviewSessionTableName));
      await pool.query(buildCreatePositionTableSql(positionTableName));
      await ensureTableColumn(candidateTableName, 'position_description', 'TEXT NULL AFTER position');
      await ensureTableColumn(candidateTableName, 'position_profile', 'LONGTEXT NULL AFTER position_description');
      await cleanupAutoSeededPositions(normalizedUserId);

      return {
        logicalDatabaseName: logicalName,
        candidateTableName,
        interviewSessionTableName,
        positionTableName
      };
    })().finally(() => {
      initPromises.delete(logicalName);
    }));
  }

  return initPromises.get(logicalName);
}

function generateCandidateId() {
  return Number(`${Date.now()}${crypto.randomInt(100, 999)}`);
}

function generatePositionId() {
  return Number(`${Date.now()}${crypto.randomInt(100, 999)}`);
}

async function listCandidatesForUser(userId) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const tableName = escapeIdentifier(getCandidateTableName(normalizedUserId));
  const [rows] = await pool.query(
    `SELECT ${LIST_COLUMNS} FROM ${tableName} ORDER BY created_at DESC, id DESC`
  );

  return rows.map(row => mapRowToCandidate(row));
}

async function getCandidateById(userId, candidateId, options = {}) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const includeBlob = Boolean(options.includeBlob);
  const tableName = escapeIdentifier(getCandidateTableName(normalizedUserId));
  const columns = includeBlob ? `resume_file_blob, ${LIST_COLUMNS}` : LIST_COLUMNS;
  const [rows] = await pool.query(
    `SELECT ${columns} FROM ${tableName} WHERE id = ? LIMIT 1`,
    [Number(candidateId)]
  );

  if (!rows.length) {
    return null;
  }

  return mapRowToCandidate(rows[0], { includeBlob });
}

async function findCandidateBySnapshot(userId, snapshot) {
  if (!snapshot) {
    return null;
  }

  const candidates = await listCandidatesForUser(userId);
  return candidates.find(candidate => {
    const sameId = Number(candidate.id) === Number(snapshot.id);
    const sameName = candidate.name && snapshot.name && candidate.name === snapshot.name;
    const samePhone = candidate.phone && snapshot.phone && candidate.phone === snapshot.phone;
    const sameEmail = candidate.email && snapshot.email && candidate.email === snapshot.email;
    return sameId || (sameName && (samePhone || sameEmail));
  }) || null;
}

async function upsertCandidateForUser(userId, candidate) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const tableName = escapeIdentifier(getCandidateTableName(normalizedUserId));
  const row = mapCandidateToRow(candidate);

  await pool.query(
    `INSERT INTO ${tableName} (
      id, owner_user_id, owner_user_name, owner_user_email, submission_source,
      name, position, position_description, position_profile, phone, email, mbti, submit_time, status,
      resume_file_name, resume_original_name, resume_mime_type, resume_size, resume_file_blob,
      resume_analysis, resume_analysis_meta, analysis_details, resume_analysis_result,
      recommendation, mbti_score, resume_score, match_score, final_score,
      has_interview, interview_score, interview_details, interview_date,
      interview_records, latest_interview_record, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
    ON DUPLICATE KEY UPDATE
      owner_user_id = VALUES(owner_user_id),
      owner_user_name = VALUES(owner_user_name),
      owner_user_email = VALUES(owner_user_email),
      submission_source = VALUES(submission_source),
      name = VALUES(name),
      position = VALUES(position),
      position_description = VALUES(position_description),
      position_profile = VALUES(position_profile),
      phone = VALUES(phone),
      email = VALUES(email),
      mbti = VALUES(mbti),
      submit_time = VALUES(submit_time),
      status = VALUES(status),
      resume_file_name = VALUES(resume_file_name),
      resume_original_name = VALUES(resume_original_name),
      resume_mime_type = VALUES(resume_mime_type),
      resume_size = VALUES(resume_size),
      resume_file_blob = COALESCE(VALUES(resume_file_blob), resume_file_blob),
      resume_analysis = VALUES(resume_analysis),
      resume_analysis_meta = VALUES(resume_analysis_meta),
      analysis_details = VALUES(analysis_details),
      resume_analysis_result = VALUES(resume_analysis_result),
      recommendation = VALUES(recommendation),
      mbti_score = VALUES(mbti_score),
      resume_score = VALUES(resume_score),
      match_score = VALUES(match_score),
      final_score = VALUES(final_score),
      has_interview = VALUES(has_interview),
      interview_score = VALUES(interview_score),
      interview_details = VALUES(interview_details),
      interview_date = VALUES(interview_date),
      interview_records = VALUES(interview_records),
      latest_interview_record = VALUES(latest_interview_record),
      updated_at = VALUES(updated_at)`,
    [
      row.id,
      row.ownerUserId,
      row.ownerUserName,
      row.ownerUserEmail,
      row.submissionSource,
      row.name,
      row.position,
      row.positionDescription,
      row.positionProfile,
      row.phone,
      row.email,
      row.mbti,
      row.submitTime,
      row.status,
      row.resumeFileName,
      row.resumeOriginalName,
      row.resumeMimeType,
      row.resumeSize,
      row.resumeFileBlob,
      row.resumeAnalysis,
      row.resumeAnalysisMeta,
      row.analysisDetails,
      row.resumeAnalysisResult,
      row.recommendation,
      row.mbtiScore,
      row.resumeScore,
      row.matchScore,
      row.finalScore,
      row.hasInterview,
      row.interviewScore,
      row.interviewDetails,
      row.interviewDate,
      row.interviewRecords,
      row.latestInterviewRecord,
      row.createdAt,
      row.updatedAt
    ]
  );

  return getCandidateById(normalizedUserId, row.id, { includeBlob: true });
}

async function getCandidateByIdGlobal(candidateId, options = {}) {
  const [tables] = await pool.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'lstwin_candidates_user_%_candidates'"
  );
  
  for (const { TABLE_NAME } of tables) {
    const tableName = escapeIdentifier(TABLE_NAME);
    const [rows] = await pool.query(
      `SELECT owner_user_id FROM ${tableName} WHERE id = ? LIMIT 1`,
      [Number(candidateId)]
    );
    
    if (rows.length > 0) {
      const userId = rows[0].owner_user_id;
      console.log(`[getCandidateByIdGlobal] 找到候选人, userId=${userId}, candidateId=${candidateId}, options=`, options);
      const result = await getCandidateById(userId, candidateId, options);
      console.log(`[getCandidateByIdGlobal] 获取结果:`, {
        found: !!result,
        hasBuffer: result ? !!result.resumeFileBuffer : false,
        bufferSize: result && result.resumeFileBuffer ? result.resumeFileBuffer.length : 0
      });
      return result;
    }
  }
  
  console.log(`[getCandidateByIdGlobal] 未找到候选人, candidateId=${candidateId}`);
  return null;
}

async function updateCandidateById(candidateId, updateData) {
  const [tables] = await pool.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'lstwin_candidates_user_%_candidates'"
  );
  
  for (const { TABLE_NAME } of tables) {
    const tableName = escapeIdentifier(TABLE_NAME);
    const [rows] = await pool.query(
      `SELECT owner_user_id FROM ${tableName} WHERE id = ? LIMIT 1`,
      [Number(candidateId)]
    );
    
    if (rows.length > 0) {
      const userId = rows[0].owner_user_id;
      const normalizedUserId = normalizeUserId(userId);
      await ensureCandidateDatabase(normalizedUserId);
      
      const setClauses = [];
      const values = [];
      
      const fieldMapping = {
        status: 'status',
        recommendation: 'recommendation',
        resumeAnalysis: 'resume_analysis',
        resumeAnalysisResult: 'resume_analysis_result',
        matchScore: 'match_score',
        mbtiScore: 'mbti_score',
        resumeScore: 'resume_score',
        finalScore: 'final_score',
        name: 'name',
        position: 'position',
        phone: 'phone',
        email: 'email',
        mbti: 'mbti',
        hasInterview: 'has_interview',
        interviewScore: 'interview_score',
        interviewDetails: 'interview_details',
        interviewDate: 'interview_date',
        interviewRecords: 'interview_records',
        latestInterviewRecord: 'latest_interview_record'
      };
      
      const jsonFields = ['interviewDetails', 'interviewRecords', 'latestInterviewRecord', 'resumeAnalysisResult', 'resumeAnalysis'];
      
      for (const [key, value] of Object.entries(updateData)) {
        if (fieldMapping[key]) {
          setClauses.push(`${fieldMapping[key]} = ?`);
          if (jsonFields.includes(key) && value !== null && value !== undefined) {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
        }
      }
      
      if (setClauses.length === 0) {
        return null;
      }
      
      setClauses.push('updated_at = ?');
      values.push(new Date());
      values.push(Number(candidateId));
      
      await pool.query(
        `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = ?`,
        values
      );
      
      return getCandidateById(userId, candidateId);
    }
  }
  
  return null;
}

async function deleteCandidateById(userId, candidateId) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const tableName = escapeIdentifier(getCandidateTableName(normalizedUserId));
  const [result] = await pool.query(`DELETE FROM ${tableName} WHERE id = ?`, [Number(candidateId)]);
  return result.affectedRows;
}

async function clearCandidatesForUser(userId) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const tableName = escapeIdentifier(getCandidateTableName(normalizedUserId));
  const [result] = await pool.query(`DELETE FROM ${tableName}`);
  return result.affectedRows;
}

async function listPositionsForUser(userId) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const tableName = escapeIdentifier(getPositionTableName(normalizedUserId));
  const [rows] = await pool.query(
    `SELECT ${POSITION_LIST_COLUMNS} FROM ${tableName} ORDER BY created_at ASC, id ASC`
  );
  const positions = rows.map(mapRowToPosition);

  if (isPureAutoSeedPositionSet(positions)) {
    await pool.query(`DELETE FROM ${tableName}`);
    return [];
  }

  return positions;
}

async function getPositionById(userId, positionId) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const tableName = escapeIdentifier(getPositionTableName(normalizedUserId));
  const [rows] = await pool.query(
    `SELECT ${POSITION_LIST_COLUMNS} FROM ${tableName} WHERE id = ? LIMIT 1`,
    [Number(positionId)]
  );

  if (!rows.length) {
    return null;
  }

  return mapRowToPosition(rows[0]);
}

async function getPositionByName(userId, name) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const tableName = escapeIdentifier(getPositionTableName(normalizedUserId));
  const normalizedName = String(name || '').trim();
  const [rows] = await pool.query(
    `SELECT ${POSITION_LIST_COLUMNS} FROM ${tableName} WHERE name = ? LIMIT 1`,
    [normalizedName]
  );

  if (!rows.length) {
    return null;
  }

  return mapRowToPosition(rows[0]);
}

async function upsertPositionForUser(userId, payload) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const tableName = escapeIdentifier(getPositionTableName(normalizedUserId));
  const normalizedName = String(payload?.name || '').trim();

  if (!normalizedName) {
    throw new Error('岗位名称不能为空');
  }

  const current = payload?.id ? await getPositionById(normalizedUserId, payload.id) : null;
  const conflict = await getPositionByName(normalizedUserId, normalizedName);

  if (conflict && Number(conflict.id) !== Number(payload?.id || 0)) {
    throw new Error('该岗位名称已存在，请使用其他名称');
  }

  const config = normalizePositionConfig(payload?.config || {});
  const description = String(payload?.description || '').trim() || buildPositionDescription(normalizedName, config);
  const now = new Date().toISOString();
  const row = mapPositionToRow({
    id: current?.id || (payload?.id ? Number(payload.id) : generatePositionId()),
    ownerUserId: normalizedUserId,
    name: normalizedName,
    description,
    config,
    createdAt: current?.createdAt || payload?.createdAt || now,
    updatedAt: now
  });

  await pool.query(
    `INSERT INTO ${tableName} (id, owner_user_id, name, description, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       owner_user_id = VALUES(owner_user_id),
       name = VALUES(name),
       description = VALUES(description),
       config = VALUES(config),
       updated_at = VALUES(updated_at)`,
    [
      row.id,
      row.ownerUserId,
      row.name,
      row.description,
      row.config,
      row.createdAt,
      row.updatedAt
    ]
  );

  return getPositionById(normalizedUserId, row.id);
}

async function deletePositionById(userId, positionId) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const tableName = escapeIdentifier(getPositionTableName(normalizedUserId));
  const [result] = await pool.query(`DELETE FROM ${tableName} WHERE id = ?`, [Number(positionId)]);
  return result.affectedRows;
}

async function getCurrentInterviewSessionForUser(userId) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const tableName = escapeIdentifier(getInterviewSessionTableName(normalizedUserId));
  const [rows] = await pool.query(
    `SELECT * FROM ${tableName} WHERE status = ? ORDER BY updated_at DESC, id DESC LIMIT 1`,
    ['in_progress']
  );

  if (!rows.length) {
    return null;
  }

  return mapRowToInterviewSession(rows[0]);
}

async function listInterviewSessionsForUser(userId, options = {}) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const tableName = escapeIdentifier(getInterviewSessionTableName(normalizedUserId));
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 100;
  const [rows] = await pool.query(
    `SELECT * FROM ${tableName} ORDER BY start_time DESC, id DESC LIMIT ?`,
    [limit]
  );
  return rows.map(mapRowToInterviewSession);
}

async function getInterviewSessionById(userId, sessionId) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const tableName = escapeIdentifier(getInterviewSessionTableName(normalizedUserId));
  const [rows] = await pool.query(
    `SELECT * FROM ${tableName} WHERE id = ? LIMIT 1`,
    [Number(sessionId)]
  );
  if (!rows.length) {
    return null;
  }
  return mapRowToInterviewSession(rows[0]);
}

async function createInterviewSessionForUser(userId, session) {
  const normalizedUserId = normalizeUserId(userId);
  const activeSession = await getCurrentInterviewSessionForUser(normalizedUserId);
  if (activeSession && Number(activeSession.id) !== Number(session.id)) {
    activeSession.status = 'cancelled';
    activeSession.endTime = new Date().toISOString();
    activeSession.updatedAt = new Date().toISOString();
    await upsertInterviewSessionForUser(normalizedUserId, activeSession);
  }

  return upsertInterviewSessionForUser(normalizedUserId, session);
}

async function upsertInterviewSessionForUser(userId, session) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const tableName = escapeIdentifier(getInterviewSessionTableName(normalizedUserId));
  const row = mapInterviewSessionToRow(session);

  await pool.query(
    `INSERT INTO ${tableName} (
      id, owner_user_id, candidate_id, candidate_name, position, status,
      conversation, scoring, metadata, start_time, end_time, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      owner_user_id = VALUES(owner_user_id),
      candidate_id = VALUES(candidate_id),
      candidate_name = VALUES(candidate_name),
      position = VALUES(position),
      status = VALUES(status),
      conversation = VALUES(conversation),
      scoring = VALUES(scoring),
      metadata = VALUES(metadata),
      start_time = VALUES(start_time),
      end_time = VALUES(end_time),
      updated_at = VALUES(updated_at)`,
    [
      row.id,
      row.ownerUserId,
      row.candidateId,
      row.candidateName,
      row.position,
      row.status,
      row.conversation,
      row.scoring,
      row.metadata,
      row.startTime,
      row.endTime,
      row.createdAt,
      row.updatedAt
    ]
  );

  return getInterviewSessionById(normalizedUserId, row.id);
}

async function deleteInterviewSessionById(userId, sessionId) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const tableName = escapeIdentifier(getInterviewSessionTableName(normalizedUserId));
  const [result] = await pool.query(`DELETE FROM ${tableName} WHERE id = ?`, [Number(sessionId)]);
  return result.affectedRows;
}

async function deleteTemporaryInterviewSessionsForUser(userId) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureCandidateDatabase(normalizedUserId);
  const tableName = escapeIdentifier(getInterviewSessionTableName(normalizedUserId));
  const [result] = await pool.query(
    `DELETE FROM ${tableName} WHERE candidate_name = ? OR candidate_id IS NULL`,
    ['临时候选人']
  );
  return result.affectedRows;
}

module.exports = {
  dbConfig,
  generateCandidateId,
  generatePositionId,
  getCandidateDatabaseName,
  ensureCandidateDatabase,
  listCandidatesForUser,
  getCandidateById,
  getCandidateByIdGlobal,
  findCandidateBySnapshot,
  upsertCandidateForUser,
  updateCandidateById,
  deleteCandidateById,
  clearCandidatesForUser,
  listPositionsForUser,
  getPositionById,
  getPositionByName,
  upsertPositionForUser,
  deletePositionById,
  buildResumePointer,
  getCurrentInterviewSessionForUser,
  listInterviewSessionsForUser,
  getInterviewSessionById,
  createInterviewSessionForUser,
  upsertInterviewSessionForUser,
  deleteInterviewSessionById,
  deleteTemporaryInterviewSessionsForUser
};
