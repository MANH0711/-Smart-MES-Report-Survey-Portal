import { useState } from 'react';
import { Copy, Plus, QrCode, RefreshCw, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import {
  AdminUserAccount,
  AuditLog,
  Campaign,
  LanguageCode,
  RbacRoleCode,
} from '../../types/survey';
import { DepartmentManagerPanel } from './AdminCatalogManagers';
import { ArchitectureDocs } from '../docs/ArchitectureDocs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DataTable, DataTableColumn } from '../ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { QrCodeSvg } from '../ui/qr-code';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export function AdminPortal({
  defaultTab = 'campaigns',
}: {
  defaultTab?: 'campaigns' | 'departments' | 'users' | 'config' | 'audit' | 'architecture';
}) {
  const {
    t,
    adminUser,
    hasPermission,
    campaigns,
    departments,
    adminUsers,
    roleMatrix,
    systemConfig,
    auditLogs,
    upsertCampaign,
    updateSystemConfig,
    createAdminUserAccount,
    updateAdminUserAccount,
    refreshLiveData,
  } = useApp();

  // Campaign Modal state
  const [openCampaignDialog, setOpenCampaignDialog] = useState(false);
  const [newCampTitle, setNewCampTitle] = useState('');
  const [newCampSlug, setNewCampSlug] = useState('');
  const [newCampDesc, setNewCampDesc] = useState('');
  const [newCampStart, setNewCampStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [newCampEnd, setNewCampEnd] = useState('2027-12-31');
  const [newCampTarget, setNewCampTarget] = useState(100);
  const [newCampAnon, setNewCampAnon] = useState(true);
  const [newCampReqEmp, setNewCampReqEmp] = useState(false);
  const [newCampReqName, setNewCampReqName] = useState(false);
  const [newCampMulti, setNewCampMulti] = useState(true);
  const [newCampEditable, setNewCampEditable] = useState(true);

  const [qrCampaign, setQrCampaign] = useState<Campaign | null>(null);

  // Create Admin User Modal state
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [uUsername, setUUsername] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uFullName, setUFullName] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uRole, setURole] = useState<Exclude<RbacRoleCode, 'PUBLIC'>>('ANALYST');
  const [uDeptScope, setUDeptScope] = useState<string>('all');

  const canWriteCampaigns = hasPermission('campaigns:write');
  const canEditCatalogs = hasPermission('catalogs:write');
  const canReadUsers = hasPermission('users:read');
  const canWriteUsers = hasPermission('users:write');
  const canWriteSettings = hasPermission('settings:write');
  const canReadAudit = hasPermission('audit:read');

  const handleCreateCampaign = async () => {
    if (!canWriteCampaigns) return toast.error(t('adminRequiredNotice'));
    if (!newCampTitle.trim()) return toast.error(t('requiredFieldsToast'));
    const now = new Date().toISOString();
    const id = `camp_${Date.now()}`;
    const camp: Campaign = {
      id,
      title: newCampTitle.trim(),
      slug: newCampSlug.trim() || undefined,
      description: newCampDesc.trim() || t('appFullTitle'),
      status: 'active',
      allowAnonymous: newCampAnon,
      requireAuth: false,
      requireEmployeeCode: newCampReqEmp,
      requireParticipantName: newCampReqName,
      allowMultipleSubmissions: newCampMulti,
      allowEditAfterSubmit: newCampEditable,
      startDate: newCampStart,
      endDate: newCampEnd,
      targetParticipants: newCampTarget,
      createdBy: adminUser?.username || 'admin',
      createdAt: now,
      updatedAt: now,
    };
    await upsertCampaign(camp);
    setNewCampTitle('');
    setNewCampSlug('');
    setNewCampDesc('');
    setOpenCampaignDialog(false);
    toast.success(t('createCampaign'));
  };

  const handleCloneCampaign = async (src: Campaign) => {
    if (!canWriteCampaigns) return toast.error(t('adminRequiredNotice'));
    const now = new Date().toISOString();
    await upsertCampaign({
      ...src,
      id: `camp_clone_${Date.now()}`,
      slug: `${src.slug || src.id}-copy-${String(Date.now()).slice(-4)}`,
      title: `${src.title} (Copy)`,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
    toast.success(t('clone'));
  };

  const handleCreateUser = async () => {
    if (!canWriteUsers) return toast.error(t('adminRequiredNotice'));
    if (!uUsername.trim() || !uEmail.trim() || !uFullName.trim() || uPassword.length < 8) {
      return toast.error(t('requiredFieldsToast'));
    }
    try {
      await createAdminUserAccount({
        username: uUsername.trim(),
        email: uEmail.trim(),
        fullName: uFullName.trim(),
        password: uPassword,
        roleCode: uRole,
        departmentScope: uDeptScope === 'all' ? undefined : uDeptScope,
      });
      setUUsername('');
      setUEmail('');
      setUFullName('');
      setUPassword('');
      setUDeptScope('all');
      setOpenUserDialog(false);
      toast.success(t('createAdminUser'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const copyShareUrl = async (slug: string) => {
    const url = `${window.location.origin}/survey/${slug}`;
    await navigator.clipboard.writeText(url);
    toast.success(t('copiedToClipboard'));
  };

  const campaignColumns: DataTableColumn<Campaign>[] = [
    {
      id: 'title',
      header: t('colName'),
      accessor: (c) => `${c.title} ${c.slug || ''}`,
      cell: (c) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">{c.title}</div>
          <div className="font-mono-num text-[11px] text-slate-500">/survey/{c.slug || c.id}</div>
        </div>
      ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      accessor: (c) => c.status,
      cell: (c) => (
        <Select
          value={c.status}
          disabled={!canWriteCampaigns}
          onValueChange={(v) =>
            upsertCampaign({
              ...c,
              status: v as Campaign['status'],
              updatedAt: new Date().toISOString(),
            })
          }
        >
          <SelectTrigger className="h-7 w-[115px] text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">{t('statusDraft')}</SelectItem>
            <SelectItem value="active">{t('statusActive')}</SelectItem>
            <SelectItem value="closed">{t('statusClosed')}</SelectItem>
            <SelectItem value="archived">{t('statusArchived')}</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      id: 'window',
      header: t('campaignDeadline'),
      accessor: (c) => `${c.startDate || ''} ${c.endDate || ''}`,
      cell: (c) => (
        <span className="font-mono-num text-[11px] text-slate-500 whitespace-nowrap">
          {c.startDate || '—'} → {c.endDate || '—'}
        </span>
      ),
    },
    {
      id: 'policies',
      header: t('anonymousMode'),
      accessor: (c) => (c.allowAnonymous ? 'anon' : 'id'),
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={c.allowAnonymous ? 'success' : 'default'}>
            {c.allowAnonymous ? t('policyAnonymousAllowed') : t('policyIdentifiedRequired')}
          </Badge>
          {c.allowEditAfterSubmit && <Badge variant="primary">{t('policyEditableAfterSubmit')}</Badge>}
        </div>
      ),
    },
    {
      id: 'target',
      header: t('colTarget'),
      accessor: (c) => c.targetParticipants,
      align: 'right',
    },
    {
      id: 'actions',
      header: t('colActions'),
      sortable: false,
      align: 'right',
      accessor: (c) => c.id,
      cell: (c) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" onClick={() => setQrCampaign(c)} title="QR Code">
            <QrCode className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canWriteCampaigns}
            onClick={() => handleCloneCampaign(c)}
          >
            <Copy className="h-3.5 w-3.5" />
            <span>{t('clone')}</span>
          </Button>
        </div>
      ),
    },
  ];

  const userColumns: DataTableColumn<AdminUserAccount>[] = [
    {
      id: 'username',
      header: t('usernameOrEmail'),
      accessor: (u) => `${u.username} ${u.email} ${u.fullName}`,
      cell: (u) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">{u.fullName}</div>
          <div className="font-mono-num text-[11px] text-slate-500">
            @{u.username} · {u.email}
          </div>
        </div>
      ),
    },
    {
      id: 'roleCode',
      header: t('role'),
      accessor: (u) => u.roleCode,
      cell: (u) => (
        <Select
          value={u.roleCode}
          disabled={!canWriteUsers || u.id === adminUser?.id}
          onValueChange={(v) =>
            updateAdminUserAccount(u.id, { roleCode: v as Exclude<RbacRoleCode, 'PUBLIC'> })
          }
        >
          <SelectTrigger className="h-7 w-[145px] text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SUPER_ADMIN">{t('roleSuperAdmin')}</SelectItem>
            <SelectItem value="ADMIN">{t('roleAdmin')}</SelectItem>
            <SelectItem value="ANALYST">{t('roleAnalyst')}</SelectItem>
            <SelectItem value="RESPONDENT">{t('roleRespondent')}</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      id: 'scope',
      header: t('departmentScope'),
      accessor: (u) => u.departmentScope || t('allScopes'),
      cell: (u) => <Badge variant="default">{u.departmentScope || t('allScopes')}</Badge>,
    },
    {
      id: 'status',
      header: t('colStatus'),
      accessor: (u) => u.status,
      cell: (u) => (
        <Badge variant={u.status === 'active' ? 'success' : 'danger'}>
          {u.status === 'active' ? t('statusActive') : t('statusSuspended')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: t('colActions'),
      sortable: false,
      align: 'right',
      accessor: (u) => u.id,
      cell: (u) => (
        <Button
          variant="outline"
          size="sm"
          disabled={!canWriteUsers || u.id === adminUser?.id}
          onClick={() =>
            updateAdminUserAccount(u.id, {
              status: u.status === 'active' ? 'suspended' : 'active',
            })
          }
        >
          {u.status === 'active' ? t('suspendUser') : t('activateUser')}
        </Button>
      ),
    },
  ];

  const auditColumns: DataTableColumn<AuditLog>[] = [
    {
      id: 'time',
      header: t('colSubmittedAt'),
      accessor: (l) => l.createdAt,
      cell: (l) => <span className="font-mono-num text-slate-500">{l.createdAt.slice(0, 19).replace('T', ' ')}</span>,
    },
    {
      id: 'actor',
      header: t('account'),
      accessor: (l) => l.actorEmail,
      cell: (l) => <span className="font-mono-num">{l.actorEmail}</span>,
    },
    {
      id: 'action',
      header: t('colActions'),
      accessor: (l) => l.action,
      cell: (l) => <Badge variant="primary">{l.action}</Badge>,
    },
    {
      id: 'target',
      header: t('colType'),
      accessor: (l) => `${l.targetType}:${l.targetId}`,
      cell: (l) => <span className="font-mono-num">{l.targetType}:{l.targetId}</span>,
    },
    {
      id: 'details',
      header: t('colRationale'),
      accessor: (l) => l.details,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Compact Admin Identity Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-[12px] text-slate-600 dark:text-slate-300">
          <ShieldCheck className="h-4 w-4 text-[#0B2B5B] dark:text-cyan-400 shrink-0" />
          <span>
            {adminUser?.fullName} (@{adminUser?.username}) · <Badge variant="primary">{adminUser?.roleCode}</Badge>
          </span>
        </div>

        <Button variant="outline" size="sm" onClick={refreshLiveData}>
          <RefreshCw className="h-3.5 w-3.5" />
          <span>{t('refreshData')}</span>
        </Button>
      </div>

      {/* Horizontal Admin Tabs */}
      <Tabs key={defaultTab} defaultValue={defaultTab} className="space-y-3">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="campaigns">{t('adminCampaigns')}</TabsTrigger>
          <TabsTrigger value="departments">{t('adminDepartments')}</TabsTrigger>
          {canReadUsers && <TabsTrigger value="users">{t('navUsersRbac')}</TabsTrigger>}
          <TabsTrigger value="config">{t('adminConfig')}</TabsTrigger>
          {canReadAudit && <TabsTrigger value="audit">{t('adminAudit')}</TabsTrigger>}
          <TabsTrigger value="architecture">{t('adminArchitecture')}</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <DataTable
              data={campaigns}
              columns={campaignColumns}
              getRowId={(c) => c.id}
              selectable={false}
              searchPlaceholder={t('tableSearch')}
              emptyText={t('tableNoResults')}
              labels={{
                columns: t('tableColumns'),
                rowsPerPage: t('tableRowsPerPage'),
                page: t('tablePage'),
                of: t('tableOf'),
              }}
              toolbarExtra={
                canWriteCampaigns ? (
                  <Dialog open={openCampaignDialog} onOpenChange={setOpenCampaignDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-3.5 w-3.5" />
                        <span>{t('createCampaign')}</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{t('createCampaign')}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-2.5">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium">{t('colName')} *</label>
                          <Input
                            placeholder={t('colName')}
                            value={newCampTitle}
                            onChange={(e) => setNewCampTitle(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-1 block text-[11px] font-medium">{t('campaignSlug')}</label>
                            <Input
                              placeholder="mes-dx-2027"
                              value={newCampSlug}
                              onChange={(e) => setNewCampSlug(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-medium">{t('colTarget')}</label>
                            <Input
                              type="number"
                              min={5}
                              value={newCampTarget}
                              onChange={(e) => setNewCampTarget(Number(e.target.value) || 50)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-1 block text-[11px] font-medium">{t('startDate')}</label>
                            <Input
                              type="date"
                              value={newCampStart}
                              onChange={(e) => setNewCampStart(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-medium">{t('endDate')}</label>
                            <Input
                              type="date"
                              value={newCampEnd}
                              onChange={(e) => setNewCampEnd(e.target.value)}
                            />
                          </div>
                        </div>
                        <Input
                          placeholder={t('appFullTitle')}
                          value={newCampDesc}
                          onChange={(e) => setNewCampDesc(e.target.value)}
                        />
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          <label className="flex items-center justify-between rounded border border-slate-200 px-2.5 py-2 text-[11.5px] cursor-pointer dark:border-slate-800">
                            <span>{t('policyAnonymousAllowed')}</span>
                            <Switch checked={newCampAnon} onCheckedChange={setNewCampAnon} />
                          </label>
                          <label className="flex items-center justify-between rounded border border-slate-200 px-2.5 py-2 text-[11.5px] cursor-pointer dark:border-slate-800">
                            <span>{t('policyEmployeeCodeRequired')}</span>
                            <Switch checked={newCampReqEmp} onCheckedChange={setNewCampReqEmp} />
                          </label>
                          <label className="flex items-center justify-between rounded border border-slate-200 px-2.5 py-2 text-[11.5px] cursor-pointer dark:border-slate-800">
                            <span>{t('policyNameRequired')}</span>
                            <Switch checked={newCampReqName} onCheckedChange={setNewCampReqName} />
                          </label>
                          <label className="flex items-center justify-between rounded border border-slate-200 px-2.5 py-2 text-[11.5px] cursor-pointer dark:border-slate-800">
                            <span>{t('policyMultiSubmission')}</span>
                            <Switch checked={newCampMulti} onCheckedChange={setNewCampMulti} />
                          </label>
                          <label className="sm:col-span-2 flex items-center justify-between rounded border border-slate-200 px-2.5 py-2 text-[11.5px] cursor-pointer dark:border-slate-800">
                            <span>{t('policyEditableAfterSubmit')}</span>
                            <Switch checked={newCampEditable} onCheckedChange={setNewCampEditable} />
                          </label>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <Button variant="outline" size="sm" onClick={() => setOpenCampaignDialog(false)}>
                            {t('cancel')}
                          </Button>
                          <Button size="sm" onClick={handleCreateCampaign}>
                            {t('createCampaign')}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : undefined
              }
            />
          </div>

          <Dialog open={Boolean(qrCampaign)} onOpenChange={(o) => !o && setQrCampaign(null)}>
            <DialogContent className="max-w-xs text-center">
              <DialogHeader>
                <DialogTitle>{t('qrShareTitle')}</DialogTitle>
              </DialogHeader>
              {qrCampaign && (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="text-[12px] font-medium text-slate-700 dark:text-slate-300">
                    {qrCampaign.title}
                  </div>
                  <QrCodeSvg
                    value={`${window.location.origin}/survey/${qrCampaign.slug || qrCampaign.id}`}
                    size={180}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => copyShareUrl(qrCampaign.slug || qrCampaign.id)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t('copySurveyLink')}</span>
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="departments">
          <DepartmentManagerPanel canEdit={canEditCatalogs} />
        </TabsContent>

        {canReadUsers && (
          <TabsContent value="users" className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <DataTable
                data={adminUsers}
                columns={userColumns}
                getRowId={(u) => u.id}
                selectable={false}
                searchPlaceholder={t('tableSearch')}
                emptyText={t('adminRequiredNotice')}
                labels={{
                  columns: t('tableColumns'),
                  rowsPerPage: t('tableRowsPerPage'),
                  page: t('tablePage'),
                  of: t('tableOf'),
                }}
                toolbarExtra={
                  canWriteUsers ? (
                    <Dialog open={openUserDialog} onOpenChange={setOpenUserDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>{t('createAdminUser')}</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>{t('createAdminUser')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2.5">
                          <Input
                            placeholder="username"
                            value={uUsername}
                            onChange={(e) => setUUsername(e.target.value)}
                          />
                          <Input
                            type="email"
                            placeholder="email@smartmes.local"
                            value={uEmail}
                            onChange={(e) => setUEmail(e.target.value)}
                          />
                          <Input
                            placeholder={t('fullName')}
                            value={uFullName}
                            onChange={(e) => setUFullName(e.target.value)}
                          />
                          <Input
                            type="password"
                            placeholder={t('newPassword')}
                            value={uPassword}
                            onChange={(e) => setUPassword(e.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={uRole}
                              onValueChange={(v) => setURole(v as Exclude<RbacRoleCode, 'PUBLIC'>)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SUPER_ADMIN">{t('roleSuperAdmin')}</SelectItem>
                                <SelectItem value="ADMIN">{t('roleAdmin')}</SelectItem>
                                <SelectItem value="ANALYST">{t('roleAnalyst')}</SelectItem>
                                <SelectItem value="RESPONDENT">{t('roleRespondent')}</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select value={uDeptScope} onValueChange={setUDeptScope}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">{t('allScopes')}</SelectItem>
                                {departments.map((d) => (
                                  <SelectItem key={d.id} value={d.id}>
                                    {d.code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <Button variant="outline" size="sm" onClick={() => setOpenUserDialog(false)}>
                              {t('cancel')}
                            </Button>
                            <Button size="sm" onClick={handleCreateUser}>
                              {t('createAdminUser')}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : undefined
                }
              />
            </div>

            {/* RBAC Permission Matrix Card */}
            {roleMatrix.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2 dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-[13px] font-semibold">{t('permissionMatrixTitle')}</h3>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  {roleMatrix
                    .filter((r) => r.roleCode !== 'RESPONDENT')
                    .map((r) => (
                      <div
                        key={r.roleCode}
                        className="rounded border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950"
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-semibold text-[12px]">{r.roleCode}</span>
                          <Badge variant="primary">{r.permissions.length}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {r.permissions.map((p) => (
                            <span
                              key={p}
                              className="rounded bg-white px-1.5 py-0.5 font-mono-num text-[10px] text-slate-600 border border-slate-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="config">
          <div className="rounded-md border border-slate-200 bg-white p-3 space-y-3 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-[14px] font-semibold">{t('adminConfig')}</h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-[12px] font-medium dark:border-slate-800">
                <span>{t('configAnonDefault')}</span>
                <Switch
                  checked={systemConfig.anonymousSurveyDefault}
                  disabled={!canWriteSettings}
                  onCheckedChange={(v) =>
                    updateSystemConfig({
                      ...systemConfig,
                      anonymousSurveyDefault: v,
                      updatedBy: adminUser?.username || 'admin',
                      updatedAt: new Date().toISOString(),
                    })
                  }
                />
              </label>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-600 dark:text-slate-300">
                  {t('configDefaultLang')}
                </label>
                <Select
                  value={systemConfig.defaultLanguage}
                  disabled={!canWriteSettings}
                  onValueChange={(v) =>
                    updateSystemConfig({
                      ...systemConfig,
                      defaultLanguage: v as LanguageCode,
                      updatedBy: adminUser?.username || 'admin',
                      updatedAt: new Date().toISOString(),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vi">Tiếng Việt (VI)</SelectItem>
                    <SelectItem value="en">English (EN)</SelectItem>
                    <SelectItem value="ko">한국어 (KO)</SelectItem>
                    <SelectItem value="zh">中文 (ZH)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-600 dark:text-slate-300">
                  {t('configMinSample')}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  disabled={!canWriteSettings}
                  value={systemConfig.minSampleThreshold}
                  onChange={(e) =>
                    updateSystemConfig({
                      ...systemConfig,
                      minSampleThreshold: Math.max(1, Number(e.target.value) || 5),
                      updatedBy: adminUser?.username || 'admin',
                      updatedAt: new Date().toISOString(),
                    })
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-600 dark:text-slate-300">
                  {t('configTokenTtlDays')}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  disabled={!canWriteSettings}
                  value={systemConfig.tokenTtlDays ?? 90}
                  onChange={(e) =>
                    updateSystemConfig({
                      ...systemConfig,
                      tokenTtlDays: Math.max(1, Number(e.target.value) || 90),
                      updatedBy: adminUser?.username || 'admin',
                      updatedAt: new Date().toISOString(),
                    })
                  }
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {canReadAudit && (
          <TabsContent value="audit">
            <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <DataTable
                data={auditLogs}
                columns={auditColumns}
                getRowId={(l) => l.id}
                selectable={false}
                searchPlaceholder={t('tableSearch')}
                emptyText={t('tableNoResults')}
                labels={{
                  columns: t('tableColumns'),
                  rowsPerPage: t('tableRowsPerPage'),
                  page: t('tablePage'),
                  of: t('tableOf'),
                }}
              />
            </div>
          </TabsContent>
        )}

        <TabsContent value="architecture">
          <ArchitectureDocs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
