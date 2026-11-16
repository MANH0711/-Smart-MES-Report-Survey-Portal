import { CatalogForm, CatalogReport, Department, FormGroupId, LanguageCode, ReportCategoryId } from '../types/survey';

const nowIso = '2026-11-15T09:00:00.000Z';

export const DEFAULT_DEPARTMENTS: Department[] = [
  { id: 'dept_prod', code: 'PROD', nameVi: 'Sản xuất (Production)', nameEn: 'Production', nameKo: '생산팀', nameZh: '生产部', sections: ['Assembly Line 1-4', 'Final Pack', 'Sub-Assembly'], targetHeadcount: 45, active: true, updatedAt: nowIso },
  { id: 'dept_pe', code: 'PE', nameVi: 'Kỹ thuật quy trình (PE)', nameEn: 'Process Engineering (PE)', nameKo: '공정기술 (PE)', nameZh: '工艺工程 (PE)', sections: ['NPI', 'Process Control', 'Fixture'], targetHeadcount: 18, active: true, updatedAt: nowIso },
  { id: 'dept_ie', code: 'IE', nameVi: 'Kỹ thuật công nghiệp (IE)', nameEn: 'Industrial Engineering (IE)', nameKo: '산업공학 (IE)', nameZh: '工业工程 (IE)', sections: ['Time Study', 'Line Balance', 'Lean DX'], targetHeadcount: 12, active: true, updatedAt: nowIso },
  { id: 'dept_qaqc', code: 'QAQC', nameVi: 'Quản lý chất lượng (QA/QC)', nameEn: 'Quality Assurance / QC', nameKo: '품질보증 (QA/QC)', nameZh: '品质管理 (QA/QC)', sections: ['PQC', 'QA Audit', 'Reliability Lab'], targetHeadcount: 24, active: true, updatedAt: nowIso },
  { id: 'dept_pmc', code: 'PMC', nameVi: 'Kế hoạch sản xuất (PMC)', nameEn: 'Production Material Control (PMC)', nameKo: '생산계획 (PMC)', nameZh: '生管物控 (PMC)', sections: ['Master Scheduling', 'Material Planning'], targetHeadcount: 14, active: true, updatedAt: nowIso },
  { id: 'dept_wh', code: 'WH', nameVi: 'Kho vận (Warehouse)', nameEn: 'Warehouse & Logistics', nameKo: '자재창고', nameZh: '仓储物流', sections: ['Raw Material WH', 'Finished Goods WH', 'Kitting'], targetHeadcount: 20, active: true, updatedAt: nowIso },
  { id: 'dept_smt', code: 'SMT', nameVi: 'Sản xuất SMT', nameEn: 'SMT Manufacturing', nameKo: 'SMT 생산', nameZh: 'SMT 制造', sections: ['SMT Line A', 'SMT Line B', 'AOI / SPI'], targetHeadcount: 30, active: true, updatedAt: nowIso },
  { id: 'dept_eq', code: 'EQ', nameVi: 'Quản lý thiết bị (Equipment)', nameEn: 'Equipment Management', nameKo: '설비관리', nameZh: '设备管理', sections: ['Calibration', 'Automation', 'Tooling'], targetHeadcount: 15, active: true, updatedAt: nowIso },
  { id: 'dept_maint', code: 'MAINT', nameVi: 'Bảo trì (Maintenance)', nameEn: 'Maintenance', nameKo: '설비보전', nameZh: '设备维修', sections: ['Preventive Maint', 'Emergency Repair'], targetHeadcount: 16, active: true, updatedAt: nowIso },
  { id: 'dept_oqciqc', code: 'OQCIQC', nameVi: 'Kiểm tra chất lượng (OQC/IQC)', nameEn: 'Incoming & Outgoing QC (OQC/IQC)', nameKo: '수입/출하검사', nameZh: '进料/出货检验', sections: ['IQC', 'OQC'], targetHeadcount: 22, active: true, updatedAt: nowIso },
  { id: 'dept_it', code: 'IT', nameVi: 'Công nghệ thông tin (IT)', nameEn: 'Information Technology (IT)', nameKo: '정보기술 (IT)', nameZh: '信息技术 (IT)', sections: ['MES Ops', 'Infra & Network', 'ERP/BI'], targetHeadcount: 10, active: true, updatedAt: nowIso },
  { id: 'dept_mgmt', code: 'MGMT', nameVi: 'Quản lý nhà máy (Management)', nameEn: 'Plant Management', nameKo: '공장경영진', nameZh: '工厂管理层', sections: ['Plant Director', 'Operations'], targetHeadcount: 8, active: true, updatedAt: nowIso },
];

