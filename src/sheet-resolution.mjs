import {currentDate} from './workflow.mjs';
export function resolveSampleSheet(project,v,actor){
 if(project.sheetStatus?.category!=='review'||!['active','sold','closed'].includes(v.category)||!v.note?.trim()||!v.reviewed)throw new Error('確認した状況とメモを入力してください。');
 if(v.date&&v.date>currentDate())throw new Error('販売開始日は今日以前の日付にしてください。');
 return {...project,sheetStatus:{...project.sheetStatus,category:v.category==='closed'?'active':v.category,recordKind:v.category==='closed'?'closed':'case',stage:v.category==='sold'?6:v.stage,launchDate:v.category==='sold'?v.date:'',question:'',issues:[],decision:`社員確認：${v.note.trim()}`,resolution:{...v,actor,at:new Date().toISOString()}}};
}
