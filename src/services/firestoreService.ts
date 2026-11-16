import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  AuditLog,
  Campaign,
  CatalogForm,
  CatalogReport,
  Department,
  SurveyQuestion,
  SurveyResponse,
  SystemConfig,
  UserProfile,
  UserRole,
} from '../types/survey';
import {
  DEFAULT_CATALOG_FORMS,
  DEFAULT_CATALOG_REPORTS,
  DEFAULT_DEPARTMENTS,
} from '../data/catalogs';
import {
  DEFAULT_CAMPAIGNS,
  DEFAULT_QUESTIONS,
  DEFAULT_SYSTEM_CONFIG,
  DEMO_AUDIT_LOGS,
  DEMO_RESPONSES,
} from '../data/demoData';

const BOOTSTRAP_ADMIN_EMAIL = 'ruanyoujin84@gmail.com';

export async function syncUserProfile(
  uid: string,
  email: string,
  displayName: string
): Promise<UserProfile> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  const now = new Date().toISOString();

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const existing = snap.data() as UserProfile;
      const updated: UserProfile = {
        ...existing,
        email,
        displayName: displayName || existing.displayName || email.split('@')[0],
        updatedAt: now,
      };
      await setDoc(ref, updated, { merge: true });
      return updated;
    }

    const isBootstrapAdmin = email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
    const profile: UserProfile = {
      uid,
      email,
      displayName: displayName || email.split('@')[0],
      employeeId: '',
      departmentId: 'dept_prod',
      section: '',
      jobTitle: isBootstrapAdmin ? 'System Administrator' : 'Factory Staff',
      role: isBootstrapAdmin ? 'admin' : 'respondent',
      preferredLang: 'vi',
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(ref, profile);

    if (isBootstrapAdmin) {
      await setDoc(doc(db, 'admins', uid), {
        uid,
        email,
        grantedBy: 'bootstrap',
        grantedAt: now,
      });
    }

    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchAllDepartments(): Promise<Department[]> {
  try {
    const snap = await getDocs(collection(db, 'departments'));
    return snap.docs.map((d) => d.data() as Department);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'departments');
  }
}

export async function saveDepartment(dept: Department): Promise<void> {
  try {
    await setDoc(doc(db, 'departments', dept.id), dept);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `departments/${dept.id}`);
  }
}

export async function fetchCatalogForms(): Promise<CatalogForm[]> {
  try {
    const snap = await getDocs(collection(db, 'catalogForms'));
    return snap.docs.map((d) => d.data() as CatalogForm);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'catalogForms');
  }
}

export async function saveCatalogForm(form: CatalogForm): Promise<void> {
  try {
    await setDoc(doc(db, 'catalogForms', form.id), form);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `catalogForms/${form.id}`);
  }
}

export async function fetchCatalogReports(): Promise<CatalogReport[]> {
  try {
    const snap = await getDocs(collection(db, 'catalogReports'));
    return snap.docs.map((d) => d.data() as CatalogReport);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'catalogReports');
  }
}

export async function saveCatalogReport(report: CatalogReport): Promise<void> {
  try {
    await setDoc(doc(db, 'catalogReports', report.id), report);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `catalogReports/${report.id}`);
  }
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  try {
    const snap = await getDocs(collection(db, 'campaigns'));
    return snap.docs.map((d) => d.data() as Campaign);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'campaigns');
  }
}

export async function saveCampaign(campaign: Campaign): Promise<void> {
  try {
    await setDoc(doc(db, 'campaigns', campaign.id), campaign);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `campaigns/${campaign.id}`);
  }
}