export const FORM_GROUPS: { id: FormGroupId; labels: Record<LanguageCode, string> }[] = [
  { id: 'production', labels: { vi: 'Nhóm 1: Quản lý sản xuất', en: 'Group 1: Production Management', ko: '그룹 1: 생산 관리', zh: '第1组：生产管理' } },
  { id: 'material', labels: { vi: 'Nhóm 2: Quản lý nguyên vật liệu', en: 'Group 2: Material Management', ko: '그룹 2: 자재 관리', zh: '第2组：物料管理' } },
  { id: 'equipment', labels: { vi: 'Nhóm 3: Quản lý thiết bị', en: 'Group 3: Equipment Management', ko: '그룹 3: 설비 관리', zh: '第3组：设备管理' } },
  { id: 'quality', labels: { vi: 'Nhóm 4: Quản lý chất lượng', en: 'Group 4: Quality Management', ko: '그룹 4: 품질 관리', zh: '第4组：质量管理' } },
  { id: 'traceability', labels: { vi: 'Nhóm 5: Truy xuất nguồn gốc', en: 'Group 5: Traceability', ko: '그룹 5: 추적성 관리', zh: '第5组：追溯管理' } },
  { id: 'system', labels: { vi: 'Nhóm 6: Quản trị hệ thống', en: 'Group 6: System Management', ko: '그룹 6: 시스템 관리', zh: '第6组：系统管理' } },
];

