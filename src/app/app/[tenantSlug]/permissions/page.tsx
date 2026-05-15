/*
 * 文件说明：该页面实现 V1.8.1 的权限矩阵说明页。
 * 功能说明：向企业管理员和运营说明当前系统里不同角色能看什么、能做什么、不能做什么，以及关键权限边界。
 *
 * 结构概览：
 *   第一部分：导入依赖与静态说明数据
 *   第二部分：基础展示组件
 *   第三部分：权限矩阵说明页
 */
import { PageShell } from "@/components/Shell";
import { Card } from "@/components/Ui";
import { requireTenantAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RoleCard = {
  code: string;
  title: string;
  position: string;
  canView: string[];
  canOperate: string[];
  shouldAvoid: string[];
  boundary: string;
};

type MatrixRow = {
  module: string;
  platformAdmin: string;
  tenantAdmin: string;
  operator: string;
  sales: string;
  viewer: string;
};

const principleCards = [
  {
    title: "老板看全局",
    description: "老板看客户从哪里来、业务线跑得怎么样、销售有没有跟、哪些客户要重点推进。"
  },
  {
    title: "运营管资产",
    description: "运营管业务线、资料包、策略库、任务模板，让销售有东西可发、有话可说、有节奏可跟。"
  },
  {
    title: "销售做跟进",
    description: "销售每天只看自己的客户和任务，按系统建议回复、打标签、记录跟进、推进下一步。"
  }
];

const roleCards: RoleCard[] = [
  {
    code: "PLATFORM_ADMIN",
    title: "平台超级管理员",
    position: "系统控制方，负责租户、系统配置、安全、平台级审计和运维。",
    canView: ["平台后台", "租户列表", "平台审计日志", "系统配置", "企业微信配置状态", "系统健康状态"],
    canOperate: ["创建租户", "停用租户", "恢复租户", "配置租户基础信息", "协助配置企业微信", "查看平台级审计", "处理系统异常"],
    shouldAvoid: ["不建议直接参与某个租户的日常客户跟进", "不建议随便修改企业客户资料", "不建议代替企业销售添加跟进记录", "不建议展示企业微信 secret 明文"],
    boundary: "平台方掌握系统，企业方拥有客户业务数据。平台方只在运维、配置、排障、授权情况下查看或处理租户数据。"
  },
  {
    code: "TENANT_ADMIN",
    title: "企业管理员",
    position: "企业老板、总经理、业务负责人，负责看全局、定方向、管结果。",
    canView: ["Dashboard", "客户列表", "所有客户详情", "业务线／产品", "资料包", "策略库", "任务模板", "销售工作台", "审计日志", "客户导入", "客户导出", "演示说明", "企业微信配置状态"],
    canOperate: ["新增客户", "导入客户", "分配客户", "修改客户阶段", "添加标签", "新增／编辑／暂停／归档业务线", "维护资料包", "维护策略库", "维护任务模板", "查看审计日志", "导出客户基础数据", "查看销售跟进情况"],
    shouldAvoid: ["不建议物理删除业务线", "不建议物理删除客户历史", "不建议清空审计日志", "不建议查看企业微信 secret 明文", "不建议绕过销售流程直接批量修改跟进结果"],
    boundary: "企业管理员可以管理业务，但不能破坏历史。业务线只做启用、暂停、归档，不做物理删除。"
  },
  {
    code: "OPERATOR",
    title: "企业运营",
    position: "负责维护业务资产，包括资料、话术、策略、任务模板、内容承接和活动承接。",
    canView: ["Dashboard", "客户列表", "客户详情", "业务线／产品", "资料包", "策略库", "任务模板", "销售工作台", "客户导入", "演示说明"],
    canOperate: ["编辑业务线", "暂停业务线", "新增资料包", "修改资料包", "维护客户类型策略", "维护任务模板", "导入客户", "添加标签", "生成智能跟进建议", "确认智能标签建议", "保存跟进记录"],
    shouldAvoid: ["不建议开放客户导出", "不建议开放完整审计日志", "不建议开放企业微信敏感配置", "不建议允许归档核心业务线，除非企业管理员授权", "不建议允许删除客户或清空历史数据"],
    boundary: "企业管理员决定做不做，运营负责怎么做，销售负责跟客户。"
  },
  {
    code: "SALES",
    title: "销售／顾问",
    position: "每天真正使用系统跟进客户的人。只需要知道今天跟谁、客户什么情况、该说什么、该发什么资料、该加什么标签、下一步怎么推进。",
    canView: ["自己的客户", "自己负责的客户详情", "销售工作台", "今日任务", "逾期任务", "高优先级任务", "客户推荐资料", "智能跟进助手", "智能标签建议", "演示说明中的销售视角"],
    canOperate: ["新增跟进记录", "修改自己客户的阶段", "设置下次跟进", "完成任务", "延期任务", "取消自己的任务", "复制推荐话术", "确认智能标签建议", "保存智能回复为跟进记录", "给自己负责客户添加标签"],
    shouldAvoid: ["不应该看到平台后台", "不应该看到审计日志", "不应该看到企业微信配置", "不应该看到客户导出", "不应该看到资料包编辑、策略库编辑、任务模板编辑、业务线编辑", "不应该看到租户配置和其他销售负责的客户"],
    boundary: "销售只能使用系统，不应该管理系统。销售界面要轻，只保留我的客户、销售工作台、客户详情、智能跟进助手、智能标签建议。"
  },
  {
    code: "VIEWER",
    title: "只读观察员，未来扩展",
    position: "给老板助理、合作伙伴、外部顾问、投资人、项目观察人员看数据，但不给操作权。",
    canView: ["Dashboard", "部分客户统计", "业务线状态", "销售任务统计", "项目进度", "周报／月报"],
    canOperate: ["当前只作为规划说明，不落库、不开放真实角色配置"],
    shouldAvoid: ["不能修改客户", "不能导入客户", "不能导出客户", "不能改业务线", "不能改资料包", "不能改任务", "不能看敏感配置", "不能看完整手机号等敏感字段，除非授权"],
    boundary: "当前只作为规划中的说明角色展示，未来若实现，默认按只读、脱敏、不可操作设计。"
  }
];

const matrixRows: MatrixRow[] = [
  { module: "租户管理", platformAdmin: "可管理", tenantAdmin: "不可见", operator: "不可见", sales: "不可见", viewer: "规划中不可见" },
  { module: "平台审计", platformAdmin: "可查看", tenantAdmin: "不可见", operator: "不可见", sales: "不可见", viewer: "规划中不可见" },
  { module: "Dashboard", platformAdmin: "平台视角", tenantAdmin: "查看全部", operator: "查看业务数据", sales: "只看自己相关", viewer: "规划中只读" },
  { module: "客户列表", platformAdmin: "非日常入口", tenantAdmin: "查看全部", operator: "查看全部或授权范围", sales: "只看自己负责", viewer: "规划中只读脱敏" },
  { module: "客户详情", platformAdmin: "授权排障时查看", tenantAdmin: "查看全部", operator: "查看全部或授权范围", sales: "只看自己负责", viewer: "规划中只读脱敏" },
  { module: "客户导入", platformAdmin: "不直接处理", tenantAdmin: "可操作", operator: "可操作", sales: "不可见", viewer: "不可操作" },
  { module: "客户导出", platformAdmin: "不直接处理", tenantAdmin: "可操作", operator: "默认不可", sales: "不可见", viewer: "不可操作" },
  { module: "业务线／产品", platformAdmin: "不直接管理", tenantAdmin: "新增／编辑／暂停／归档", operator: "新增／编辑／暂停", sales: "只读启用项", viewer: "规划中只读" },
  { module: "资料包", platformAdmin: "不直接维护", tenantAdmin: "可编辑", operator: "可编辑", sales: "不可编辑", viewer: "规划中只读" },
  { module: "策略库", platformAdmin: "不直接维护", tenantAdmin: "可编辑", operator: "可编辑", sales: "不可见或不可编辑", viewer: "规划中只读" },
  { module: "任务模板", platformAdmin: "不直接维护", tenantAdmin: "可编辑", operator: "可编辑", sales: "不可编辑", viewer: "规划中只读" },
  { module: "销售工作台", platformAdmin: "不参与日常跟进", tenantAdmin: "查看全部", operator: "查看全部", sales: "只看自己任务", viewer: "规划中只读统计" },
  { module: "跟进记录", platformAdmin: "授权排障时查看", tenantAdmin: "查看全部", operator: "查看全部并协助保存", sales: "新增自己的", viewer: "规划中只读脱敏" },
  { module: "智能跟进助手", platformAdmin: "不作为日常入口", tenantAdmin: "可使用", operator: "可使用", sales: "可使用", viewer: "不可操作" },
  { module: "智能标签建议", platformAdmin: "不作为日常入口", tenantAdmin: "可确认", operator: "可确认", sales: "仅自己客户可确认", viewer: "不可操作" },
  { module: "审计日志", platformAdmin: "看平台审计", tenantAdmin: "看租户审计", operator: "默认不开放", sales: "不开放", viewer: "规划中不开放" },
  { module: "企业微信配置", platformAdmin: "可配置并协助排障", tenantAdmin: "看状态／有限配置", operator: "只读状态或不可见", sales: "不可见", viewer: "不开放" },
  { module: "演示说明", platformAdmin: "平台视角", tenantAdmin: "老板视角", operator: "运营视角", sales: "销售视角", viewer: "规划中汇报视角" }
];

const boundaryItems = [
  {
    title: "业务线不做物理删除",
    description:
      "业务线／产品是核心业务资产，只提供启用、暂停、归档，不提供删除。因为业务线可能关联客户、标签、资料包、任务模板、跟进记录、审计日志和成交记录，删除会造成历史断层。"
  },
  {
    title: "企业微信配置必须高权限",
    description:
      "企业微信配置不能暴露给销售和普通运营，尤其是 secret、token、EncodingAESKey、回调地址和应用配置。原则是：可配置，但不明文展示；可检查状态，但不泄露密钥；可由平台协助，但企业保留主体。"
  },
  {
    title: "审计日志不是普通数据",
    description:
      "审计日志是管理和风控工具，不是销售工具。销售不应该看到审计日志。企业管理员看租户审计，平台管理员看平台审计。"
  },
  {
    title: "客户导出要严格控制",
    description:
      "客户导出是敏感动作，建议只有企业管理员能导出。导出必须写入审计日志。导出内容只包含客户基础数据，不导出系统模板、平台方法论、企业微信密钥和审计日志全量。"
  },
  {
    title: "销售只能使用系统，不管理系统",
    description:
      "销售最重要的是使用效率。销售只看任务、客户、跟进建议和标签建议，不管理业务线、资料包、策略库、任务模板、审计、企微配置和导出。"
  }
];

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <div className="mt-2 space-y-2">
      {items.map((item) => (
        <p key={item} className="text-sm leading-6 text-slate-700">
          {item}
        </p>
      ))}
    </div>
  );
}

