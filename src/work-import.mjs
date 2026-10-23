// Parse only data. A preview and a server-side permission/validation check precede every import.
export function importRows(text) {
  const input=text.replace(/^\uFEFF/,'');
  if(input.length>500000)throw new Error('取り込みは500KB以下で行ってください。');
  const sep=input.includes('\t')?'\t':',';
  const lines=[];let row=[],field='',quoted=false;
  for(let i=0;i<input.length;i++){
    const c=input[i];
    if(c==='"'){
      if(quoted&&input[i+1]==='"'){field+='"';i++;}
      else if(quoted)quoted=false;
      else if(!field)quoted=true;
      else field+=c;
    }else if(!quoted&&c===sep){row.push(field);field='';}
    else if(!quoted&&(c==='\r'||c==='\n')){
      if(c==='\r'&&input[i+1]==='\n')i++;
      row.push(field);if(row.some(x=>x.trim()))lines.push(row);row=[];field='';
    }else field+=c;
  }
  if(quoted)throw new Error('CSVの引用符が閉じていません。');
  row.push(field);if(row.some(x=>x.trim()))lines.push(row);
  if(['元データID','sourceId'].includes(lines[0]?.[0]?.trim()))lines.shift();
  if(!lines.length||lines.length>100)throw new Error('1回の取り込みは1〜100行で行ってください。');
  const seen=new Set();
  return lines.map((r,i)=>{
    const[sourceId,manufacturer,car,sku='',type='',method='',baseVehicleId='']=r.map(x=>x.trim());
    const prefix=`${i+1}行目：`;
    if(!sourceId||!manufacturer||!car)throw new Error(prefix+'元ID・メーカー・車種が必要です。');
    if(seen.has(sourceId))throw new Error(prefix+'元データIDが重複しています。');seen.add(sourceId);
    if(!['新規','既存'].includes(type))throw new Error(prefix+'登録区分は新規または既存を指定してください。');
    if(!['購入','自社'].includes(method))throw new Error(prefix+'型取り方法は購入または自社を指定してください。');
    if(type==='既存'&&!baseVehicleId)throw new Error(prefix+'追加先IDを指定してください。');
    return {sourceId,manufacturer,car,sku,registrationType:type==='既存'?'existing':'new',developmentMethod:method==='自社'?'own':'purchase',baseVehicleId,salesChannels:['main','rakuten','yahoo']};
  });
}