export const DEFAULT_CATALOG_FORMS: CatalogForm[] = [
  // Group 1: Production
  { id: 'frm_prod_order', groupId: 'production', code: 'MES-P01', nameEn: 'Production Order', nameVi: 'Lệnh sản xuất (Production Order)', nameKo: '생산 오더', nameZh: '生产订单', isCustom: false, active: true },
  { id: 'frm_work_order', groupId: 'production', code: 'MES-P02', nameEn: 'Work Order', nameVi: 'Lệnh công việc (Work Order)', nameKo: '작업 지시서', nameZh: '工单管理', isCustom: false, active: true },
  { id: 'frm_prod_tracking', groupId: 'production', code: 'MES-P03', nameEn: 'Production Tracking', nameVi: 'Theo dõi sản xuất (Production Tracking)', nameKo: '생산 추적', nameZh: '生产进度追踪', isCustom: false, active: true },
  { id: 'frm_wip_tracking', groupId: 'production', code: 'MES-P04', nameEn: 'WIP Tracking', nameVi: 'Theo dõi bán thành phẩm (WIP Tracking)', nameKo: '재공(WIP) 추적', nameZh: '在制品(WIP)追踪', isCustom: false, active: true },
  { id: 'frm_line_mon', groupId: 'production', code: 'MES-P05', nameEn: 'Line Monitoring', nameVi: 'Giám sát chuyền (Line Monitoring)', nameKo: '라인 모니터링', nameZh: '产线实时监控', isCustom: false, active: true },
  { id: 'frm_prod_input', groupId: 'production', code: 'MES-P06', nameEn: 'Production Input', nameVi: 'Nhập liệu đầu vào (Production Input)', nameKo: '생산 투입', nameZh: '生产投入录入', isCustom: false, active: true },
  { id: 'frm_prod_output', groupId: 'production', code: 'MES-P07', nameEn: 'Production Output', nameVi: 'Ghi nhận sản lượng (Production Output)', nameKo: '생산 실적', nameZh: '生产产出录入', isCustom: false, active: true },
  { id: 'frm_prod_history', groupId: 'production', code: 'MES-P08', nameEn: 'Production History', nameVi: 'Lịch sử sản xuất (Production History)', nameKo: '생산 이력', nameZh: '生产历史查询', isCustom: false, active: true },
  { id: 'frm_shift_report', groupId: 'production', code: 'MES-P09', nameEn: 'Shift Report', nameVi: 'Báo cáo giao ca (Shift Report)', nameKo: '교대 일지', nameZh: '交接班报告', isCustom: false, active: true },

  // Group 2: Material
  { id: 'frm_mat_issue', groupId: 'material', code: 'MES-M01', nameEn: 'Material Issue', nameVi: 'Xuất vật tư (Material Issue)', nameKo: '자재 불출', nameZh: '物料发料', isCustom: false, active: true },
  { id: 'frm_mat_return', groupId: 'material', code: 'MES-M02', nameEn: 'Material Return', nameVi: 'Trả vật tư (Material Return)', nameKo: '자재 반납', nameZh: '物料退料', isCustom: false, active: true },
  { id: 'frm_mat_receive', groupId: 'material', code: 'MES-M03', nameEn: 'Material Receive', nameVi: 'Nhận vật tư (Material Receive)', nameKo: '자재 입고', nameZh: '物料接收', isCustom: false, active: true },
  { id: 'frm_mat_tracking', groupId: 'material', code: 'MES-M04', nameEn: 'Material Tracking', nameVi: 'Theo dõi vật tư (Material Tracking)', nameKo: '자재 추적', nameZh: '物料追踪', isCustom: false, active: true },
  { id: 'frm_mat_consumption', groupId: 'material', code: 'MES-M05', nameEn: 'Material Consumption', nameVi: 'Tiêu hao vật tư (Material Consumption)', nameKo: '자재 소모', nameZh: '物料消耗', isCustom: false, active: true },
  { id: 'frm_mat_lot', groupId: 'material', code: 'MES-M06', nameEn: 'Material Lot Tracking', nameVi: 'Theo dõi Lot vật tư (Material Lot Tracking)', nameKo: '자재 Lot 추적', nameZh: '物料批次追踪', isCustom: false, active: true },
  { id: 'frm_bom_mgmt', groupId: 'material', code: 'MES-M07', nameEn: 'BOM Management', nameVi: 'Quản lý định mức BOM (BOM Management)', nameKo: 'BOM 관리', nameZh: 'BOM 物料清单管理', isCustom: false, active: true },
  { id: 'frm_mat_inventory', groupId: 'material', code: 'MES-M08', nameEn: 'Material Inventory', nameVi: 'Tồn kho vật tư (Material Inventory)', nameKo: '자재 재고', nameZh: '物料库存查询', isCustom: false, active: true },

  // Group 3: Equipment
  { id: 'frm_eq_status', groupId: 'equipment', code: 'MES-E01', nameEn: 'Equipment Status', nameVi: 'Trạng thái thiết bị (Equipment Status)', nameKo: '설비 상태', nameZh: '设备状态', isCustom: false, active: true },
  { id: 'frm_eq_monitoring', groupId: 'equipment', code: 'MES-E02', nameEn: 'Equipment Monitoring', nameVi: 'Giám sát thiết bị (Equipment Monitoring)', nameKo: '설비 모니터링', nameZh: '设备监控', isCustom: false, active: true },
  { id: 'frm_eq_alarm', groupId: 'equipment', code: 'MES-E03', nameEn: 'Equipment Alarm', nameVi: 'Cảnh báo thiết bị (Equipment Alarm)', nameKo: '설비 알람', nameZh: '设备报警', isCustom: false, active: true },
  { id: 'frm_eq_history', groupId: 'equipment', code: 'MES-E04', nameEn: 'Equipment History', nameVi: 'Lịch sử thiết bị (Equipment History)', nameKo: '설비 이력', nameZh: '设备历史', isCustom: false, active: true },
  { id: 'frm_eq_maint', groupId: 'equipment', code: 'MES-E05', nameEn: 'Equipment Maintenance', nameVi: 'Bảo trì thiết bị (Equipment Maintenance)', nameKo: '설비 보전', nameZh: '设备保养维护', isCustom: false, active: true },
  { id: 'frm_eq_downtime', groupId: 'equipment', code: 'MES-E06', nameEn: 'Equipment Downtime', nameVi: 'Thời gian dừng máy (Equipment Downtime)', nameKo: '설비 비가동', nameZh: '设备停机记录', isCustom: false, active: true },

  // Group 4: Quality
  { id: 'frm_defect_mgmt', groupId: 'quality', code: 'MES-Q01', nameEn: 'Defect Management', nameVi: 'Quản lý lỗi (Defect Management)', nameKo: '불량 관리', nameZh: '不良品管理', isCustom: false, active: true },
  { id: 'frm_ng_tracking', groupId: 'quality', code: 'MES-Q02', nameEn: 'NG Tracking', nameVi: 'Theo dõi hàng NG (NG Tracking)', nameKo: 'NG 추적', nameZh: 'NG 不良追踪', isCustom: false, active: true },
  { id: 'frm_inspection', groupId: 'quality', code: 'MES-Q03', nameEn: 'Inspection Result', nameVi: 'Kết quả kiểm tra (Inspection Result)', nameKo: '검사 결과', nameZh: '检验结果录入', isCustom: false, active: true },
  { id: 'frm_quality_history', groupId: 'quality', code: 'MES-Q04', nameEn: 'Quality History', nameVi: 'Lịch sử chất lượng (Quality History)', nameKo: '품질 이력', nameZh: '质量历史', isCustom: false, active: true },
  { id: 'frm_spc_mon', groupId: 'quality', code: 'MES-Q05', nameEn: 'SPC Monitoring', nameVi: 'Giám sát SPC (SPC Monitoring)', nameKo: 'SPC 모니터링', nameZh: 'SPC 统计过程控制', isCustom: false, active: true },
  { id: 'frm_rework', groupId: 'quality', code: 'MES-Q06', nameEn: 'Rework Management', nameVi: 'Quản lý sửa hàng (Rework Management)', nameKo: '재작업 관리', nameZh: '返工管理', isCustom: false, active: true },
  { id: 'frm_quality_analysis', groupId: 'quality', code: 'MES-Q07', nameEn: 'Quality Analysis', nameVi: 'Phân tích chất lượng (Quality Analysis)', nameKo: '품질 분석', nameZh: '质量分析', isCustom: false, active: true },

  // Group 5: Traceability
  { id: 'frm_trace_product', groupId: 'traceability', code: 'MES-T01', nameEn: 'Product Traceability', nameVi: 'Truy xuất sản phẩm (Product Traceability)', nameKo: '제품 추적성', nameZh: '产品追溯', isCustom: false, active: true },
  { id: 'frm_trace_lot', groupId: 'traceability', code: 'MES-T02', nameEn: 'Lot Traceability', nameVi: 'Truy xuất Lot (Lot Traceability)', nameKo: 'Lot 추적성', nameZh: '批次追溯', isCustom: false, active: true },
  { id: 'frm_trace_sn', groupId: 'traceability', code: 'MES-T03', nameEn: 'Serial Number Tracking', nameVi: 'Theo dõi Serial Number', nameKo: '시리얼 번호 추적', nameZh: '序列号追踪', isCustom: false, active: true },
  { id: 'frm_barcode', groupId: 'traceability', code: 'MES-T04', nameEn: 'Barcode Scanning', nameVi: 'Quét mã vạch (Barcode Scanning)', nameKo: '바코드 스캔', nameZh: '条码扫描', isCustom: false, active: true },
  { id: 'frm_process_hist', groupId: 'traceability', code: 'MES-T05', nameEn: 'Process History', nameVi: 'Lịch sử công đoạn (Process History)', nameKo: '공정 이력', nameZh: '工序历史', isCustom: false, active: true },
  { id: 'frm_component_trace', groupId: 'traceability', code: 'MES-T06', nameEn: 'Component Traceability', nameVi: 'Truy xuất linh kiện (Component Traceability)', nameKo: '부품 추적성', nameZh: '元器件追溯', isCustom: false, active: true },

  // Group 6: System
  { id: 'frm_sys_users', groupId: 'system', code: 'MES-S01', nameEn: 'User Management', nameVi: 'Quản lý người dùng (User Management)', nameKo: '사용자 관리', nameZh: '用户管理', isCustom: false, active: true },
  { id: 'frm_sys_roles', groupId: 'system', code: 'MES-S02', nameEn: 'Role Management', nameVi: 'Quản lý vai trò (Role Management)', nameKo: '역할 관리', nameZh: '角色管理', isCustom: false, active: true },
  { id: 'frm_sys_perm', groupId: 'system', code: 'MES-S03', nameEn: 'Permission Management', nameVi: 'Phân quyền hệ thống (Permission Management)', nameKo: '권한 관리', nameZh: '权限管理', isCustom: false, active: true },
  { id: 'frm_sys_master', groupId: 'system', code: 'MES-S04', nameEn: 'Master Data', nameVi: 'Dữ liệu gốc (Master Data)', nameKo: '기준 정보', nameZh: '基础数据管理', isCustom: false, active: true },
  { id: 'frm_sys_config', groupId: 'system', code: 'MES-S05', nameEn: 'Configuration', nameVi: 'Cấu hình hệ thống (Configuration)', nameKo: '시스템 설정', nameZh: '系统配置', isCustom: false, active: true },
  { id: 'frm_sys_approval', groupId: 'system', code: 'MES-S06', nameEn: 'Approval Workflow', nameVi: 'Luồng phê duyệt (Approval Workflow)', nameKo: '결재 워크플로우', nameZh: '审批流程', isCustom: false, active: true },
  { id: 'frm_sys_logs', groupId: 'system', code: 'MES-S07', nameEn: 'System Logs', nameVi: 'Nhật ký hệ thống (System Logs)', nameKo: '시스템 로그', nameZh: '系统日志', isCustom: false, active: true },
];

