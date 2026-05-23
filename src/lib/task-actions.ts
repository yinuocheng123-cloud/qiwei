/*
 * 文件说明：该文件是 V2.2 跟进任务相关 Server Actions 分组入口。
 * 功能说明：集中导出任务完成、延期、取消和任务模板维护动作，便于后续从 actions.ts 渐进拆出真实实现。
 *
 * 结构概览：
 *   第一部分：任务动作导出
 */
export { cancelTask, completeTask, createTaskTemplate, deactivateTaskTemplate, delayTask, updateTaskTemplate } from "@/lib/actions";
