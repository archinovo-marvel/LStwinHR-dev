-- =====================================================
-- 个人用户 AI 模拟面试功能数据库表
-- 这些表存储在个人用户的独立数据库中
-- =====================================================

SET NAMES utf8mb4;

-- 个人用户自定义岗位表
CREATE TABLE IF NOT EXISTS `personal_positions` (
  `id` VARCHAR(36) PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `position_name` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `company_name` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `work_years` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `salary_range` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `skills` JSON,
  `usage_count` INT DEFAULT 0,
  `last_used_at` DATETIME,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_last_used` (`last_used_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 个人用户面试简历表（独立于简历优化功能）
CREATE TABLE IF NOT EXISTS `interview_resumes` (
  `id` VARCHAR(36) PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `file_name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_blob` LONGBLOB,
  `mime_type` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `size` BIGINT,
  `parsed_text` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `parse_status` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 个人用户面试会话表
CREATE TABLE IF NOT EXISTS `interview_sessions` (
  `id` VARCHAR(36) PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `resume_id` VARCHAR(36) NOT NULL,
  `position_id` VARCHAR(36),
  `position_info` JSON NOT NULL,
  `difficulty` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `mode` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'text',
  `total_questions` INT DEFAULT 10,
  `current_question` INT DEFAULT 0,
  `status` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'in_progress',
  `start_time` DATETIME,
  `end_time` DATETIME,
  `duration` INT COMMENT 'Duration in seconds',
  `conversation` JSON COMMENT 'Array of Q&A pairs',
  `scoring` JSON COMMENT 'Scoring results',
  `final_score` DECIMAL(5,2),
  `grade` VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `metadata` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_start_time` (`start_time`),
  INDEX `idx_resume_id` (`resume_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 个人用户训练统计表
CREATE TABLE IF NOT EXISTS `interview_stats` (
  `user_id` BIGINT PRIMARY KEY,
  `total_sessions` INT DEFAULT 0,
  `completed_sessions` INT DEFAULT 0,
  `average_score` DECIMAL(5,2),
  `highest_score` DECIMAL(5,2),
  `lowest_score` DECIMAL(5,2),
  `total_duration` INT DEFAULT 0 COMMENT 'Total duration in seconds',
  `position_stats` JSON COMMENT 'Statistics by position',
  `dimension_averages` JSON COMMENT 'Average scores by dimension',
  `trend` JSON COMMENT 'Score trend over time',
  `weak_areas` JSON COMMENT 'Identified weak areas',
  `last_session_time` DATETIME,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
