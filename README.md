# my-logue

シンプルな選択式ローグライト (Slay the Spire 簡易風)。Vite + Svelte + TypeScript。

## MVP 概要

- 10階層 x 各5ステップ (最後はボス)
- ノード: 戦闘 / イベント / 休憩 / ボス
- 戦闘: 1ターンに提示3行動から最大2回選択 → 敵行動 → 終了処理
- 成長: 戦闘勝利後ランダム成長 (最大HP, 攻撃力, 新アクション)
- スコア: 撃破した敵数
- LocalStorage: 最高到達階層

## 開発

```
pnpm install
pnpm dev
```

## テスト

```
pnpm test
```

## デプロイ (GitHub Pages)

事前にリポジトリを GitHub 上に作成し、`vite.config.ts` の `base` をリポジトリ名と一致させる。

```
pnpm deploy
```

`gh-pages` ブランチにビルド成果物が push される。

## ライセンス

MIT (予定)

## バランス調整 (CSV ベース)

キャラクター/敵ステータスは `src/data/*.csv` で管理しています。

### ファイル構成

- `src/data/player_stats.csv`
  - 1行のみ想定。列: id,name,STR,CON,POW,DEX,APP,INT,actions,maxActionsPerTurn,maxActionChoices,revealed
  - `actions` は `|` 区切り (例: `strike|heavy|guard`)
  - `revealed` は公開するステータス key を `|` 区切り (hp / STR / CON / ...)
- `src/data/enemy_stats.csv`
  - 複数行 (階層帯/種類ごと)。列: id,kind,floorMin,floorMax,name,STR,CON,POW,DEX,APP,INT,actions,maxActionsPerTurn,maxActionChoices,revealed
  - `kind` は `enemy` or `boss`
  - `floorMin` / `floorMax` は 0-based floorIndex の inclusive 範囲
  - 最初にマッチした行を使用。範囲未定義 floor は最初の同 kind 行でフォールバック

### 反映ロジック

`state.ts` でプレイヤー初期化および敵生成時に `dataLoader.ts` 経由で CSV をパースし値を構築しています。最大HPは CON から計算式 (`stats.ts` の `calcMaxHP`) を用いて算出し、初期 HP に設定します。

### 調整手順

1. `src/data/player_stats.csv` または `enemy_stats.csv` を編集
2. 開発サーバ実行中なら保存で即反映 (Vite の HMR)
3. 新しい列を追加したい場合は `dataLoader.ts` のパース処理を拡張

### よくある拡張例

- 行動追加: actions 列に既存 ActionId を追加 (未実装の ActionId を書くと実行時エラーになるので注意)
- 複数プレイヤープリセット: player_stats.csv に新行追加 → `buildPlayerFromCsv` を拡張し id 指定ロードへ変更
- 階層細分化: enemy_stats.csv に floor 範囲を細かく分けた行を追加

### 注意

- CSV に余分な空白や末尾カンマを入れないでください (簡易パーサのため)
- 文字列にカンマを含めたい場合は現在非対応なので name はカンマを避ける

不明点や拡張要望があれば Issue / PR でどうぞ。
