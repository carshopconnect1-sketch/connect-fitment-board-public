# 適合・開発管理：公開ソース・開発引継ぎ

[画面を開く](https://connect-fitment-board-preview.masaruharuyama.chatgpt.site/) · **[次の担当者向けの引継ぎ資料](HANDOFF.md)**

この管理画面のReact/Viteソース、サンプルデータ、テスト、起動手順だけを公開しています。実案件・管理シート・実送り状・認証情報・社内接続ソース・過去の社内作業履歴は含みません。

## 取得して改修する

Git・Node.js 24系・npmを用意してください。WordPressログインや元担当者のPCは不要です。

```sh
git clone https://github.com/carshopconnect1-sketch/connect-fitment-board-public.git
cd connect-fitment-board-public
npm ci
npm run dev -- --host 127.0.0.1 --port 4185 --strictPort
```

そのPCで http://127.0.0.1:4185/ を開きます。Windowsで独立した非表示プロセスとして起動する場合は、最後のコマンドの代わりに次を使います。

```powershell
powershell -NoProfile -File .\scripts\start-demo.ps1
```

ソースは `src/` にあります。編集するとプレビューに反映されます。自分で変更を保存・pushする場合は、このリポジトリをForkして自分のGitHubで開発できます。公開は元リポジトリへの全員の直接pushを許可するものではありません。

## 現在の動作

公開版の7工程を基準に、案件登録・作業入力・完了・次担当への引継ぎ・受領・販売承認・お知らせを試せます。担当未定で登録してもサンプル担当を仮設定し、①案件登録から②購入・発送へ進めます。操作中の担当と案件担当が違っていても作業を編集できます。

作業入力は「今回登録する車種・仕様」などの項目名と記入例を表示し、資料リンクは任意で追加します。前工程・確認内容・引継ぎ受領・最終確認者の承認は引き続き必要です。

**サンプルの入力内容はそのタブの中だけに保存され、再読み込みで初期化されます。** 他の人のPCやタブへ共有されません。実案件を扱う共有サービスにするための残作業は[引継ぎ資料](HANDOFF.md)を参照してください。

## 確認とビルド

```sh
npm test
npm run build
```

配信物は `dist/client/`、公開用処理は `worker/` です。このリポジトリに個人の公開先IDや認証情報は設定していません。自分の公開先へ配信する場合は、その公開先の設定を使用してください。