export const REPORT_CATEGORIES: { id: ReportCategoryId; labels: Record<LanguageCode, string> }[] = [
  { id: 'production_reports', labels: { vi: 'Báo cáo Sản xuất (Production Reports)', en: 'Production Reports', ko: '생산 리포트', zh: '生产报表' } },
  { id: 'quality_reports', labels: { vi: 'Báo cáo Chất lượng (Quality Reports)', en: 'Quality Reports', ko: '품질 리포트', zh: '质量报表' } },
  { id: 'equipment_reports', labels: { vi: 'Báo cáo Thiết bị (Equipment Reports)', en: 'Equipment Reports', ko: '설비 리포트', zh: '设备报表' } },
  { id: 'material_reports', labels: { vi: 'Báo cáo Vật tư (Material Reports)', en: 'Material Reports', ko: '자재 리포트', zh: '物料报表' } },
  { id: 'management_reports', labels: { vi: 'Báo cáo Điều hành (Management Reports)', en: 'Management Reports', ko: '경영 리포트', zh: '管理层报表' } },
];

export const DEFAULT_CATALOG_REPORTS: CatalogReport[] = [
  // Production
  { id: 'rpt_daily_prod', categoryId: 'production_reports', code: 'RPT-P01', nameEn: 'Daily Production Report', nameVi: 'Báo cáo sản xuất hàng ngày', nameKo: '일간 생산 보고서', nameZh: '每日生产报表', isCustom: false, active: true },
  { id: 'rpt_prod_summary', categoryId: 'production_reports', code: 'RPT-P02', nameEn: 'Production Summary', nameVi: 'Tổng hợp sản lượng', nameKo: '생산 요약', nameZh: '生产汇总报表', isCustom: false, active: true },
  { id: 'rpt_output_line', categoryId: 'production_reports', code: 'RPT-P03', nameEn: 'Output By Line', nameVi: 'Sản lượng theo chuyền', nameKo: '라인별 생산량', nameZh: '分产线产出报表', isCustom: false, active: true },
  { id: 'rpt_output_model', categoryId: 'production_reports', code: 'RPT-P04', nameEn: 'Output By Model', nameVi: 'Sản lượng theo Model', nameKo: '모델별 생산량', nameZh: '分机种产出报表', isCustom: false, active: true },
  { id: 'rpt_prod_achieve', categoryId: 'production_reports', code: 'RPT-P05', nameEn: 'Production Achievement', nameVi: 'Tỷ lệ đạt kế hoạch sản xuất', nameKo: '생산 목표 달성률', nameZh: '生产计划达成率', isCustom: false, active: true },
  { id: 'rpt_hourly_prod', categoryId: 'production_reports', code: 'RPT-P06', nameEn: 'Hourly Production Report', nameVi: 'Báo cáo sản xuất theo giờ', nameKo: '시간별 생산 보고서', nameZh: '分时段生产报表', isCustom: false, active: true },
  { id: 'rpt_wip', categoryId: 'production_reports', code: 'RPT-P07', nameEn: 'WIP Report', nameVi: 'Báo cáo tồn kho trên chuyền (WIP)', nameKo: '재공(WIP) 현황', nameZh: '在制品报表', isCustom: false, active: true },
  { id: 'rpt_prod_eff', categoryId: 'production_reports', code: 'RPT-P08', nameEn: 'Production Efficiency', nameVi: 'Báo cáo hiệu suất sản xuất', nameKo: '생산 효율 보고서', nameZh: '生产效率报表', isCustom: false, active: true },

  // Quality
  { id: 'rpt_defect_rate', categoryId: 'quality_reports', code: 'RPT-Q01', nameEn: 'Defect Rate', nameVi: 'Tỷ lệ lỗi (Defect Rate)', nameKo: '불량률 보고서', nameZh: '不良率报表', isCustom: false, active: true },
  { id: 'rpt_fpy', categoryId: 'quality_reports', code: 'RPT-Q02', nameEn: 'FPY Report', nameVi: 'Báo cáo đạt chuẩn lần đầu (FPY)', nameKo: '직행률(FPY) 보고서', nameZh: '直通率(FPY)报表', isCustom: false, active: true },
  { id: 'rpt_yield', categoryId: 'quality_reports', code: 'RPT-Q03', nameEn: 'Yield Report', nameVi: 'Báo cáo tỷ lệ đạt (Yield)', nameKo: '수율 보고서', nameZh: '良率报表', isCustom: false, active: true },
  { id: 'rpt_ng_analysis', categoryId: 'quality_reports', code: 'RPT-Q04', nameEn: 'NG Analysis', nameVi: 'Phân tích hàng NG', nameKo: 'NG 분석 보고서', nameZh: 'NG 不良分析', isCustom: false, active: true },
  { id: 'rpt_defect_pareto', categoryId: 'quality_reports', code: 'RPT-Q05', nameEn: 'Defect Pareto', nameVi: 'Biểu đồ Pareto lỗi', nameKo: '불량 파레토', nameZh: '不良柏拉图分析', isCustom: false, active: true },
  { id: 'rpt_quality_trend', categoryId: 'quality_reports', code: 'RPT-Q06', nameEn: 'Quality Trend', nameVi: 'Xu hướng chất lượng', nameKo: '품질 추이', nameZh: '质量趋势报表', isCustom: false, active: true },
  { id: 'rpt_spc', categoryId: 'quality_reports', code: 'RPT-Q07', nameEn: 'SPC Report', nameVi: 'Báo cáo thống kê SPC', nameKo: 'SPC 보고서', nameZh: 'SPC 统计报表', isCustom: false, active: true },

  // Equipment
  { id: 'rpt_eq_util', categoryId: 'equipment_reports', code: 'RPT-E01', nameEn: 'Equipment Utilization', nameVi: 'Hiệu suất sử dụng thiết bị', nameKo: '설비 가동률', nameZh: '设备利用率报表', isCustom: false, active: true },
  { id: 'rpt_downtime', categoryId: 'equipment_reports', code: 'RPT-E02', nameEn: 'Downtime Report', nameVi: 'Báo cáo dừng máy (Downtime)', nameKo: '비가동 보고서', nameZh: '停机时间报表', isCustom: false, active: true },
  { id: 'rpt_mtbf_mttr', categoryId: 'equipment_reports', code: 'RPT-E03', nameEn: 'MTBF / MTTR', nameVi: 'Chỉ số MTBF / MTTR', nameKo: 'MTBF / MTTR 지표', nameZh: 'MTBF / MTTR 指标', isCustom: false, active: true },
  { id: 'rpt_eq_alarm', categoryId: 'equipment_reports', code: 'RPT-E04', nameEn: 'Equipment Alarm History', nameVi: 'Lịch sử cảnh báo thiết bị', nameKo: '설비 알람 이력', nameZh: '设备报警历史', isCustom: false, active: true },
  { id: 'rpt_maint', categoryId: 'equipment_reports', code: 'RPT-E05', nameEn: 'Maintenance Report', nameVi: 'Báo cáo bảo trì thiết bị', nameKo: '설비 보전 보고서', nameZh: '设备维修报表', isCustom: false, active: true },

  // Material
  { id: 'rpt_mat_consump', categoryId: 'material_reports', code: 'RPT-M01', nameEn: 'Material Consumption', nameVi: 'Báo cáo tiêu hao vật tư', nameKo: '자재 소모량', nameZh: '物料消耗报表', isCustom: false, active: true },
  { id: 'rpt_mat_inv', categoryId: 'material_reports', code: 'RPT-M02', nameEn: 'Material Inventory', nameVi: 'Báo cáo tồn kho vật tư', nameKo: '자재 재고 현황', nameZh: '物料库存报表', isCustom: false, active: true },
  { id: 'rpt_mat_shortage', categoryId: 'material_reports', code: 'RPT-M03', nameEn: 'Material Shortage', nameVi: 'Cảnh báo thiếu hụt vật tư', nameKo: '자재 부족 현황', nameZh: '物料短缺预警', isCustom: false, active: true },
  { id: 'rpt_mat_trace', categoryId: 'material_reports', code: 'RPT-M04', nameEn: 'Material Traceability', nameVi: 'Báo cáo truy xuất vật tư', nameKo: '자재 추적 보고서', nameZh: '物料追溯报表', isCustom: false, active: true },
  { id: 'rpt_mat_aging', categoryId: 'material_reports', code: 'RPT-M05', nameEn: 'Material Aging', nameVi: 'Báo cáo tuổi tồn kho vật tư', nameKo: '자재 에이징 보고서', nameZh: '呆滞料账龄报表', isCustom: false, active: true },

  // Management
  { id: 'rpt_factory_overview', categoryId: 'management_reports', code: 'RPT-X01', nameEn: 'Factory Overview', nameVi: 'Tổng quan toàn nhà máy', nameKo: '공장 전체 현황', nameZh: '工厂总览报表', isCustom: false, active: true },
  { id: 'rpt_prod_kpi', categoryId: 'management_reports', code: 'RPT-X02', nameEn: 'Production KPI', nameVi: 'KPI sản xuất tổng hợp', nameKo: '생산 KPI', nameZh: '生产 KPI 报表', isCustom: false, active: true },
  { id: 'rpt_dept_kpi', categoryId: 'management_reports', code: 'RPT-X03', nameEn: 'Department KPI', nameVi: 'KPI theo phòng ban', nameKo: '부서별 KPI', nameZh: '部门 KPI 报表', isCustom: false, active: true },
  { id: 'rpt_daily_mgmt', categoryId: 'management_reports', code: 'RPT-X04', nameEn: 'Daily Management Report', nameVi: 'Báo cáo giao ban hàng ngày', nameKo: '일간 경영 보고서', nameZh: '每日管理报告', isCustom: false, active: true },
  { id: 'rpt_monthly_perf', categoryId: 'management_reports', code: 'RPT-X05', nameEn: 'Monthly Performance', nameVi: 'Hiệu quả vận hành hàng tháng', nameKo: '월간 성과 보고서', nameZh: '月度绩效报表', isCustom: false, active: true },
  { id: 'rpt_exec_dash', categoryId: 'management_reports', code: 'RPT-X06', nameEn: 'Executive Dashboard', nameVi: 'Dashboard ban lãnh đạo', nameKo: '경영진 대시보드', nameZh: '高管驾驶舱', isCustom: false, active: true },
];