export async function fetchCampaignQuestions(campaignId: string): Promise<SurveyQuestion[]> {
  const path = `campaigns/${campaignId}/questions`;
  try {
    const q = query(collection(db, path), orderBy('orderIndex', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as SurveyQuestion);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveCampaignQuestion(campaignId: string, question: SurveyQuestion): Promise<void> {
  const path = `campaigns/${campaignId}/questions/${question.id}`;
  try {
    await setDoc(doc(db, 'campaigns', campaignId, 'questions', question.id), question);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCampaignQuestion(campaignId: string, questionId: string): Promise<void> {
  const path = `campaigns/${campaignId}/questions/${questionId}`;
  try {
    await deleteDoc(doc(db, 'campaigns', campaignId, 'questions', questionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchResponses(role: UserRole, uid: string): Promise<SurveyResponse[]> {
  try {
    if (role === 'admin' || role === 'analyst') {
      const snap = await getDocs(collection(db, 'responses'));
      return snap.docs.map((d) => d.data() as SurveyResponse);
    }
    const q = query(collection(db, 'responses'), where('respondentUid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as SurveyResponse);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'responses');
  }
}

export async function saveSurveyResponse(response: SurveyResponse): Promise<void> {
  try {
    await setDoc(doc(db, 'responses', response.id), response);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `responses/${response.id}`);
  }
}

export async function deleteSurveyResponse(responseId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'responses', responseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `responses/${responseId}`);
  }
}

export async function fetchUsers(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }
}

export async function updateUserRole(user: UserProfile, newRole: UserRole, actorEmail: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    await setDoc(doc(db, 'users', user.uid), { ...user, role: newRole, updatedAt: now });
    if (newRole === 'admin') {
      await setDoc(doc(db, 'admins', user.uid), {
        uid: user.uid,
        email: user.email,
        grantedBy: actorEmail,
        grantedAt: now,
      });
    } else {
      await deleteDoc(doc(db, 'admins', user.uid));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
  }
}

export async function fetchSystemConfig(): Promise<SystemConfig | null> {
  try {
    const snap = await getDoc(doc(db, 'systemConfig', 'default'));
    return snap.exists() ? (snap.data() as SystemConfig) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'systemConfig/default');
  }
}

export async function saveSystemConfig(config: SystemConfig): Promise<void> {
  try {
    await setDoc(doc(db, 'systemConfig', config.id), config);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `systemConfig/${config.id}`);
  }
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  try {
    const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AuditLog);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'auditLogs');
  }
}

export async function appendAuditLog(log: AuditLog): Promise<void> {
  try {
    await setDoc(doc(db, 'auditLogs', log.id), log);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `auditLogs/${log.id}`);
  }
}

export async function seedEnterpriseDemoDatabase(actorUid: string, actorEmail: string): Promise<void> {
  try {
    const batch = writeBatch(db);

    for (const dept of DEFAULT_DEPARTMENTS) {
      batch.set(doc(db, 'departments', dept.id), dept);
    }
    for (const frm of DEFAULT_CATALOG_FORMS) {
      batch.set(doc(db, 'catalogForms', frm.id), frm);
    }
    for (const rpt of DEFAULT_CATALOG_REPORTS) {
      batch.set(doc(db, 'catalogReports', rpt.id), rpt);
    }
    for (const camp of DEFAULT_CAMPAIGNS) {
      batch.set(doc(db, 'campaigns', camp.id), camp);
    }
    for (const q of DEFAULT_QUESTIONS) {
      batch.set(doc(db, 'campaigns', 'camp_mes_dx_2026', 'questions', q.id), q);
    }
    batch.set(doc(db, 'systemConfig', 'default'), {
      ...DEFAULT_SYSTEM_CONFIG,
      updatedBy: actorEmail,
      updatedAt: new Date().toISOString(),
    });
    for (const resp of DEMO_RESPONSES) {
      batch.set(doc(db, 'responses', resp.id), resp);
    }
    for (const log of DEMO_AUDIT_LOGS) {
      batch.set(doc(db, 'auditLogs', log.id), {
        ...log,
        actorUid,
        actorEmail,
      });
    }

    const seedLogId = `log_seed_${Date.now()}`;
    batch.set(doc(db, 'auditLogs', seedLogId), {
      id: seedLogId,
      actorUid,
      actorEmail,
      action: 'ENTERPRISE_SEED_EXECUTED',
      targetType: 'database',
      targetId: 'all',
      details: `Seeded ${DEFAULT_DEPARTMENTS.length} departments, ${DEFAULT_CATALOG_FORMS.length} MES forms, ${DEFAULT_CATALOG_REPORTS.length} reports, and ${DEMO_RESPONSES.length} sample responses.`,
      createdAt: new Date().toISOString(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch_seed');
  }
}
