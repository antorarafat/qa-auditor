const fs = require('node:fs');
const path = require('node:path');

const TEMPLATE_FILES = {
  qaCall: 'qa_scorecard_call_template.md',
  qaSummary: 'qa_scorecard_summary_template.md',
  coaching: 'advisor_pitch_coaching_template.md',
  voice: 'customer_voice_template.md'
};

const REQUIRED_PLACEHOLDERS = {
  qaCall: ['company_name', 'call_summary', 'client_type_and_need', 'call_duration_and_tone', 'agent_name', 'evaluation_date', 'final_score', 'max_score', 'critical_error_note', 'product_fact_check', 'ce_audit_details', 'ce_alert', 'scorecard_rows', 'achieved_score', 'deducted_score', 'status_label', 'deduction_justification_sections', 'strengths_list', 'script_correction_pairs', 'actionable_tips', 'overall_status'],
  qaSummary: ['company_name', 'evaluation_date', 'total_calls', 'parameter_set_name', 'agent_summary_rows', 'category_average_rows', 'recurring_issues_list', 'best_and_worst_calls', 'overall_recommendations'],
  coaching: ['advisor_name', 'evaluator_role', 'call_topic', 'sales_pitch_audit_points', 'tone_pitch_analysis_points', 'talk_to_listen_ratio', 'listening_skill_notes', 'probing_gap_notes', 'script_correction_rows', 'weekly_growth_plan'],
  voice: ['total_calls_analyzed', 'advisors_list', 'overall_sentiment', 'customer_profile', 'customer_need', 'customer_questions_list', 'barriers_list', 'product_feedback_list', 'advisor_name', 'objection_handling_assessment', 'improvement_areas', 'actionable_recommendations']
};

const BENGALI_DIGITS = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };

function toEnglishDigits(value) {
  return String(value || '').replace(/[০-৯]/g, digit => BENGALI_DIGITS[digit]);
}

function parsePoints(value) {
  const normalized = toEnglishDigits(value);
  const matches = [...normalized.matchAll(/(?:\(|\[)\s*(\d+(?:\.\d+)?)\s*(?:নম্বর|points?|marks?)?\s*(?:\)|\])/gi)];
  if (!matches.length) return null;
  return Number(matches[matches.length - 1][1]);
}

function cleanRubricLabel(value) {
  return String(value || '')
    .replace(/^\s*[\-*•]\s*/, '')
    .replace(/^\s*[০-৯0-9]+[.)]\s*/, '')
    .replace(/\s*(?:\(|\[)\s*[০-৯0-9]+(?:\.[০-৯0-9]+)?\s*(?:নম্বর|points?|marks?)?\s*(?:\)|\])\s*$/i, '')
    .trim();
}

function rubricKey(category, parameter) {
  return `${String(category).trim().toLowerCase()}\0${String(parameter).trim().toLowerCase()}`;
}

function normalizeRubricText(value) {
  return plainMarkdownText(value).toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ').trim();
}

function parseQaRubric(name, detail) {
  const parameter = String(name || '').trim();
  const text = String(detail || '').replace(/\r/g, '').trim();
  if (!parameter || !text) throw new Error('The selected QA parameter has no rubric text.');
  const categories = [];
  const criticalErrors = [];
  let currentCategory = null;
  let inCriticalErrors = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/critical\s*errors?|ক্রিটিক্যাল\s*এরর/i.test(line) && !/^[-*•]/.test(line)) {
      inCriticalErrors = true;
      continue;
    }
    if (inCriticalErrors) {
      const rule = line.replace(/^\s*[\-*•]\s*/, '').trim();
      if (rule) criticalErrors.push(rule);
      continue;
    }

    const points = parsePoints(line);
    const isBullet = /^\s*[\-*•]/.test(rawLine);
    const isCategory = !isBullet && /^(?:[০-৯0-9]+[.)]\s*)/.test(line);
    if (isCategory) {
      currentCategory = { name: cleanRubricLabel(line), maximum: points, rows: [] };
      categories.push(currentCategory);
      continue;
    }
    if (isBullet && currentCategory && points !== null) {
      currentCategory.rows.push({ category: currentCategory.name, parameter: cleanRubricLabel(line), maximum: points });
    }
  }

  if (!categories.length) throw new Error(`The ${parameter} rubric has no recognizable categories.`);
  const rows = categories.flatMap(category => category.rows);
  if (!rows.length) throw new Error(`The ${parameter} rubric has no recognizable scored rows.`);
  const seen = new Set();
  for (const row of rows) {
    const key = rubricKey(row.category, row.parameter);
    if (seen.has(key)) throw new Error(`The ${parameter} rubric contains a duplicate row: ${row.category} / ${row.parameter}.`);
    seen.add(key);
  }
  for (const category of categories) {
    const rowTotal = category.rows.reduce((sum, row) => sum + row.maximum, 0);
    if (category.maximum === null) category.maximum = rowTotal;
    if (Math.abs(category.maximum - rowTotal) > 0.001) {
      throw new Error(`The ${parameter} rubric category “${category.name}” declares ${category.maximum} points but its rows total ${rowTotal}.`);
    }
  }
  const maximum = categories.reduce((sum, category) => sum + category.maximum, 0);
  if (maximum <= 0) throw new Error(`The ${parameter} rubric total must be greater than zero.`);
  return { name: parameter, source: text, categories, rows, criticalErrors, maximum };
}