export const WORKFLOW_ACTIVITIES: { id: string; labels: Record<LanguageCode, string> }[] = [
  { id: 'wf_manual_entry', labels: { vi: 'Nhập dữ liệu thủ công vào MES/File', en: 'Manual data entry', ko: '수동 데이터 입력', zh: '手工录入数据' } },
  { id: 'wf_excel_agg', labels: { vi: 'Tổng hợp dữ liệu bằng Excel', en: 'Data aggregation via Excel', ko: 'Excel 데이터 취합', zh: 'Excel 手工汇总数据' } },
  { id: 'wf_copy_systems', labels: { vi: 'Sao chép dữ liệu giữa các hệ thống', en: 'Copy/paste across systems', ko: '시스템 간 데이터 복사', zh: '跨系统复制粘贴数据' } },
  { id: 'wf_duplicate_entry', labels: { vi: 'Nhập cùng một thông tin nhiều lần', en: 'Duplicate entry of same data', ko: '동일 정보 중복 입력', zh: '重复录入相同信息' } },
  { id: 'wf_email_reports', labels: { vi: 'Gửi báo cáo thủ công qua Email', en: 'Sending reports via Email manually', ko: '이메일 수동 리포트 발송', zh: '手工邮件发送报表' } },
  { id: 'wf_multi_lookup', labels: { vi: 'Tra cứu dữ liệu từ nhiều nguồn', en: 'Lookup data from multiple sources', ko: '다중 소스 데이터 조회', zh: '多源系统交叉查数' } },
  { id: 'wf_manual_approval', labels: { vi: 'Chờ phê duyệt thủ công (giấy/email)', en: 'Waiting for manual approval', ko: '수동 결재 대기', zh: '等待线下/邮件审批' } },
  { id: 'wf_sheet_tracking', labels: { vi: 'Theo dõi sản xuất bằng bảng tính', en: 'Tracking production with spreadsheets', ko: '스프레드시트 생산 추적', zh: '电子表格追踪生产' } },
  { id: 'wf_no_alert', labels: { vi: 'Xử lý lỗi không có cảnh báo tự động', en: 'Handling defects without auto-alerts', ko: '자동 알람 없는 불량 처리', zh: '无自动预警的异常处理' } },
];

