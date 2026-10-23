import React from 'react';
import {ProductBasics} from './ProductFields.jsx';
import {safeExternalUrl} from './operations.mjs';

const noteFields={
 'plan':['今回登録する車種・仕様','例：ホンダ フリード／2026年式／6人乗り。対象グレードとシート形状を確認済み。'],
 'intake':['次の作業をする人・期限・手配するもの','例：担当Bが10月26日までに他社製品を手配。対象仕様を記載した資料を渡す。'],
 'purchase-order':['購入先・購入した製品・数量・到着予定','例：メーカー公式店で品番XX-100を1セット注文。10月26日に到着予定。'],
 'arrange':['用意できた現物と確認した仕様','例：型取り用のシートカバー1セットを受取。6人乗り用で相違なし。'],
 'product-plan':['今回登録する商品・仕様','例：防水フロアマット／ブラック／前後セット。既存商品へ新しいサイズを追加する。'],
 'product-check':['確認した商品・品番と、今回追加する理由','例：FM-100を確認。今回は後席用の新サイズを追加する。'],
 'product-intake':['決めた担当・期限・開発方針','例：担当Aが10月20日までに試作品を確認。担当Bへ品質確認を依頼。'],
 'product-source':['手配したもの・数量・到着予定','例：工場へ試作品1セットを依頼。10月25日に到着予定。'],
 'product-sample':['試作品の確認結果・修正する点','例：試作2回目を確認。固定位置を修正し、次回は取付を確認する。'],
 'product-quality':['品質・使用条件の確認結果','例：寸法・固定方法・素材・梱包を確認。対応型式と注意事項を確定。'],
 'product-sku':['登録した販売品番・色・サイズの対応','例：FM-101-BK＝前後セット・ブラックとして登録した。'],
 'product-stock':['決定した価格・在庫・納期','例：販売価格8,800円、初回20セット、通常納期3営業日。'],
 'product-order':['受注・注文書・CSVで確認したこと','例：FM-101の注文をテストし、注文書の品番とCSV変換結果が一致。'],
 'candidate':['確認した既存品番と今回開発する理由','例：既存品番の対象年式を確認。今回の仕様は対象外のため追加する。'],
 'csv-test':['変換前の品番・変換後の品番と確認結果','例：自社品番から中国向け品番に正しく変換された。'],
 'factory-receive':['工場が確認した荷物と内容','例：工場窓口に確認し、届いた製品・数量に相違なし。'],
};
const pageTasks=['main','rakuten','yahoo','product-hp','hp-category','hp-products'];
export function TaskWorkFields({project,task,draft,set,productInput,setProductInput,productPlan}){
 const page=pageTasks.includes(task.id),[label,example]=noteFields[task.id]||[`${task.name}で行ったこと`,page?'例：品番・価格・画像・選択肢を確認し、公開ページから注文できることを確認した。':`記入する内容：${task.description||task.proof||'行った作業と次に伝える内容'}`];
 const url=<><label>{page?'確認する商品・カテゴリページのURL':'写真・資料・作業画面のURL'}<input type="url" value={draft.referenceUrl} onChange={e=>set('referenceUrl',e.target.value)} placeholder="https://…"/></label>{safeExternalUrl(draft.referenceUrl)&&<a className="secondary next-guided-task" href={safeExternalUrl(draft.referenceUrl)} target="_blank" rel="noopener noreferrer">登録したページ・資料を開く ↗</a>}</>;
 return <>{productPlan?<><h3>商品の内容を入力</h3><ProductBasics editingTask draft={{...project,...productInput}} set={(key,value)=>setProductInput(key,value)}/><p className="guided-field-help">この内容は商品情報にも保存されます。入力できたら、下の「完了内容を確認」へ進みます。</p></>:<label>{label}<span>次の担当が読んで分かるように記録してください。</span><textarea rows={3} value={draft.note} onChange={e=>set('note',e.target.value)} placeholder={example}/></label>}{page?url:<details className="guided-assignment" open={draft.referenceUrl?true:undefined}><summary>資料リンクを追加（任意）</summary>{url}<p>写真や資料がある場合に、その保存先のリンクを入れます。なければ入力は不要です。</p></details>}</>;
}