function loadTemplate(templateDir, key) {
  const fileName = TEMPLATE_FILES[key];
  if (!fileName) throw new Error(`Unknown report template: ${key}.`);
  const source = fs.readFileSync(path.join(templateDir, fileName), 'utf8');
  const body = source.replace(/<!--[^]*?-->/g, '');
  const placeholders = new Set([...body.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)].map(match => match[1]));
  const missing = REQUIRED_PLACEHOLDERS[key].filter(field => !placeholders.has(field));
  if (missing.length) throw new Error(`${fileName} is missing required placeholders: ${missing.join(', ')}.`);
  return source;
}

function loadAndValidateTemplates(templateDir, keys) {
  return Object.fromEntries(keys.map(key => [key, loadTemplate(templateDir, key)]));
}

function markdownValue(value) {
  if (Array.isArray(value)) return value.map(item => `- ${item}`).join('\n');
  if (value === null || value === undefined) return '';
  return String(value);
}

function renderTemplate(source, values) {
  const body = source.replace(/<!--[^]*?-->/g, '').trim();
  const rendered = body.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) throw new Error(`No value was supplied for template placeholder ${key}.`);
    return markdownValue(values[key]);
  });
  const unfilled = [...rendered.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)].map(match => match[1]);
  if (unfilled.length) throw new Error(`Unfilled template placeholders: ${unfilled.join(', ')}.`);
  return rendered.trim();
}