export const DX_FEATURES: { id: string; labels: Record<LanguageCode, string> }[] = [
  { id: 'dx_realtime_dash', labels: { vi: 'Real-time Production Dashboard', en: 'Real-time Production Dashboard', ko: '실시간 생산 대시보드', zh: '实时生产看板' } },
  { id: 'dx_smart_factory', labels: { vi: 'Smart Factory Dashboard', en: 'Smart Factory Dashboard', ko: '스마트 팩토리 대시보드', zh: '智能工厂总控看板' } },
  { id: 'dx_mobile_mes', labels: { vi: 'Mobile MES', en: 'Mobile MES', ko: '모바일 MES', zh: '移动端 MES' } },
  { id: 'dx_barcode_qr', labels: { vi: 'Tích hợp Barcode / QR Code', en: 'Barcode / QR Code Integration', ko: '바코드 / QR 코드 통합', zh: '条码 / 二维码集成' } },
  { id: 'dx_auto_collect', labels: { vi: 'Thu thập dữ liệu tự động (Auto Data Collection)', en: 'Automatic Data Collection', ko: '자동 데이터 수집', zh: '自动数据采集' } },
  { id: 'dx_eq_integ', labels: { vi: 'Kết nối thiết bị máy móc (Equipment Integration)', en: 'Equipment Integration', ko: '설비 연동 (PLC/IoT)', zh: '设备联网集成' } },
  { id: 'dx_erp_integ', labels: { vi: 'Tích hợp đồng bộ ERP', en: 'ERP Integration', ko: 'ERP 연동', zh: 'ERP 系统集成' } },
  { id: 'dx_wms_integ', labels: { vi: 'Tích hợp kho thông minh WMS', en: 'WMS Integration', ko: 'WMS 연동', zh: 'WMS 仓储集成' } },
  { id: 'dx_spc_integ', labels: { vi: 'Tích hợp SPC tự động', en: 'SPC Integration', ko: 'SPC 연동', zh: 'SPC 统计集成' } },
  { id: 'dx_bi_analytics', labels: { vi: 'Phân tích BI chuyên sâu', en: 'BI Analytics', ko: 'BI 분석', zh: 'BI 商业智能分析' } },
  { id: 'dx_ai_prod', labels: { vi: 'Phân tích sản xuất bằng AI', en: 'AI Production Analysis', ko: 'AI 생산 분석', zh: 'AI 生产分析' } },
  { id: 'dx_ai_defect', labels: { vi: 'Dự báo lỗi bằng AI (AI Defect Prediction)', en: 'AI Defect Prediction', ko: 'AI 불량 예측', zh: 'AI 缺陷预测' } },
  { id: 'dx_pred_maint', labels: { vi: 'Bảo trì dự đoán (Predictive Maintenance)', en: 'Predictive Maintenance', ko: '예지 보전', zh: '预测性维护' } },
  { id: 'dx_auto_email', labels: { vi: 'Gửi báo cáo Email tự động', en: 'Automatic Email Reports', ko: '자동 이메일 리포트', zh: '自动化邮件报表' } },
  { id: 'dx_digital_approval', labels: { vi: 'Phê duyệt số hóa (Digital Approval)', en: 'Digital Approval', ko: '전자 결재', zh: '数字化审批流' } },
  { id: 'dx_ewi', labels: { vi: 'Hướng dẫn công việc điện tử (E-WI)', en: 'Electronic Work Instructions', ko: '전자 작업표준서 (E-WI)', zh: '电子作业指导书 (E-WI)' } },
  { id: 'dx_paperless', labels: { vi: 'Sản xuất không giấy tờ (Paperless)', en: 'Paperless Manufacturing', ko: '페이퍼리스 제조', zh: '无纸化生产' } },
];