export default async function PermissionsPage({ params }: { params: { tenantSlug: string } }) {
  const { tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);

  return (
    <PageShell
      tenant={tenant}
      title="权限矩阵"
      description="不同角色看到不同菜单，拥有不同操作权限。系统通过角色边界，保证销售专注跟进，运营维护业务资产，企业管理员管理全局，平台管理员负责系统安全和租户管理。"
    >
      <div className="space-y-6">
        <Card className="bg-slate-950 text-white">
          <p className="text-sm font-medium text-slate-200">三句话总原则</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {principleCards.map((item) => (
              <div key={item.title} className="rounded-md border border-slate-700 bg-slate-900/70 p-4">
                <h2 className="text-xl font-semibold">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-200">{item.description}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle
            title="角色总览"
            description="当前系统已经落地 PLATFORM_ADMIN、TENANT_ADMIN、OPERATOR、SALES 四类角色；VIEWER 暂作为未来扩展规划说明，不在本轮落库实现。"
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {roleCards.map((role) => (
              <div key={role.code} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{role.code}</p>
                <h3 className="mt-2 text-base font-semibold text-slate-950">{role.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{role.position}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          {roleCards.map((role) => (
            <Card key={role.code}>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{role.code}</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">{role.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">{role.position}</p>

              <div className="mt-4">
                <p className="text-sm font-medium text-slate-950">可以看什么</p>
                <BulletList items={role.canView} />
              </div>

              <div className="mt-4">
                <p className="text-sm font-medium text-slate-950">可以操作什么</p>
                <BulletList items={role.canOperate} />
              </div>

              <div className="mt-4">
                <p className="text-sm font-medium text-slate-950">不建议开放什么</p>
                <BulletList items={role.shouldAvoid} />
              </div>

              <div className="mt-4 rounded-md bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-950">权限边界</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{role.boundary}</p>
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <SectionTitle title="权限矩阵表" description="这张表用于解释不同角色为什么看到不同菜单、能做不同动作，也用于内部培训和对外交付说明。" />
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[1080px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-3 font-semibold text-slate-950">模块</th>
                  <th className="px-3 py-3 font-semibold text-slate-950">平台超级管理员</th>
                  <th className="px-3 py-3 font-semibold text-slate-950">企业管理员</th>
                  <th className="px-3 py-3 font-semibold text-slate-950">企业运营</th>
                  <th className="px-3 py-3 font-semibold text-slate-950">销售／顾问</th>
                  <th className="px-3 py-3 font-semibold text-slate-950">只读观察员，规划中</th>
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row) => (
                  <tr key={row.module} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3 font-medium text-slate-950">{row.module}</td>
                    <td className="px-3 py-3 text-slate-700">{row.platformAdmin}</td>
                    <td className="px-3 py-3 text-slate-700">{row.tenantAdmin}</td>
                    <td className="px-3 py-3 text-slate-700">{row.operator}</td>
                    <td className="px-3 py-3 text-slate-700">{row.sales}</td>
                    <td className="px-3 py-3 text-slate-700">{row.viewer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <SectionTitle title="关键边界" description="这些说明不是功能列表，而是系统边界。它们决定了为什么某些入口不开放、为什么某些能力只做只读或归档而不做删除。" />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {boundaryItems.map((item) => (
              <div key={item.title} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">{item.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
