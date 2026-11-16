import { PriorityMatrixItem, SurveyResponse, Department } from '../types/survey';

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportResponsesToExcelCsv(
  responses: SurveyResponse[],
  departments: Department[],
  priorityMatrix: PriorityMatrixItem[]
) {
  const deptMap = new Map(departments.map((d) => [d.id, d.nameEn]));
  const rows: string[][] = [
    [
      'Response ID',
      'Campaign ID',
      'Department',
      'Section',
      'Anonymous',
      'Employee ID',
      'Full Name',
      'Job Title',
      'Shift',
      'MES Experience',
      'Frequent Systems',
      'MES Forms Selected',
      'Reports Selected',
      'Workflows Logged',
      'Avg UX Score',
      'Top Improvement Proposal',
      'Biggest Challenge',
      'Priority Tier',
      'Submitted At',
    ],
  ];

  for (const r of responses) {
    const uxVals = [
      r.uxRatings.uiEase,
      r.uxRatings.searchSpeed,
      r.uxRatings.stepEfficiency,
      r.uxRatings.pageLoadSpeed,
      r.uxRatings.errorStability,
      r.uxRatings.dataAccuracy,
      r.uxRatings.permissionFit,
    ];
    const avgUx = (uxVals.reduce((a, b) => a + b, 0) / uxVals.length).toFixed(2);
    rows.push([
      r.id,
      r.campaignId,
      deptMap.get(r.departmentId) || r.departmentId,
      r.section || '',
      r.isAnonymous ? 'Yes' : 'No',
      r.isAnonymous ? 'ANONYMOUS' : r.participantInfo.employeeId,
      r.isAnonymous ? 'ANONYMOUS' : r.participantInfo.fullName,
      r.participantInfo.jobTitle,
      r.participantInfo.shift,
      r.participantInfo.mesExperience,
      r.participantInfo.frequentSystems.join('; '),
      r.selectedForms
        .map(
          (f) =>
            `${f.formName} (${f.frequency}, Imp:${f.importance}, Auth:${f.authorizedUsers || f.usedFeatures || '-'}, Improve:${f.improvements || '-'})`
        )
        .join(' | '),
      r.selectedReports.map((rep) => `${rep.reportName} (${rep.frequency}, RT:${rep.needRealtime ? 'Y' : 'N'})`).join(' | '),
      r.workflowEvaluations.map((w) => `${w.processName} (${w.processingMinutes}m)`).join(' | '),
      avgUx,
      r.proposals.topImprovement,
      r.proposals.biggestChallenge,
      r.proposals.priority,
      r.submittedAt || r.updatedAt,
    ]);
  }

  rows.push([]);
  rows.push(['--- AUTOMATED PRIORITY MATRIX (SCORE = IMPACT * FREQUENCY * DEMAND / 125 * 100) ---']);
  rows.push(['Tier', 'Score (0-100)', 'Type', 'Item Name', 'Business Impact', 'Usage Frequency', 'User Demand', 'Departments', 'Sample Count', 'Rationale']);
  for (const pm of priorityMatrix) {
    rows.push([
      pm.tier,
      String(pm.normalizedScore),
      pm.recommendationType,
      pm.itemName,
      String(pm.businessImpact),
      String(pm.usageFrequency),
      String(pm.userDemand),
      pm.departments.join('; '),
      String(pm.sampleCount),
      pm.rationale,
    ]);
  }

  const csvBody = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvBody], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `smart_mes_survey_export_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportBusinessRequirementsJson(
  priorityMatrix: PriorityMatrixItem[],
  responsesCount: number,
  responseRatePct: number
) {
  const payload = {
    documentTitle: 'Next-Generation MES & Smart Factory Business Requirements Specification (BRD)',
    generatedAt: new Date().toISOString(),
    sampleStatistics: {
      totalSubmittedResponses: responsesCount,
      responseRatePercentage: responseRatePct,
    },
    scoringFormula: 'Normalized Priority Score = ((Business Impact * Usage Frequency * User Demand) / 125) * 100',
    tierDefinitions: {
      P1: 'Critical (>= 75)',
      P2: 'High (55 - 74)',
      P3: 'Medium (35 - 54)',
      P4: 'Low (< 35)',
    },
    prioritizedRequirements: priorityMatrix,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
  triggerDownload(blob, `mes_brd_requirements_${new Date().toISOString().slice(0, 10)}.json`);
}

export function triggerPrintPdfReport() {
  window.print();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