export const UX_CRITERIA: { key: keyof import('../types/survey').UxRatings; labels: Record<LanguageCode, string> }[] = [
  { key: 'uiEase', labels: { vi: 'Giao diện có dễ sử dụng không?', en: 'Is the interface easy to use?', ko: '인터페이스가 사용하기 쉬운가요?', zh: '界面是否易于使用？' } },
  { key: 'searchSpeed', labels: { vi: 'Tìm kiếm chức năng có nhanh không?', en: 'Is searching functions fast?', ko: '기능 검색이 빠른가요?', zh: '功能搜索是否快捷？' } },
  { key: 'stepEfficiency', labels: { vi: 'Số lượng thao tác có hợp lý (không quá nhiều)?', en: 'Is the number of clicks/steps reasonable?', ko: '작업 단계 수가 적절한가요?', zh: '操作步骤是否精简合理？' } },
  { key: 'pageLoadSpeed', labels: { vi: 'Tốc độ tải trang có đáp ứng không?', en: 'Is page loading speed acceptable?', ko: '페이지 로딩 속도가 만족스러운가요?', zh: '页面加载速度是否达标？' } },
  { key: 'errorStability', labels: { vi: 'Hệ thống ít xảy ra lỗi (1 = thường lỗi, 5 = ổn định)?', en: 'System stability (1 = frequent errors, 5 = stable)', ko: '시스템 안정성 (5=매우 안정)', zh: '系统稳定性（5=极少报错）' } },
  { key: 'dataAccuracy', labels: { vi: 'Dữ liệu hiển thị có chính xác không?', en: 'Is displayed data accurate?', ko: '데이터가 정확한가요?', zh: '系统数据是否准确？' } },
  { key: 'permissionFit', labels: { vi: 'Phân quyền truy cập có phù hợp không?', en: 'Are user permissions appropriate?', ko: '권한 설정이 적절한가요?', zh: '权限分配是否合理？' } },
  { key: 'needMobileUi', labels: { vi: 'Mức độ cần thiết của giao diện Mobile', en: 'Need for Mobile interface', ko: '모바일 UI 필요성', zh: '移动端界面需求度' } },
  { key: 'needMultilang', labels: { vi: 'Mức độ cần thiết hỗ trợ đa ngôn ngữ', en: 'Need for multi-language support', ko: '다국어 지원 필요성', zh: '多语言支持需求度' } },
];

export const SYSTEM_OPTIONS = ['MES', 'Web Report', 'ERP', 'WMS', 'SPC', 'Excel', 'Other'];
