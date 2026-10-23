export const SHEET_CATEGORIES=[{id:'active',label:'進行中',hint:'現在進めている案件'},{id:'sold',label:'販売済み',hint:'販売開始した車種・品番'},{id:'review',label:'要確認',hint:'不一致や記録不足を確認'}];
export function sheetCategory(p){return p.sheetStatus?.category||(p.launch?.status==='confirmed'?'sold':'active');}
export function primaryCases(projects){const ids=new Set(projects.map(p=>p.id));return projects.filter(p=>!['placeholder','closed'].includes(p.sheetStatus?.recordKind)&&(!p.sheetStatus?.relatedTo||!ids.has(p.sheetStatus.relatedTo)));}
export function statusCounts(projects){const out={active:0,sold:0,review:0};for(const p of primaryCases(projects))out[sheetCategory(p)]++;return out;}
export const displaySku=p=>p.sku||p.sheetStatus?.sku||'品番未定';
export function sheetSaleDate(p){const s=p.sheetStatus?.launchDate||p.launch?.date||'';const m=String(s).match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);if(!m)return '';const key=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;const d=new Date(key+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().startsWith(key)?key:'';}
export function sortSheetCases(projects,category){return category==='sold'?[...projects].sort((a,b)=>sheetSaleDate(b).localeCompare(sheetSaleDate(a))||a.id.localeCompare(b.id)):[...projects];}
export const sheetSourceUrl=p=>{const s=p.sheetStatus?.source;if(!s?.row)return '';const gid=s.sheet==='発売済み'?'370960166':'582854345';return `https://docs.google.com/spreadsheets/d/10KwQ9launAHtxrZAzQOyxWmjiq4RGXAbG-nPNOBPriM/edit?gid=${gid}&range=A${s.row}:AM${s.row}`;};
