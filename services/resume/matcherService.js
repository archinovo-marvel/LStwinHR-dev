/**
 * 技能匹配服务
 * 负责简历技能与岗位要求的匹配分析
 */
const { getPositionConfig } = require('./positionConfig');
class MatcherService {
  matchSkills(text, extractedContent, position) {
    const config = getPositionConfig(position);
    const lowerText = text.toLowerCase();
    const result = {
      coreSkills: [],
      businessSkills: [],
      abilityKeywords: [],
      projectKeywords: [],
      totalMatches: 0,
      matchScore: 0
    };
    result.coreSkills = this.matchSkillCategory(
      lowerText, 
      config.coreSkills, 
      config.skillAliases, 
      'core'
    );
    result.businessSkills = this.matchSkillCategory(
      lowerText, 
      config.businessSkills, 
      config.skillAliases, 
      'business'
    );
    result.abilityKeywords = this.matchAbilityKeywords(lowerText, config.abilityKeywords);
    result.projectKeywords = this.matchProjectKeywords(lowerText, config.projectKeywords);
    result.totalMatches = result.coreSkills.length + result.businessSkills.length;
    result.matchScore = this.calculateMatchScore(result, config);
    return result;
  }
  matchSkillCategory(text, skills, aliases, type) {
    const matches = [];
    skills.forEach(skill => {
      const lowerSkill = skill.toLowerCase();
      let found = text.includes(lowerSkill);
      let matchedVariant = skill;
      let context = '';
      if (!found && aliases && aliases[skill]) {
        for (const alias of aliases[skill]) {
          if (text.includes(alias.toLowerCase())) {
            found = true;
            matchedVariant = alias;
            break;
          }
        }
      }
      if (found) {
        context = this.extractContext(text, lowerSkill, 50);
        matches.push({
          skill,
          matchedVariant,
          type,
          context,
          score: type === 'core' ? 3 : 4,
          description: type === 'core' ? `具备${skill}核心技能` : `有${skill}相关经验`
        });
      }
    });
    return matches;
  }
  matchAbilityKeywords(text, keywords) {
    const matches = [];
    keywords.forEach(ability => {
      const lowerAbility = ability.toLowerCase();
      if (text.includes(lowerAbility)) {
        const context = this.extractContext(text, lowerAbility, 30);
        matches.push({
          ability,
          context,
          description: `具备${ability}`
        });
      }
    });
    return matches;
  }
  matchProjectKeywords(text, keywords) {
    const matches = [];
    keywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      if (text.includes(lowerKeyword)) {
        const context = this.extractContext(text, lowerKeyword, 30);
        matches.push({
          keyword,
          context,
          description: `有${keyword}相关经历`
        });
      }
    });
    return matches;
  }
  extractContext(text, keyword, contextLength = 50) {
    const index = text.indexOf(keyword);
    if (index === -1) return '';
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + keyword.length + contextLength);
    let context = text.substring(start, end);
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    return context.trim();
  }
  calculateMatchScore(matchResult, config) {
    const coreSkillScore = matchResult.coreSkills.reduce((sum, match) => sum + match.score, 0);
    const businessSkillScore = matchResult.businessSkills.reduce((sum, match) => sum + match.score, 0);
    const maxCoreScore = config.coreSkills.length * 3;
    const maxBusinessScore = config.businessSkills.length * 4;
    const skillRatio = (coreSkillScore + businessSkillScore) / (maxCoreScore + maxBusinessScore);
    return Math.round(skillRatio * 100);
  }
  matchEducation(extractedEducation, position) {
    const config = getPositionConfig(position);
    const result = {
      isMatch: false,
      hasConflict: false,
      conflicts: [],
      matchedMajors: [],
      educationInfo: extractedEducation
    };
    if (!extractedEducation || extractedEducation.length === 0) {
      return result;
    }
    extractedEducation.forEach(edu => {
      const major = edu.major || '';
      const school = edu.school || '';
      const degree = edu.degree || '';
      config.education.forEach(requiredEdu => {
        const lowerRequired = requiredEdu.toLowerCase();
        if (major.toLowerCase().includes(lowerRequired) || 
            school.toLowerCase().includes(lowerRequired)) {
          result.isMatch = true;
          result.matchedMajors.push({
            major: major || school,
            matchedKeyword: requiredEdu
          });
        }
      });
      if (config.conflictingMajors) {
        config.conflictingMajors.forEach(conflictMajor => {
          if (major.toLowerCase().includes(conflictMajor.toLowerCase())) {
            result.hasConflict = true;
            result.conflicts.push({
              major,
              conflictWith: position,
              severity: 'high'
            });
          }
        });
      }
    });
    return result;
  }
  matchExperience(extractedWork, extractedProjects, position) {
    const config = getPositionConfig(position);
    const result = {
      isMatch: false,
      matchedExperiences: [],
      experienceCount: extractedWork.length,
      projectCount: extractedProjects.length
    };
    const allExperience = [
      ...extractedWork.map(w => w.raw || ''),
      ...extractedProjects.map(p => p.raw || '')
    ];
    const allText = allExperience.join(' ').toLowerCase();
    config.experience.forEach(exp => {
      if (allText.includes(exp.toLowerCase())) {
        result.isMatch = true;
        result.matchedExperiences.push(exp);
      }
    });
    return result;
  }
  analyzeSkillEvidence(text, extractedContent, matchResult) {
    const evidences = [];
    const sections = {
      skills: extractedContent.skills || [],
      workExperience: extractedContent.workExperience || [],
      projects: extractedContent.projects || []
    };
    matchResult.coreSkills.forEach(skillMatch => {
      const evidence = this.findSkillEvidence(skillMatch.skill, sections);
      evidences.push({
        skill: skillMatch.skill,
        type: 'core',
        evidence,
        hasEvidence: evidence.length > 0,
        evidenceQuality: this.assessEvidenceQuality(evidence)
      });
    });
    matchResult.businessSkills.forEach(skillMatch => {
      const evidence = this.findSkillEvidence(skillMatch.skill, sections);
      evidences.push({
        skill: skillMatch.skill,
        type: 'business',
        evidence,
        hasEvidence: evidence.length > 0,
        evidenceQuality: this.assessEvidenceQuality(evidence)
      });
    });
    return evidences;
  }
  findSkillEvidence(skill, sections) {
    const evidence = [];
    const lowerSkill = skill.toLowerCase();
    sections.workExperience.forEach(work => {
      const raw = work.raw || '';
      const desc = work.description || [];
      if (raw.toLowerCase().includes(lowerSkill)) {
        evidence.push({
          source: 'workExperience',
          context: raw.substring(0, 100),
          company: work.company
        });
      }
      desc.forEach(d => {
        if (d.toLowerCase().includes(lowerSkill)) {
          evidence.push({
            source: 'workExperience',
            context: d,
            company: work.company
          });
        }
      });
    });
    sections.projects.forEach(project => {
      const raw = project.raw || '';
      const desc = project.description || [];
      if (raw.toLowerCase().includes(lowerSkill)) {
        evidence.push({
          source: 'project',
          context: raw.substring(0, 100),
          projectName: project.name
        });
      }
      desc.forEach(d => {
        if (d.toLowerCase().includes(lowerSkill)) {
          evidence.push({
            source: 'project',
            context: d,
            projectName: project.name
          });
        }
      });
    });
    sections.skills.forEach(s => {
      if (s.name.toLowerCase().includes(lowerSkill)) {
        evidence.push({
          source: 'skills',
          context: s.name,
          category: s.category
        });
      }
    });
    return evidence;
  }
  assessEvidenceQuality(evidence) {
    if (evidence.length === 0) return 'none';
    const hasWorkEvidence = evidence.some(e => e.source === 'workExperience');
    const hasProjectEvidence = evidence.some(e => e.source === 'project');
    if (hasWorkEvidence && hasProjectEvidence) return 'high';
    if (hasWorkEvidence || hasProjectEvidence) return 'medium';
    return 'low';
  }
}
module.exports = new MatcherService();
