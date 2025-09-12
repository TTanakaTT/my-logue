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
