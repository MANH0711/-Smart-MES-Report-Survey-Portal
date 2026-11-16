import {
  CatalogForm,
  CatalogReport,
  Department,
  DxDemandLevel,
  PriorityMatrixItem,
  PriorityTier,
  SurveyResponse,
  UsageFrequency,
} from '../types/survey';

const FREQ_WEIGHT: Record<UsageFrequency, number> = {
  multi_daily: 5,
  daily: 4,
  weekly: 3,
  monthly: 2,
  rarely: 1,
};

const FREQ_WEEKLY_MULTIPLIER: Record<UsageFrequency, number> = {
  multi_daily: 10,
  daily: 5,
  weekly: 1,
  monthly: 0.25,
  rarely: 0.1,
};

const DX_SCORE: Record<DxDemandLevel, number> = {
  essential: 5,
  needed: 4,
  neutral: 3,
  not_yet: 2,
  no_need: 1,
};

export function classifyPriorityTier(normalizedScore: number): PriorityTier {
  if (normalizedScore >= 75) return 'P1';
  if (normalizedScore >= 55) return 'P2';
  if (normalizedScore >= 35) return 'P3';
  return 'P4';
}

export interface AnalyticsResult {
  sampleCount: number;
  targetParticipants: number;
  responseRatePct: number;
  meetsSampleThreshold: boolean;
  minSampleThreshold: number;
  completionRatePct: number;
  totalUniqueFormsUsed: number;
  totalUniqueReportsUsed: number;
  mostUsedForm: { name: string; count: number } | null;
  mostUsedReport: { name: string; count: number } | null;
  topDxFeature: { name: string; score: number } | null;
  topPainPoint: { label: string; count: number } | null;
  automatableHoursPerWeek: number;
  avgUxSatisfaction: number;

  formsByDepartment: { department: string; code: string; formsCount: number; reportsCount: number; responses: number }[];
  formFrequencyChart: { name: string; multiDaily: number; daily: number; weekly: number; monthly: number; total: number }[];
  reportFrequencyChart: { name: string; count: number; realtimeNeedPct: number; excelNeedPct: number; avgLoadSec: number }[];
  satisfactionByDepartment: { department: string; uxScore: number; formUsability: number; reportFit: number }[];
  painPointsChart: { category: string; count: number }[];
  improvementRequestsChart: { category: string; count: number }[];
  dxPriorityChart: { feature: string; avgDemand: number; essentialCount: number; totalVotes: number }[];
  crossDeptComparison: { department: string; formCount: number; manualHours: number; dxUrgency: number; uxScore: number }[];

  formsNeedingUpgrade: { formName: string; importance: number; usability: number; businessFit: number; mentions: number; samplePain: string }[];
  underutilizedForms: { formName: string; groupId: string; mentions: number; reason: string }[];
  duplicateClusters: { itemType: 'Form' | 'Report'; primaryName: string; overlappingWith: string[]; mentions: number }[];
  reportsNeedingRealtime: { reportName: string; realtimeVotes: number; avgLoadSec: number; totalVotes: number }[];
  automationCandidates: { processName: string; hoursPerWeek: number; avgImpact: number; mentions: number; topIdea: string }[];
  priorityMatrix: PriorityMatrixItem[];
}

