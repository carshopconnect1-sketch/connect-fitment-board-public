import { TODAY, preparationComplete } from './workflow.mjs';
import { caseLaunchIssues, publicationIssues } from './case-workflow.mjs';
import {isProduct,productLaunchIssues} from './products.mjs';

const FITMENT_FIELDS = ['year', 'type', 'seats', 'grade', 'shape', 'exclusions'];
const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export function launchIssues(project) {
  const issues = caseLaunchIssues(project);
  if (project.hold) issues.push('保留を解除してください。');
  if (!preparationComplete(project)) issues.push('開発・適合確認・販売準備の必要な作業を完了してください。');
  if (!project.sku?.trim()) issues.push('自社の販売品番を入力してください。');
  if(isProduct(project))issues.push(...productLaunchIssues(project));
  else if (FITMENT_FIELDS.some(key => !String(project.fitment?.[key] || '').trim())) issues.push('適合情報の全項目を入力してください。注意事項がない場合は「なし」と記録してください。');
  return issues;
}

export function confirmLaunch(project, draft, today = TODAY, recordedAt = new Date().toISOString()) {
  const issues = launchIssues(project);
  if (issues.length) throw new Error(issues.join(' '));
  if (!validDate(draft.date) || draft.date > today) throw new Error('実際の発売日は今日以前の存在する日付を入力してください。');
  if (!draft.confirmedBy?.trim()) throw new Error('最終確認者を選択してください。');
  if (draft.reviewed !== true) throw new Error('適合・品番・販売準備の最終確認にチェックしてください。');
  const publication=publicationIssues(project,draft);
  if (publication.length) throw new Error(publication.join(' '));
  return { ...project, launch: { status: 'confirmed', date: draft.date, confirmedBy: draft.confirmedBy.trim(), confirmedAt: recordedAt, note: draft.note?.trim() || '',urls:{...draft.urls},orderChecked:{...draft.orderChecked} } };
}

export function requireLaunchReview(project) {
  return project.launch?.status === 'confirmed' ? { ...project, launch: { ...project.launch, status: 'needs-review' } } : project;
}
