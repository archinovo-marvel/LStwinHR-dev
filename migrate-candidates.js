const fs = require('fs');
const path = require('path');

const {
  ensureCandidateDatabase,
  upsertCandidateForUser,
  listCandidatesForUser
} = require('./services/candidateStore');

const USER_ID = 1;
const OWNER_USER_NAME = '孙程超';
const OWNER_USER_EMAIL = '1124602166@qq.com';
const JSON_FILE_PATH = path.join(__dirname, 'candidate-data.json');

async function migrate() {
  console.log('=== 候选人数据迁移: JSON → MySQL ===\n');

  let rawData;
  try {
    rawData = fs.readFileSync(JSON_FILE_PATH, 'utf-8');
  } catch (err) {
    console.error('❌ 无法读取 candidate-data.json:', err.message);
    process.exit(1);
  }

  let candidates;
  try {
    candidates = JSON.parse(rawData);
  } catch (err) {
    console.error('❌ JSON 解析失败:', err.message);
    process.exit(1);
  }

  console.log(`📄 从 JSON 文件读取到 ${candidates.length} 条候选人记录\n`);

  console.log(`🔧 目标用户: ID=${USER_ID}, 名称=${OWNER_USER_NAME}, 邮箱=${OWNER_USER_EMAIL}\n`);

  await ensureCandidateDatabase(USER_ID);
  console.log('✅ 数据库表已就绪\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    const raw = candidates[i];
    const enriched = {
      ...raw,
      ownerUserId: USER_ID,
      ownerUserName: OWNER_USER_NAME,
      ownerUserEmail: OWNER_USER_EMAIL,
      submissionSource: 'migration_from_json'
    };

    try {
      await upsertCandidateForUser(USER_ID, enriched);
      successCount++;
      console.log(`  ✅ [${i + 1}/${candidates.length}] ${raw.name} - ${raw.position} (${raw.status})`);
    } catch (err) {
      failCount++;
      console.error(`  ❌ [${i + 1}/${candidates.length}] ${raw.name} - ${raw.position}: ${err.message}`);
    }
  }

  console.log('\n=== 迁移结果统计 ===');
  console.log(`  总记录数: ${candidates.length}`);
  console.log(`  成功导入: ${successCount}`);
  console.log(`  导入失败: ${failCount}`);

  const migrated = await listCandidatesForUser(USER_ID);
  console.log(`\n✅ 验证: 用户 ${OWNER_USER_NAME} 的数据库中现有 ${migrated.length} 条候选人记录`);

  if (successCount === candidates.length) {
    console.log('\n🎉 所有数据迁移完成！');
    process.exit(0);
  } else {
    console.log('\n⚠️ 部分记录迁移失败，请检查上方错误信息');
    process.exit(1);
  }
}

migrate().catch(err => {
  console.error('💥 迁移过程发生未捕获错误:', err);
  process.exit(1);
});