export function computeSurveyAnalytics(
  responses: SurveyResponse[],
  departments: Department[],
  catalogForms: CatalogForm[],
  catalogReports: CatalogReport[],
  targetParticipants: number,
  minSampleThreshold: number
): AnalyticsResult {
  const submitted = responses.filter((r) => r.status === 'submitted');
  const sampleCount = submitted.length;
  const responseRatePct = targetParticipants > 0 ? Math.min(100, Math.round((sampleCount / targetParticipants) * 1000) / 10) : 0;
  const meetsSampleThreshold = sampleCount >= minSampleThreshold;
  const completionRatePct = responses.length > 0 ? Math.round((submitted.length / responses.length) * 1000) / 10 : 0;

  const deptMap = new Map(departments.map((d) => [d.id, d]));

  // Aggregate forms
  const formStats = new Map<
    string,
    {
      name: string;
      groupId: string;
      count: number;
      multiDaily: number;
      daily: number;
      weekly: number;
      monthly: number;
      rarely: number;
      importanceSum: number;
      usabilitySum: number;
      fitSum: number;
      depts: Set<string>;
      pains: string[];
      improvements: string[];
    }
  >();

  // Aggregate reports
  const reportStats = new Map<
    string,
    {
      name: string;
      categoryId: string;
      count: number;
      realtimeCount: number;
      excelCount: number;
      mobileCount: number;
      emailCount: number;
      loadSecSum: number;
      satSum: number;
      freqSum: number;
      depts: Set<string>;
      duplicates: Set<string>;
    }
  >();

  // Aggregate workflows
  const workflowStats = new Map<
    string,
    {
      name: string;
      mentions: number;
      weeklyHoursSum: number;
      impactSum: number;
      freqSum: number;
      depts: Set<string>;
      ideas: string[];
    }
  >();

  // Aggregate DX
  const dxStats = new Map<
    string,
    {
      name: string;
      scoreSum: number;
      essentialCount: number;
      votes: number;
      depts: Set<string>;
    }
  >();

  // Department stats
  const deptAgg = new Map<
    string,
    {
      responses: number;
      formsCount: number;
      reportsCount: number;
      uxSum: number;
      usabilitySum: number;
      usabilityCount: number;
      reportSatSum: number;
      reportSatCount: number;
      manualHours: number;
      dxSum: number;
      dxCount: number;
    }
  >();

  // Pain point keyword clustering
  const painBuckets: Record<string, number> = {
    'Manual / Duplicate Entry': 0,
    'Slow Page / Report Load': 0,
    'System Integration Gap (ERP/WMS/PLC)': 0,
    'Complex UI / Many Clicks': 0,
    'No Real-time Alert / Delay': 0,
    'Paper / Excel Dependency': 0,
  };

  const improvementBuckets: Record<string, number> = {
    'Real-time Dashboard & Alerts': 0,
    'Mobile MES & Digital Approval': 0,
    'Auto Equipment / PLC Integration': 0,
    'ERP / WMS Bi-directional Sync': 0,
    'Report Consolidation & BI': 0,
    'AI / Predictive Analytics': 0,
  };

  let uxGlobalSum = 0;
  let uxGlobalCount = 0;
  let totalAutomatableHours = 0;

  for (const resp of submitted) {
    const dAgg = deptAgg.get(resp.departmentId) || {
      responses: 0,
      formsCount: 0,
      reportsCount: 0,
      uxSum: 0,
      usabilitySum: 0,
      usabilityCount: 0,
      reportSatSum: 0,
      reportSatCount: 0,
      manualHours: 0,
      dxSum: 0,
      dxCount: 0,
    };
    dAgg.responses += 1;

    // UX average
    const uxValues = [
      resp.uxRatings.uiEase,
      resp.uxRatings.searchSpeed,
      resp.uxRatings.stepEfficiency,
      resp.uxRatings.pageLoadSpeed,
      resp.uxRatings.errorStability,
      resp.uxRatings.dataAccuracy,
      resp.uxRatings.permissionFit,
    ].filter((v) => typeof v === 'number' && v > 0);
    if (uxValues.length > 0) {
      const avg = uxValues.reduce((a, b) => a + b, 0) / uxValues.length;
      dAgg.uxSum += avg;
      uxGlobalSum += avg;
      uxGlobalCount += 1;
    }

    // Forms
    const forms = Array.isArray(resp.selectedForms) ? resp.selectedForms : [];
    dAgg.formsCount += forms.length;
    for (const f of forms) {
      const fName = typeof f.formName === 'string' && f.formName ? f.formName : f.formId || 'Unknown Form';
      const fGroup = f.groupId || 'production';
      const impVal = typeof f.importance === 'number' && !Number.isNaN(f.importance) ? f.importance : 4;
      const usaVal = typeof f.usability === 'number' && !Number.isNaN(f.usability) ? f.usability : 3;
      const fitVal = typeof f.businessFit === 'number' && !Number.isNaN(f.businessFit) ? f.businessFit : 3;
      const painStr = Array.isArray(f.painPoints)
        ? f.painPoints.join(', ')
        : typeof f.painPoints === 'string'
          ? f.painPoints
          : '';
      const impStr = Array.isArray(f.improvements)
        ? f.improvements.join(', ')
        : typeof f.improvements === 'string'
          ? f.improvements
          : '';

      const entry = formStats.get(f.formId) || {
        name: fName,
        groupId: fGroup,
        count: 0,
        multiDaily: 0,
        daily: 0,
        weekly: 0,
        monthly: 0,
        rarely: 0,
        importanceSum: 0,
        usabilitySum: 0,
        fitSum: 0,
        depts: new Set<string>(),
        pains: [],
        improvements: [],
      };
      entry.count += 1;
      if (f.frequency === 'multi_daily') entry.multiDaily += 1;
      else if (f.frequency === 'daily') entry.daily += 1;
      else if (f.frequency === 'weekly') entry.weekly += 1;
      else if (f.frequency === 'monthly') entry.monthly += 1;
      else entry.rarely += 1;

      entry.importanceSum += impVal;
      entry.usabilitySum += usaVal;
      entry.fitSum += fitVal;
      entry.depts.add(resp.departmentId);
      if (painStr) entry.pains.push(painStr);
      if (impStr) entry.improvements.push(impStr);
      formStats.set(f.formId, entry);

      dAgg.usabilitySum += usaVal;
      dAgg.usabilityCount += 1;

      classifyPainText(painStr, painBuckets);
      classifyImprovementText(impStr, improvementBuckets);
    }

    // Reports
    dAgg.reportsCount += resp.selectedReports.length;
    for (const r of resp.selectedReports) {
      const entry = reportStats.get(r.reportId) || {
        name: r.reportName,
        categoryId: r.categoryId,
        count: 0,
        realtimeCount: 0,
        excelCount: 0,
        mobileCount: 0,
        emailCount: 0,
        loadSecSum: 0,
        satSum: 0,
        freqSum: 0,
        depts: new Set<string>(),
        duplicates: new Set<string>(),
      };
      entry.count += 1;
      if (r.needRealtime) entry.realtimeCount += 1;
      if (r.needExcel) entry.excelCount += 1;
      if (r.needMobile) entry.mobileCount += 1;
      if (r.needAutoEmail) entry.emailCount += 1;
      entry.loadSecSum += r.loadTimeSec || 0;
      entry.satSum += r.satisfaction || 3;
      entry.freqSum += FREQ_WEIGHT[r.frequency] || 3;
      entry.depts.add(resp.departmentId);
      if (r.duplicateReports) {
        r.duplicateReports
          .split(/[,;/]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((dup) => entry.duplicates.add(dup));
      }
      reportStats.set(r.reportId, entry);

      dAgg.reportSatSum += r.satisfaction || 3;
      dAgg.reportSatCount += 1;
    }

    // Workflows
    for (const wf of resp.workflowEvaluations) {
      const weeklyHours = ((wf.processingMinutes || 0) / 60) * (FREQ_WEEKLY_MULTIPLIER[wf.frequency] || 1) * Math.max(1, wf.participantCount || 1);
      totalAutomatableHours += weeklyHours;
      dAgg.manualHours += weeklyHours;

      const entry = workflowStats.get(wf.processId) || {
        name: wf.processName,
        mentions: 0,
        weeklyHoursSum: 0,
        impactSum: 0,
        freqSum: 0,
        depts: new Set<string>(),
        ideas: [],
      };
      entry.mentions += 1;
      entry.weeklyHoursSum += weeklyHours;
      entry.impactSum += wf.impactScore || 3;
      entry.freqSum += FREQ_WEIGHT[wf.frequency] || 3;
      entry.depts.add(resp.departmentId);
      if (wf.automationIdea) entry.ideas.push(wf.automationIdea);
      workflowStats.set(wf.processId, entry);

      classifyPainText(wf.difficulties, painBuckets);
      classifyImprovementText(wf.automationIdea, improvementBuckets);
    }

    // DX Needs
    for (const dx of resp.dxNeeds) {
      const score = DX_SCORE[dx.demandLevel] || 3;
      dAgg.dxSum += score;
      dAgg.dxCount += 1;

      const entry = dxStats.get(dx.featureId) || {
        name: dx.featureName,
        scoreSum: 0,
        essentialCount: 0,
        votes: 0,
        depts: new Set<string>(),
      };
      entry.scoreSum += score;
      if (dx.demandLevel === 'essential') entry.essentialCount += 1;
      entry.votes += 1;
      entry.depts.add(resp.departmentId);
      dxStats.set(dx.featureId, entry);
    }

    // Proposals text clustering
    classifyPainText(resp.proposals.biggestChallenge, painBuckets);
    classifyImprovementText(resp.proposals.topImprovement, improvementBuckets);
    classifyImprovementText(resp.proposals.dxProposal, improvementBuckets);

    deptAgg.set(resp.departmentId, dAgg);
  }

  // Sort helpers
  const formArray = Array.from(formStats.entries()).map(([id, v]) => ({ id, ...v }));
  formArray.sort((a, b) => b.count - a.count);

  const reportArray = Array.from(reportStats.entries()).map(([id, v]) => ({ id, ...v }));
  reportArray.sort((a, b) => b.count - a.count);

  const dxArray = Array.from(dxStats.entries()).map(([id, v]) => ({
    id,
    name: v.name,
    avgDemand: v.votes > 0 ? Math.round((v.scoreSum / v.votes) * 100) / 100 : 0,
    essentialCount: v.essentialCount,
    totalVotes: v.votes,
    depts: v.depts,
  }));
  dxArray.sort((a, b) => b.avgDemand * b.totalVotes - a.avgDemand * a.totalVotes);

  const painList = Object.entries(painBuckets)
    .map(([label, count]) => ({ category: label, count }))
    .sort((a, b) => b.count - a.count);

  const improvementList = Object.entries(improvementBuckets)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // Build department charts
  const formsByDepartment = Array.from(deptAgg.entries()).map(([deptId, v]) => {
    const dept = deptMap.get(deptId);
    return {
      department: dept ? dept.code : deptId,
      code: dept ? dept.code : deptId,
      formsCount: v.formsCount,
      reportsCount: v.reportsCount,
      responses: v.responses,
    };
  });

  const satisfactionByDepartment = Array.from(deptAgg.entries()).map(([deptId, v]) => {
    const dept = deptMap.get(deptId);
    return {
      department: dept ? dept.code : deptId,
      uxScore: v.responses > 0 ? Math.round((v.uxSum / v.responses) * 100) / 100 : 0,
      formUsability: v.usabilityCount > 0 ? Math.round((v.usabilitySum / v.usabilityCount) * 100) / 100 : 0,
      reportFit: v.reportSatCount > 0 ? Math.round((v.reportSatSum / v.reportSatCount) * 100) / 100 : 0,
    };
  });

  const crossDeptComparison = Array.from(deptAgg.entries()).map(([deptId, v]) => {
    const dept = deptMap.get(deptId);
    return {
      department: dept ? dept.code : deptId,
      formCount: v.formsCount,
      manualHours: Math.round(v.manualHours * 10) / 10,
      dxUrgency: v.dxCount > 0 ? Math.round((v.dxSum / v.dxCount) * 100) / 100 : 0,
      uxScore: v.responses > 0 ? Math.round((v.uxSum / v.responses) * 100) / 100 : 0,
    };
  });

  // Automated recommendations
  const formsNeedingUpgrade = formArray
    .map((f) => ({
      formName: f.name,
      importance: Math.round((f.importanceSum / f.count) * 10) / 10,
      usability: Math.round((f.usabilitySum / f.count) * 10) / 10,
      businessFit: Math.round((f.fitSum / f.count) * 10) / 10,
      mentions: f.count,
      samplePain: f.pains[0] || '',
    }))
    .filter((f) => f.importance >= 4 && (f.usability <= 3.2 || f.businessFit <= 3.2))
    .sort((a, b) => b.importance - b.usability - (a.importance - a.usability));

  const underutilizedForms = catalogForms
    .filter((cf) => cf.active)
    .map((cf) => {
      const found = formStats.get(cf.id);
      const mentions = found ? found.count : 0;
      const rarelyCount = found ? found.rarely + found.monthly : 0;
      return {
        formName: cf.nameEn,
        groupId: cf.groupId,
        mentions,
        reason: mentions === 0 ? 'Zero reported usage in current sample' : 'Mostly monthly/rarely usage pattern',
        isUnder: mentions === 0 || (mentions <= 1 && rarelyCount === mentions),
      };
    })
    .filter((x) => x.isUnder)
    .slice(0, 12)
    .map(({ formName, groupId, mentions, reason }) => ({ formName, groupId, mentions, reason }));

  const duplicateClusters: AnalyticsResult['duplicateClusters'] = [];
  for (const r of reportArray) {
    if (r.duplicates.size > 0) {
      duplicateClusters.push({
        itemType: 'Report',
        primaryName: r.name,
        overlappingWith: Array.from(r.duplicates),
        mentions: r.count,
      });
    }
  }

  const reportsNeedingRealtime = reportArray
    .filter((r) => r.realtimeCount > 0)
    .map((r) => ({
      reportName: r.name,
      realtimeVotes: r.realtimeCount,
      avgLoadSec: Math.round((r.loadSecSum / r.count) * 10) / 10,
      totalVotes: r.count,
    }))
    .sort((a, b) => b.realtimeVotes - a.realtimeVotes);

  const automationCandidates = Array.from(workflowStats.values())
    .map((w) => ({
      processName: w.name,
      hoursPerWeek: Math.round(w.weeklyHoursSum * 10) / 10,
      avgImpact: Math.round((w.impactSum / w.mentions) * 10) / 10,
      mentions: w.mentions,
      topIdea: w.ideas[0] || '',
    }))
    .sort((a, b) => b.hoursPerWeek * b.avgImpact - a.hoursPerWeek * a.avgImpact);

  // Priority Matrix: Priority Score = Business Impact (1-5) × Usage Frequency (1-5) × User Demand (1-5) -> Max = 125, normalized to 100
  const priorityMatrix: PriorityMatrixItem[] = [];
  const totalDeptDenominator = Math.max(1, sampleCount);

  for (const f of formArray) {
    const avgImp = f.importanceSum / f.count;
    const avgUsability = f.usabilitySum / f.count;
    const avgFit = f.fitSum / f.count;
    const weightedFreq =
      (f.multiDaily * 5 + f.daily * 4 + f.weekly * 3 + f.monthly * 2 + f.rarely * 1) / f.count;
    // User Demand combines adoption share + pain gap (low usability/fit raises demand for upgrade)
    const gapBoost = Math.max(0, 5 - (avgUsability + avgFit) / 2);
    const demand = Math.min(5, Math.max(1.5, (f.count / totalDeptDenominator) * 4 + gapBoost * 0.75));

    if (avgImp >= 3.5 && (avgUsability <= 3.5 || avgFit <= 3.5 || f.count >= 2)) {
      const rawScore = avgImp * weightedFreq * demand;
      const normalizedScore = Math.min(100, Math.round((rawScore / 125) * 100));
      priorityMatrix.push({
        id: `pm_form_${f.id}`,
        itemName: `Upgrade MES Form: ${f.name}`,
        category: 'form_upgrade',
        recommendationType: 'Form Modernization',
        businessImpact: Math.round(avgImp * 10) / 10,
        usageFrequency: Math.round(weightedFreq * 10) / 10,
        userDemand: Math.round(demand * 10) / 10,
        rawScore: Math.round(rawScore * 10) / 10,
        normalizedScore,
        tier: classifyPriorityTier(normalizedScore),
        departmentCount: f.depts.size,
        departments: Array.from(f.depts).map((id) => deptMap.get(id)?.code || id),
        sampleCount: f.count,
        rationale: f.pains[0] || 'High business criticality with usability or workflow friction.',
      });
    }
  }

  for (const r of reportArray) {
    if (r.realtimeCount > 0 || r.duplicates.size > 0) {
      const avgFreq = r.freqSum / r.count;
      const avgSat = r.satSum / r.count;
      const impact = Math.min(5, Math.max(2.5, (r.realtimeCount / r.count) * 2.5 + (5 - avgSat) * 0.8 + 1.5));
      const demand = Math.min(5, Math.max(2, (r.count / totalDeptDenominator) * 4 + (r.realtimeCount / r.count) * 2));
      const rawScore = impact * avgFreq * demand;
      const normalizedScore = Math.min(100, Math.round((rawScore / 125) * 100));
      const isConsolidate = r.duplicates.size > 0 && r.realtimeCount === 0;
      priorityMatrix.push({
        id: `pm_rpt_${r.id}`,
        itemName: isConsolidate ? `Consolidate Report: ${r.name}` : `Real-time BI Report: ${r.name}`,
        category: isConsolidate ? 'report_consolidate' : 'report_realtime',
        recommendationType: isConsolidate ? 'Report Consolidation' : 'Real-time Enablement',
        businessImpact: Math.round(impact * 10) / 10,
        usageFrequency: Math.round(avgFreq * 10) / 10,
        userDemand: Math.round(demand * 10) / 10,
        rawScore: Math.round(rawScore * 10) / 10,
        normalizedScore,
        tier: classifyPriorityTier(normalizedScore),
        departmentCount: r.depts.size,
        departments: Array.from(r.depts).map((id) => deptMap.get(id)?.code || id),
        sampleCount: r.count,
        rationale: r.duplicates.size > 0
          ? `Overlaps with: ${Array.from(r.duplicates).join(', ')}. Avg load: ${Math.round(r.loadSecSum / r.count)}s.`
          : `${r.realtimeCount}/${r.count} respondents require Real-time streaming (current load ${Math.round(r.loadSecSum / r.count)}s).`,
      });
    }
  }

  for (const [wfId, w] of workflowStats.entries()) {
    const avgImp = w.impactSum / w.mentions;
    const avgFreq = w.freqSum / w.mentions;
    const demand = Math.min(5, Math.max(2, (w.mentions / totalDeptDenominator) * 4 + (w.weeklyHoursSum > 10 ? 1.5 : 0.8)));
    const rawScore = avgImp * avgFreq * demand;
    const normalizedScore = Math.min(100, Math.round((rawScore / 125) * 100));
    priorityMatrix.push({
      id: `pm_wf_${wfId}`,
      itemName: `Automate Workflow: ${w.name}`,
      category: 'workflow_automation',
      recommendationType: 'Process Automation',
      businessImpact: Math.round(avgImp * 10) / 10,
      usageFrequency: Math.round(avgFreq * 10) / 10,
      userDemand: Math.round(demand * 10) / 10,
      rawScore: Math.round(rawScore * 10) / 10,
      normalizedScore,
      tier: classifyPriorityTier(normalizedScore),
      departmentCount: w.depts.size,
      departments: Array.from(w.depts).map((id) => deptMap.get(id)?.code || id),
      sampleCount: w.mentions,
      rationale: `${Math.round(w.weeklyHoursSum)} hrs/week manual effort. ${w.ideas[0] || ''}`,
    });
  }

  for (const dx of dxArray.slice(0, 8)) {
    const impact = Math.min(5, Math.max(2.5, dx.avgDemand * 0.9 + (dx.depts.size >= 3 ? 0.5 : 0)));
    const freq = Math.min(5, Math.max(2.5, 2.5 + (dx.essentialCount / Math.max(1, dx.totalVotes)) * 2.5));
    const demand = dx.avgDemand;
    const rawScore = impact * freq * demand;
    const normalizedScore = Math.min(100, Math.round((rawScore / 125) * 100));
    priorityMatrix.push({
      id: `pm_dx_${dx.id}`,
      itemName: `DX Capability: ${dx.name}`,
      category: 'dx_capability',
      recommendationType: 'Smart Factory Capability',
      businessImpact: Math.round(impact * 10) / 10,
      usageFrequency: Math.round(freq * 10) / 10,
      userDemand: Math.round(demand * 10) / 10,
      rawScore: Math.round(rawScore * 10) / 10,
      normalizedScore,
      tier: classifyPriorityTier(normalizedScore),
      departmentCount: dx.depts.size,
      departments: Array.from(dx.depts).map((id) => deptMap.get(id)?.code || id),
      sampleCount: dx.totalVotes,
      rationale: `${dx.essentialCount}/${dx.totalVotes} rated Essential across ${dx.depts.size} department(s).`,
    });
  }

  priorityMatrix.sort((a, b) => b.normalizedScore - a.normalizedScore);

  return {
    sampleCount,
    targetParticipants,
    responseRatePct,
    meetsSampleThreshold,
    minSampleThreshold,
    completionRatePct,
    totalUniqueFormsUsed: formArray.length,
    totalUniqueReportsUsed: reportArray.length,
    mostUsedForm: formArray[0] ? { name: formArray[0].name, count: formArray[0].count } : null,
    mostUsedReport: reportArray[0] ? { name: reportArray[0].name, count: reportArray[0].count } : null,
    topDxFeature: dxArray[0] ? { name: dxArray[0].name, score: dxArray[0].avgDemand } : null,
    topPainPoint: painList[0] && painList[0].count > 0 ? { label: painList[0].category, count: painList[0].count } : null,
    automatableHoursPerWeek: Math.round(totalAutomatableHours * 10) / 10,
    avgUxSatisfaction: uxGlobalCount > 0 ? Math.round((uxGlobalSum / uxGlobalCount) * 100) / 100 : 0,
    formsByDepartment,
    formFrequencyChart: formArray.slice(0, 10).map((f) => ({
      name: f.name,
      multiDaily: f.multiDaily,
      daily: f.daily,
      weekly: f.weekly,
      monthly: f.monthly + f.rarely,
      total: f.count,
    })),
    reportFrequencyChart: reportArray.slice(0, 10).map((r) => ({
      name: r.name,
      count: r.count,
      realtimeNeedPct: Math.round((r.realtimeCount / r.count) * 100),
      excelNeedPct: Math.round((r.excelCount / r.count) * 100),
      avgLoadSec: Math.round((r.loadSecSum / r.count) * 10) / 10,
    })),
    satisfactionByDepartment,
    painPointsChart: painList,
    improvementRequestsChart: improvementList,
    dxPriorityChart: dxArray.slice(0, 10).map((d) => ({
      feature: d.name,
      avgDemand: d.avgDemand,
      essentialCount: d.essentialCount,
      totalVotes: d.totalVotes,
    })),
    crossDeptComparison,
    formsNeedingUpgrade,
    underutilizedForms,
    duplicateClusters,
    reportsNeedingRealtime,
    automationCandidates,
    priorityMatrix,
  };
}

function classifyPainText(text: unknown, buckets: Record<string, number>) {
  if (!text) return;
  const raw = Array.isArray(text) ? text.join(' ') : typeof text === 'string' ? text : '';
  if (!raw) return;
  const lower = raw.toLowerCase();
  if (lower.includes('trùng') || lower.includes('nhập lại') || lower.includes('2 lần') || lower.includes('tay') || lower.includes('duplicate') || lower.includes('manual')) {
    buckets['Manual / Duplicate Entry'] += 1;
  }
  if (lower.includes('chậm') || lower.includes('lag') || lower.includes('lâu') || lower.includes('slow') || lower.includes('tải')) {
    buckets['Slow Page / Report Load'] += 1;
  }
  if (lower.includes('erp') || lower.includes('wms') || lower.includes('plc') || lower.includes('đồng bộ') || lower.includes('aoi') || lower.includes('sync')) {
    buckets['System Integration Gap (ERP/WMS/PLC)'] += 1;
  }
  if (lower.includes('bước') || lower.includes('phức tạp') || lower.includes('tìm kiếm') || lower.includes('khó') || lower.includes('click')) {
    buckets['Complex UI / Many Clicks'] += 1;
  }
  if (lower.includes('cảnh báo') || lower.includes('trễ') || lower.includes('alert') || lower.includes('real-time')) {
    buckets['No Real-time Alert / Delay'] += 1;
  }
  if (lower.includes('excel') || lower.includes('giấy') || lower.includes('paper') || lower.includes('bảng tính')) {
    buckets['Paper / Excel Dependency'] += 1;
  }
}

function classifyImprovementText(text: unknown, buckets: Record<string, number>) {
  if (!text) return;
  const raw = Array.isArray(text) ? text.join(' ') : typeof text === 'string' ? text : '';
  if (!raw) return;
  const lower = raw.toLowerCase();
  if (lower.includes('real-time') || lower.includes('thời gian thực') || lower.includes('dashboard') || lower.includes('cảnh báo')) {
    buckets['Real-time Dashboard & Alerts'] += 1;
  }
  if (lower.includes('mobile') || lower.includes('tablet') || lower.includes('điện thoại') || lower.includes('duyệt') || lower.includes('approval')) {
    buckets['Mobile MES & Digital Approval'] += 1;
  }
  if (lower.includes('plc') || lower.includes('máy') || lower.includes('thiết bị') || lower.includes('iot') || lower.includes('aoi') || lower.includes('scada')) {
    buckets['Auto Equipment / PLC Integration'] += 1;
  }
  if (lower.includes('erp') || lower.includes('wms') || lower.includes('tồn kho') || lower.includes('đồng bộ')) {
    buckets['ERP / WMS Bi-directional Sync'] += 1;
  }
  if (lower.includes('hợp nhất') || lower.includes('bi') || lower.includes('báo cáo') || lower.includes('data warehouse')) {
    buckets['Report Consolidation & BI'] += 1;
  }
  if (lower.includes('ai') || lower.includes('dự báo') || lower.includes('predictive')) {
    buckets['AI / Predictive Analytics'] += 1;
  }
}
