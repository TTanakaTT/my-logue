# my-logue

シンプルな選択式ローグライト。
Vite + Svelte + TypeScript。

## 概要

- 10階層 x 各5ステップ (最後はボス)
- ノード: 戦闘 / イベント / 休憩 / ボス
- 戦闘: 1ターンに提示3行動から最大2回選択 → 敵行動 → 終了処理
- クリティカル: 提示された行動リストの一番左(先頭)を選ぶとクリティカル版として効果強化
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

## バランス調整

バランス調整は `src/lib/data/consts` で管理しています。

### クリティカル仕様

- 毎ターン提示される行動 (`state.actionOffer`) の index 0 がクリティカルスロット。
- アクション定義は `ActionDef` で `normalAction` / `criticalAction` および `normalLog` / `criticalLog` を持つ。