function stripOuterMarkdownFence(source) {
  return String(source || '').trim().replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function markdownSection(source, sectionNumber) {
  const number = String(sectionNumber);
  const bengaliNumber = number.replace(/\d/g, digit => '০১২৩৪৫৬৭৮৯'[Number(digit)]);
  const pattern = new RegExp(`^##\\s*(?:${number}|${bengaliNumber})\\.\\s*[^\\n]*\\n([\\s\\S]*?)(?=^##\\s*(?:[0-9০-৯]+)\\.|(?![\\s\\S]))`, 'mi');
  return String(source || '').match(pattern)?.[1]?.trim() || '';
}

function markdownList(section) {
  const values = String(section || '').split('\n').map(line => line.trim()).filter(line => /^[-*]\s+/.test(line)).map(line => line.replace(/^[-*]\s+/, '').trim()).filter(Boolean);
  return values.length ? values : (String(section || '').trim() ? [String(section).trim()] : []);
}

function plainMarkdownText(value) {
  return String(value || '').replace(/<br\s*\/?\s*>/gi, ' / ').replace(/[*_`]/g, '').replace(/\\\|/g, '|').trim();
}

function parseMarkdownScoreRows(source, rubric) {
  const section = markdownSection(source, 3);
  const rows = [];
  for (const line of section.split('\n')) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
    if (cells.length < 4 || /প্যারামিটার|parameter/i.test(cells[0]) || /^:?-{3,}/.test(cells[0]) || /সর্বমোট|total score/i.test(cells[0])) continue;
    const maximum = Number(toEnglishDigits(plainMarkdownText(cells[1])).match(/\d+(?:\.\d+)?/)?.[0]);
    const achieved = Number(toEnglishDigits(plainMarkdownText(cells[2])).match(/\d+(?:\.\d+)?/)?.[0]);
    const deductedValue = Number(toEnglishDigits(plainMarkdownText(cells[3])).match(/\d+(?:\.\d+)?/)?.[0]);
    if (!Number.isFinite(maximum) || !Number.isFinite(achieved)) continue;
    const label = plainMarkdownText(cells[0]);
    const normalizedLabel = normalizeRubricText(label);
    const parameterLabel = label.split('/').slice(-1)[0].trim();
    const rubricRow = rubric.rows.find(row => normalizeRubricText(row.parameter) === normalizeRubricText(parameterLabel)) || rubric.rows.find(row => normalizeRubricText(`${row.category} ${row.parameter}`) === normalizedLabel) || rubric.rows.find(row => normalizedLabel.includes(normalizeRubricText(row.parameter)));
    const category = rubricRow?.category || label.split('/')[0].trim() || 'Other';
    const parameter = rubricRow?.parameter || parameterLabel || label;
    rows.push({ category, parameter, maximum, achieved, deducted: Number.isFinite(deductedValue) ? deductedValue : Math.max(0, maximum - achieved), timestamp: plainMarkdownText(cells[4] || '—') || '—', deductionReason: plainMarkdownText(cells.slice(5).join(' | ')) || '—' });
  }
  return rows;
}

function parseQaMeta(source) {
  const match = String(source || '').match(/<!--\s*QA_META\s+(\{[\s\S]*?\})\s*-->/i);
  if (!match) return {};
  try { const value = JSON.parse(match[1]); return value && typeof value === 'object' ? value : {}; }
  catch { return {}; }
}

function fallbackQaScore(source, rubric) {
  const matches = [...String(source || '').matchAll(/(?:চূড়ান্ত\s*স্কোর|সর্বমোট[^\n]*স্কোর|final\s*score|overall\s*score|total\s*score)[^\n]{0,120}?(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/gi)];
  const preferred = matches.find(match => Math.abs(Number(match[2]) - rubric.maximum) < 0.001) || matches[0];
  return preferred ? { score: Number(preferred[1]), maximum: Number(preferred[2]) } : { score: null, maximum: rubric.maximum };
}

function parseQaMarkdownCall(source, fileName, rubric) {
  const meta = parseQaMeta(source);
  const fallbackScore = fallbackQaScore(source, rubric);
  const visibleSource = source.replace(/<!--\s*QA_META[\s\S]*?-->/gi, '');
  const visibleCe = /(?:🚨|Critical\s*Error\s+Detected|\bCE\s+(?:Detected|পাওয়া\s*গেছে|শনাক্ত))/i.test(visibleSource);
  const ceDetected = meta.ceDetected === true || visibleCe;
  const maximum = Number.isFinite(Number(meta.maximum)) ? Number(meta.maximum) : fallbackScore.maximum;
  const parsedScore = Number.isFinite(Number(meta.finalScore)) ? Number(meta.finalScore) : fallbackScore.score;
  const finalScore = ceDetected ? 0 : (Number.isFinite(parsedScore) ? parsedScore : null);
  const agentMatch = String(source || '').match(/\*\*(?:এজেন্টের নাম|Agent(?:'s)? Name)\s*:\*\*\s*([^\n]+)/i);
  const agentName = String(meta.agentName || agentMatch?.[1] || 'শনাক্ত করা যায়নি').trim();
  const scores = parseMarkdownScoreRows(source, rubric);
  const achievedScore = scores.length ? scores.reduce((sum, row) => sum + row.achieved, 0) : (Number.isFinite(finalScore) ? finalScore : 0);
  const deductedScore = scores.length ? scores.reduce((sum, row) => sum + row.deducted, 0) : Math.max(0, maximum - achievedScore);
  const cleanMarkdown = String(source || '').replace(/<!--\s*QA_(?:CALL_START|CALL_END|META)[\s\S]*?-->/gi, '').trim();
  const productSection = markdownSection(cleanMarkdown, 2);
  return {
    fileName: String(meta.fileName || fileName || 'recording').trim(), markdown: cleanMarkdown, agentName, finalScore, maximum, ceDetected,
    scores, achievedScore, deductedScore, productFactCheck: productSection, productCheckPresent: /(?:Advisor\s*claim|Official\s*fact|Verdict|এডভাইসর(?:ের)?\s*দাবি|অফিশিয়াল\s*তথ্য|রায়)/i.test(productSection),
    ceAuditDetails: productSection, ceAlert: ceDetected ? 'CE' : 'Non-CE',
    deductionJustifications: markdownList(markdownSection(cleanMarkdown, 4)), strengths: markdownList(markdownSection(cleanMarkdown, 5)),
    actionableTips: markdownList(markdownSection(cleanMarkdown, 7)), scriptSection: markdownSection(cleanMarkdown, 6),
    storageEligible: Number.isFinite(finalScore) && maximum > 0
  };
}

function parseQaMarkdownReport(markdown, expectedFileNames, rubric) {
  const source = stripOuterMarkdownFence(markdown);
  if (!source) throw new Error('The AI returned an empty Markdown report.');
  const calls = [];
  const marker = /<!--\s*QA_CALL_START\s+(\{[\s\S]*?\})\s*-->([\s\S]*?)<!--\s*QA_CALL_END\s*-->/gi;
  let match;
  while ((match = marker.exec(source))) {
    let start = {};
    try { start = JSON.parse(match[1]); } catch { start = {}; }
    calls.push(parseQaMarkdownCall(match[2], start.fileName || expectedFileNames[calls.length], rubric));
  }
  if (!calls.length) calls.push(parseQaMarkdownCall(source, expectedFileNames[0], rubric));
  return calls;
}

function stringField(object, field) {
  const value = String(object?.[field] || '').trim();
  if (!value) throw new Error(`AI response is missing ${field}.`);
  return value;
}

function stringList(object, field, allowEmpty = false) {
  if (!Array.isArray(object?.[field])) throw new Error(`AI response is missing ${field}.`);
  const values = object[field].map(value => String(value || '').trim()).filter(Boolean);
  if (!allowEmpty && !values.length) throw new Error(`AI response is missing ${field}.`);
  return values;
}

function enumField(object, field, allowed) {
  const value = stringField(object, field);
  if (!allowed.includes(value)) throw new Error(`AI response has an invalid ${field}.`);
  return value;
}

function timestampedItem(item, field) {
  const timestamp = stringField(item, 'timestamp');
  if (!/[0-9০-৯]{1,3}:[0-9০-৯]{2}/.test(timestamp)) throw new Error(`AI response has an invalid timestamp in ${field}.`);
  const detail = stringField(item, 'detail');
  const formattedTimestamp = timestamp.startsWith('[') && timestamp.endsWith(']') ? timestamp : `[${timestamp}]`;
  return { timestamp: formattedTimestamp, detail, text: `${formattedTimestamp} ${detail}` };
}

function timestampedList(object, field, allowEmpty = false) {
  if (!Array.isArray(object?.[field])) throw new Error(`AI response is missing ${field}.`);
  const values = object[field].map(item => timestampedItem(item, field).text);
  if (!allowEmpty && !values.length) throw new Error(`AI response is missing ${field}.`);
  return values;
}

function timestampedScoreNarrative(row, detail) {
  const timestamp = String(row.timestamp || '').trim();
  const formattedTimestamp = timestamp.startsWith('[') && timestamp.endsWith(']') ? timestamp : `[${timestamp || 'সময় অনুপস্থিত'}]`;
  return `${formattedTimestamp} ${detail}`;
}

function isSalesPitchRow(row) {
  const label = `${row.category} ${row.parameter}`.toLowerCase().replace(/[_–—-]+/g, ' ');
  return /\b(?:sales?|product)\s+pitch\b/.test(label) || /(?:সেলস?|প্রোডাক্ট)\s*পিচ/.test(label) || /বিক্র[য়য়]\s*(?:প্রস্তাব|উপস্থাপন)/.test(label);
}

function validateQaResult(value, rubric) {
  if (!value || typeof value !== 'object') throw new Error('AI returned an invalid QA result.');
  const customerEnrollmentStatus = enumField(value, 'customer_enrollment_status', ['enrolled', 'prospect', 'unclear']);
  const callObjective = enumField(value, 'call_objective', ['sales', 'feedback', 'service_check', 'support', 'mixed', 'unclear']);
  if (typeof value.sales_pitch_applicable !== 'boolean') throw new Error('AI response is missing sales_pitch_applicable.');
  const applicabilityEvidence = timestampedItem(value.sales_pitch_applicability_evidence, 'sales_pitch_applicability_evidence');
  const salesPitchExempt = value.sales_pitch_applicable === false && customerEnrollmentStatus === 'enrolled' && ['feedback', 'service_check', 'support'].includes(callObjective);
  const scores = Array.isArray(value.scores) ? value.scores : [];
  if (scores.length !== rubric.rows.length) throw new Error(`AI returned ${scores.length} score rows; ${rubric.rows.length} are required.`);
  const byKey = new Map();
  for (const score of scores) {
    const category = stringField(score, 'category');
    const parameter = stringField(score, 'parameter');
    const key = rubricKey(category, parameter);
    if (byKey.has(key)) throw new Error(`AI returned a duplicate score row: ${category} / ${parameter}.`);
    byKey.set(key, score);
  }
  const reconciled = rubric.rows.map(row => {
    const score = byKey.get(rubricKey(row.category, row.parameter));
    if (!score) throw new Error(`AI omitted score row: ${row.category} / ${row.parameter}.`);
    const maximum = Number(score.maximum);
    const suppliedAchieved = Number(score.achieved);
    if (!Number.isFinite(maximum) || Math.abs(maximum - row.maximum) > 0.001) throw new Error(`AI changed the maximum for ${row.parameter}.`);
    if (!Number.isFinite(suppliedAchieved) || suppliedAchieved < 0 || suppliedAchieved > maximum) throw new Error(`AI returned an invalid achieved score for ${row.parameter}.`);
    const exemptRow = salesPitchExempt && isSalesPitchRow(row);
    const achieved = exemptRow ? maximum : suppliedAchieved;
    const deducted = maximum - achieved;
    return {
      category: row.category,
      parameter: row.parameter,
      maximum,
      achieved,
      deducted,
      timestamp: exemptRow ? applicabilityEvidence.timestamp : (String(score.timestamp || '—').trim() || '—'),
      deductionReason: exemptRow ? `প্রযোজ্য নয়—${applicabilityEvidence.detail}` : (String(score.deduction_reason || '').trim() || '—')
    };
  });
  const achievedScore = reconciled.reduce((sum, row) => sum + row.achieved, 0);
  const deductedScore = reconciled.reduce((sum, row) => sum + row.deducted, 0);
  if (Math.abs(achievedScore + deductedScore - rubric.maximum) > 0.001) throw new Error('QA scores do not reconcile to the rubric maximum.');
  const ceDetected = value.ce_detected === true;
  const finalScore = ceDetected ? 0 : achievedScore;
  const suppliedDeductions = timestampedList(value, 'deduction_justifications', true);
  const suppliedStrengths = timestampedList(value, 'strengths', true);
  const suppliedTips = timestampedList(value, 'actionable_tips', true);
  const deductedRows = reconciled.filter(row => row.deducted > 0);
  const fullScoreRows = reconciled.filter(row => row.achieved === row.maximum);
  return {
    agentName: stringField(value, 'agent_name'),
    callSummary: stringField(value, 'call_summary'),
    clientTypeAndNeed: stringField(value, 'client_type_and_need'),
    callDurationAndTone: stringField(value, 'call_duration_and_tone'),
    productFactCheck: stringField(value, 'product_fact_check'),
    customerEnrollmentStatus,
    callObjective,
    salesPitchApplicable: !salesPitchExempt,
    salesPitchApplicabilityEvidence: applicabilityEvidence.text,
    ceDetected,
    ceAuditDetails: stringField(value, 'ce_audit_details'),
    ceAlert: stringField(value, 'ce_alert'),
    scores: reconciled,
    achievedScore,
    deductedScore,
    finalScore,
    maximum: rubric.maximum,
    deductionJustifications: suppliedDeductions.length ? suppliedDeductions : (deductedRows.length ? deductedRows.map(row => timestampedScoreNarrative(row, `${row.parameter}: ${row.deductionReason}`)) : ['কোনো নম্বর কাটা হয়নি।']),
    strengths: suppliedStrengths.length ? suppliedStrengths : (fullScoreRows.length ? fullScoreRows.map(row => timestampedScoreNarrative(row, `${row.parameter}: পূর্ণ নম্বর অর্জন করেছে।`)) : ['—']),
    scriptCorrections: (Array.isArray(value.script_corrections) ? value.script_corrections : []).map(item => ({
      timestamp: stringField(item, 'timestamp'), wrong: stringField(item, 'wrong'), correct: stringField(item, 'correct')
    })),
    actionableTips: suppliedTips.length ? suppliedTips : (deductedRows.length ? deductedRows.map(row => timestampedScoreNarrative(row, `${row.parameter} উন্নত করতে এই অংশটি অনুশীলন করুন।`)) : ['বর্তমান মান বজায় রাখুন।']),
    overallStatus: stringField(value, 'overall_status')
  };
}

function validateSummaryResult(value) {
  return {
    recurringIssues: stringList(value, 'recurring_issues', true),
    bestAndWorstCalls: stringField(value, 'best_and_worst_calls'),
    overallRecommendations: stringList(value, 'overall_recommendations', true)
  };
}

function validateVoiceResult(value) {
  return {
    advisorsList: stringField(value, 'advisors_list'), overallSentiment: stringField(value, 'overall_sentiment'),
    customerProfile: stringField(value, 'customer_profile'), customerNeed: stringField(value, 'customer_need'),
    customerQuestions: stringList(value, 'customer_questions', true), barriers: stringList(value, 'barriers', true),
    productFeedback: stringList(value, 'product_feedback', true), advisorName: stringField(value, 'advisor_name'),
    objectionHandlingAssessment: stringField(value, 'objection_handling_assessment'), improvementAreas: stringList(value, 'improvement_areas', true),
    actionableRecommendations: stringList(value, 'actionable_recommendations', true)
  };
}

function validateCoachingResult(value) {
  const corrections = Array.isArray(value?.script_corrections) ? value.script_corrections : [];
  return {
    advisorName: stringField(value, 'advisor_name'), callTopic: stringField(value, 'call_topic'),
    salesPitchAudit: stringList(value, 'sales_pitch_audit', true), tonePitchAnalysis: stringList(value, 'tone_pitch_analysis', true),
    talkToListenRatio: stringField(value, 'talk_to_listen_ratio'), listeningSkillNotes: stringField(value, 'listening_skill_notes'),
    probingGapNotes: stringField(value, 'probing_gap_notes'),
    scriptCorrections: corrections.map(item => ({ timestamp: stringField(item, 'timestamp'), wrong: stringField(item, 'wrong'), correct: stringField(item, 'correct') })),
    weeklyGrowthPlan: stringList(value, 'weekly_growth_plan', true)
  };
}

function listMarkdown(items) {
  return items.length ? items.map(item => `- ${item}`).join('\n') : '—';
}

function tableCell(value) {
  return String(value === null || value === undefined || value === '' ? '—' : value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function scoreRowsMarkdown(scores) {
  return scores.map(row => `| **${tableCell(row.category)}**<br>${tableCell(row.parameter)} | ${formatNumber(row.maximum)} | ${formatNumber(row.achieved)} | ${formatNumber(row.deducted)} | ${tableCell(row.timestamp)} | ${tableCell(row.deductionReason)} |`).join('\n');
}

function scriptRowsMarkdown(items) {
  return items.length ? items.map(item => `| ${tableCell(item.timestamp)} | ${tableCell(item.wrong)} | ${tableCell(item.correct)} |`).join('\n') : '| — | — | — |';
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : Number(value.toFixed(2)).toString();
}

function renderQaCall(template, result, companyName, evaluationDate) {
  return renderTemplate(template, {
    company_name: companyName, call_summary: result.callSummary, client_type_and_need: result.clientTypeAndNeed,
    call_duration_and_tone: result.callDurationAndTone, agent_name: result.agentName, evaluation_date: evaluationDate,
    final_score: formatNumber(result.finalScore), max_score: formatNumber(result.maximum),
    critical_error_note: result.ceDetected ? '(Critical Error detected: final score set to zero)' : '',
    product_fact_check: result.productFactCheck, ce_audit_details: result.ceAuditDetails, ce_alert: result.ceAlert,
    scorecard_rows: scoreRowsMarkdown(result.scores), achieved_score: formatNumber(result.achievedScore),
    deducted_score: formatNumber(result.deductedScore), status_label: result.ceDetected ? 'CE' : 'Non-CE',
    deduction_justification_sections: listMarkdown(result.deductionJustifications), strengths_list: listMarkdown(result.strengths),
    script_correction_pairs: scriptRowsMarkdown(result.scriptCorrections), actionable_tips: listMarkdown(result.actionableTips),
    overall_status: result.overallStatus
  });
}

function aggregateQaResults(results, fileNames) {
  const byAgent = new Map();
  const byCategory = new Map();
  results.forEach((result, index) => {
    if (!byAgent.has(result.agentName)) byAgent.set(result.agentName, []);
    byAgent.get(result.agentName).push(result);
    const callCategories = new Map();
    for (const row of result.scores) {
      if (!callCategories.has(row.category)) callCategories.set(row.category, { maximum: 0, achieved: 0, deducted: 0 });
      const value = callCategories.get(row.category);
      value.maximum += row.maximum; value.achieved += row.achieved; value.deducted += row.deducted;
    }
    for (const [name, value] of callCategories) {
      if (!byCategory.has(name)) byCategory.set(name, { maximum: 0, achieved: 0, deducted: 0, count: 0 });
      const category = byCategory.get(name);
      category.maximum += value.maximum; category.achieved += value.achieved; category.deducted += value.deducted; category.count += 1;
    }
    result.fileName = fileNames[index];
  });
  const agentRows = Array.from(byAgent, ([agent, calls]) => {
    const scores = calls.map(call => call.finalScore);
    return `| ${tableCell(agent)} | ${calls.length} | ${formatNumber(scores.reduce((a, b) => a + b, 0) / calls.length)} | ${formatNumber(Math.max(...scores))} | ${formatNumber(Math.min(...scores))} | ${calls.filter(call => call.ceDetected).length} |`;
  }).join('\n');
  const categoryRows = Array.from(byCategory, ([category, value]) => `| ${tableCell(category)} | ${formatNumber(value.maximum / value.count)} | ${formatNumber(value.achieved / value.count)} | ${formatNumber(value.deducted / value.count)} |`).join('\n');
  const ordered = results.map((result, index) => ({ fileName: fileNames[index], score: result.finalScore, agentName: result.agentName }));
  const best = ordered.reduce((a, b) => b.score > a.score ? b : a);
  const worst = ordered.reduce((a, b) => b.score < a.score ? b : a);
  return { agentRows, categoryRows, best, worst };
}

function renderQaSummary(template, summary, results, fileNames, companyName, parameter, evaluationDate) {
  const aggregate = aggregateQaResults(results, fileNames);
  return renderTemplate(template, {
    company_name: companyName, evaluation_date: evaluationDate, total_calls: results.length, parameter_set_name: parameter,
    agent_summary_rows: aggregate.agentRows, category_average_rows: aggregate.categoryRows,
    recurring_issues_list: listMarkdown(summary.recurringIssues),
    best_and_worst_calls: `${summary.bestAndWorstCalls}\n\n- **Best:** ${aggregate.best.fileName} — ${formatNumber(aggregate.best.score)}\n- **Worst:** ${aggregate.worst.fileName} — ${formatNumber(aggregate.worst.score)}`,
    overall_recommendations: listMarkdown(summary.overallRecommendations)
  });
}

function renderVoice(template, result, totalCalls) {
  return renderTemplate(template, {
    total_calls_analyzed: totalCalls, advisors_list: result.advisorsList, overall_sentiment: result.overallSentiment,
    customer_profile: result.customerProfile, customer_need: result.customerNeed, customer_questions_list: listMarkdown(result.customerQuestions),
    barriers_list: listMarkdown(result.barriers), product_feedback_list: listMarkdown(result.productFeedback), advisor_name: result.advisorName,
    objection_handling_assessment: result.objectionHandlingAssessment, improvement_areas: listMarkdown(result.improvementAreas),
    actionable_recommendations: listMarkdown(result.actionableRecommendations)
  });
}

function renderCoaching(template, result, companyName) {
  return renderTemplate(template, {
    advisor_name: result.advisorName, evaluator_role: `${companyName} Senior Sales Communication Coach`, call_topic: result.callTopic,
    sales_pitch_audit_points: listMarkdown(result.salesPitchAudit), tone_pitch_analysis_points: listMarkdown(result.tonePitchAnalysis),
    talk_to_listen_ratio: result.talkToListenRatio, listening_skill_notes: result.listeningSkillNotes, probing_gap_notes: result.probingGapNotes,
    script_correction_rows: scriptRowsMarkdown(result.scriptCorrections), weekly_growth_plan: listMarkdown(result.weeklyGrowthPlan)
  });
}

function auditResultRow(result, parameter, timestamp) {
  const sections = {
    product: `${result.productFactCheck}\n\n${result.ceAuditDetails}\n\n${result.ceAlert}`,
    deductions: listMarkdown(result.deductionJustifications), strengths: listMarkdown(result.strengths),
    scripts: scriptRowsMarkdown(result.scriptCorrections),
    coaching: `${listMarkdown(result.actionableTips)}\n\nOverall Status: ${result.overallStatus}`
  };
  return [timestamp, result.agentName, parameter, result.finalScore, JSON.stringify({ maximum: result.maximum, achieved: result.achievedScore, deducted: result.deductedScore, final: result.finalScore, categories: result.scores }), result.ceDetected ? 'CE' : 'Non-CE', sections.product, sections.deductions, sections.strengths, sections.scripts, sections.coaching];
}

function auditResultRowFromMarkdown(result, parameter, timestamp) {
  return [
    timestamp, result.agentName, parameter, result.finalScore,
    JSON.stringify({ source: 'markdown', maximum: result.maximum, achieved: result.achievedScore, deducted: result.deductedScore, final: result.finalScore, categories: result.scores }),
    result.ceDetected ? 'CE' : 'Non-CE', result.productFactCheck, markdownSection(result.markdown, 4), markdownSection(result.markdown, 5), result.scriptSection, markdownSection(result.markdown, 7)
  ];
}

function qaSchema(rubric) {
  const scoreProperties = row => ({ type: 'object', additionalProperties: false, required: ['category', 'parameter', 'maximum', 'achieved', 'timestamp', 'deduction_reason'], properties: { category: { type: 'string', enum: [row.category] }, parameter: { type: 'string', enum: [row.parameter] }, maximum: { type: 'number', enum: [row.maximum] }, achieved: { type: 'number', minimum: 0, maximum: row.maximum }, timestamp: { type: 'string' }, deduction_reason: { type: 'string' } } });
  const genericScore = { type: 'object', additionalProperties: false, required: ['category', 'parameter', 'maximum', 'achieved', 'timestamp', 'deduction_reason'], properties: { category: { type: 'string' }, parameter: { type: 'string' }, maximum: { type: 'number' }, achieved: { type: 'number' }, timestamp: { type: 'string' }, deduction_reason: { type: 'string' } } };
  const timestampedNarrative = { type: 'object', additionalProperties: false, required: ['timestamp', 'detail'], properties: { timestamp: { type: 'string', description: 'Precise call time in [MM:SS] or [MM:SS-MM:SS] format.' }, detail: { type: 'string', description: 'Evidence-based Bangla observation or recommendation tied to this call time.' } } };
  return { type: 'object', additionalProperties: false, required: ['agent_name', 'call_summary', 'client_type_and_need', 'call_duration_and_tone', 'product_fact_check', 'customer_enrollment_status', 'call_objective', 'sales_pitch_applicable', 'sales_pitch_applicability_evidence', 'ce_detected', 'ce_audit_details', 'ce_alert', 'scores', 'deduction_justifications', 'strengths', 'script_corrections', 'actionable_tips', 'overall_status'], properties: {
    agent_name: { type: 'string' }, call_summary: { type: 'string' }, client_type_and_need: { type: 'string' }, call_duration_and_tone: { type: 'string' }, product_fact_check: { type: 'string' },
    customer_enrollment_status: { type: 'string', enum: ['enrolled', 'prospect', 'unclear'] }, call_objective: { type: 'string', enum: ['sales', 'feedback', 'service_check', 'support', 'mixed', 'unclear'] }, sales_pitch_applicable: { type: 'boolean' }, sales_pitch_applicability_evidence: timestampedNarrative,
    ce_detected: { type: 'boolean' }, ce_audit_details: { type: 'string' }, ce_alert: { type: 'string' },
    scores: { type: 'array', minItems: rubric.rows.length, maxItems: rubric.rows.length, prefixItems: rubric.rows.map(scoreProperties), items: genericScore },
    deduction_justifications: { type: 'array', items: timestampedNarrative }, strengths: { type: 'array', items: timestampedNarrative },
    script_corrections: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['timestamp', 'wrong', 'correct'], properties: { timestamp: { type: 'string' }, wrong: { type: 'string' }, correct: { type: 'string' } } } },
    actionable_tips: { type: 'array', items: timestampedNarrative }, overall_status: { type: 'string' }
  } };
}

const SUMMARY_SCHEMA = { type: 'object', additionalProperties: false, required: ['recurring_issues', 'best_and_worst_calls', 'overall_recommendations'], properties: { recurring_issues: { type: 'array', items: { type: 'string' } }, best_and_worst_calls: { type: 'string' }, overall_recommendations: { type: 'array', items: { type: 'string' } } } };
const VOICE_SCHEMA = { type: 'object', additionalProperties: false, required: ['advisors_list', 'overall_sentiment', 'customer_profile', 'customer_need', 'customer_questions', 'barriers', 'product_feedback', 'advisor_name', 'objection_handling_assessment', 'improvement_areas', 'actionable_recommendations'], properties: Object.fromEntries(['advisors_list', 'overall_sentiment', 'customer_profile', 'customer_need', 'advisor_name', 'objection_handling_assessment'].map(key => [key, { type: 'string' }]).concat(['customer_questions', 'barriers', 'product_feedback', 'improvement_areas', 'actionable_recommendations'].map(key => [key, { type: 'array', items: { type: 'string' } }]))) };
const COACHING_SCHEMA = { type: 'object', additionalProperties: false, required: ['advisor_name', 'call_topic', 'sales_pitch_audit', 'tone_pitch_analysis', 'talk_to_listen_ratio', 'listening_skill_notes', 'probing_gap_notes', 'script_corrections', 'weekly_growth_plan'], properties: { advisor_name: { type: 'string' }, call_topic: { type: 'string' }, sales_pitch_audit: { type: 'array', items: { type: 'string' } }, tone_pitch_analysis: { type: 'array', items: { type: 'string' } }, talk_to_listen_ratio: { type: 'string' }, listening_skill_notes: { type: 'string' }, probing_gap_notes: { type: 'string' }, script_corrections: qaSchema({ rows: [] }).properties.script_corrections, weekly_growth_plan: { type: 'array', items: { type: 'string' } } } };

module.exports = { toEnglishDigits, parseQaRubric, loadTemplate, loadAndValidateTemplates, renderTemplate, validateQaResult, validateSummaryResult, validateVoiceResult, validateCoachingResult, renderQaCall, renderQaSummary, renderVoice, renderCoaching, parseQaMarkdownReport, auditResultRow, auditResultRowFromMarkdown, qaSchema, SUMMARY_SCHEMA, VOICE_SCHEMA, COACHING_SCHEMA };
