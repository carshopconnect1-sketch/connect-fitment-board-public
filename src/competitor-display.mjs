const makers=[['TOYOTA','トヨタ'],['HONDA','ホンダ'],['NISSAN','日産'],['SUZUKI','スズキ'],['MAZDA','マツダ'],['DAIHATSU','ダイハツ'],['MITSUBISHI','三菱'],['SUBARU','スバル'],['トヨタ','トヨタ'],['ホンダ','ホンダ'],['ニッサン','日産'],['日産','日産'],['スズキ','スズキ'],['マツダ','マツダ'],['ダイハツ','ダイハツ'],['三菱','三菱'],['スバル','スバル']];
export function competitorDisplay(item){
 let car=String(item.title||'').normalize('NFKC').replace(/^シートカバー(?:追加車種|新商品)?\s*[:：]?\s*/,'');
 for(const code of item.codes||[])car=car.replaceAll(code,'');car=car.replace(/^[\s:：]+/,'').trim();const maker=makers.find(([label])=>car.toUpperCase().startsWith(label));if(maker)car=car.slice(maker[0].length).replace(/^[\s:：]+/,'');
 return {manufacturer:maker?.[1]||'',car:car.replace(/\s*\/\s*/g,' / ').replace(/\s+/g,' ').trim()||'公式詳細で車種を確認'};
}
