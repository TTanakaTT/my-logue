## GitHub Copilot Instructions / Contribution Guide

このリポジトリは SvelteKit (Vite + Svelte 5 + TypeScript) によるシンプルな選択式ローグライトゲームです。生成 AI (Copilot など) を用いる際・PR を送る際は以下の方針/約束を守ってください。

### 目的

- プレイ体験のコア: 「短い 1 ランで意思決定を繰り返し徐々に強くなる」
- 変更は学習しやすいドメインモデル (`src/lib/domain`) とデータ定義 (`src/lib/data`) の明確さを保つこと

## 開発フロー

| シナリオ             | コマンド        | 内容                                          |
| -------------------- | --------------- | --------------------------------------------- |
| 依存取得             | `pnpm install`  | 依存ライブラリ取得                            |
| 開発サーバ           | `pnpm dev`      | Vite 開発サーバ (Playwright E2E もこれに依存) |
| 型+Svelte チェック   | `pnpm check`    | `svelte-check` による型/コンポーネント検証    |
| Lint & Prettier 検証 | `pnpm lint`     | Prettier 差分 + ESLint                        |
| 自動整形             | `pnpm format`   | Prettier で一括整形                           |
| E2E テスト           | `pnpm test:e2e` | Playwright による E2E                         |

### Commit / PR 前のチェック (必須)

1. `pnpm format` を実行し整形差分を確定
2. `pnpm lint` で ESLint / Prettier チェックが全てパス
3. `pnpm check` で型エラーが無いこと
4. 影響する挙動があれば最小限の E2E 追加/更新 (`tests-e2e/`) を検討
5. 大きなゲームバランス変更時は `README.md` か、別途 `docs/` (未作成なら提案) への反映を検討

CI (将来追加/拡張する場合) の想定シーケンス例: format チェック → lint → type check → e2e。

## リポジトリ構造ガイド

- `src/lib/domain/entities/` : ドメインのエンティティ (キャラクター、アクション、ステータス等)。ロジックはできるだけ副作用最小化。
- `src/lib/domain/services/` : エンティティ間協調ロジック。純粋関数志向を優先しつつランダム性/状態遷移はここに集中。
- `src/lib/data/` : 定数・CSV などデータソース。難読化せずバランス測定しやすく保つ。
- `src/lib/presentation/` : Svelte コンポーネント層。UI 状態は必要最小限を保持し、ゲーム進行は domain/services を呼ぶ形に。
- `src/routes/` : ページルーティング (SvelteKit)。
- `tests-e2e/` : Playwright テスト。ユーザ視点の最小回帰用シナリオを意識。
- `typings/` : 追加型宣言。生 CSV の `import` などをサポート。

### データ変更

CSV (`characters.csv`, `rewards.csv` 等) を変更する場合は:

1. 破壊的変更 (列追加/削除) 時に読み込み側 Repository (`src/lib/data/repositories/*Repository.ts`) を同期更新
2. ゲームバランスへ影響の説明を PR に簡潔に記載

## コードスタイル / 設計指針

1. TypeScript で型を明確化 (特にエンティティ境界とサービス戻り値)。`any` は避ける。
2. ドメインサービスは副作用を戻り値に集約 (例: ダメージ計算結果 + ログ) し、UI で描画。
3. 関数は「入力: 不変データ構造 / 出力: 新しいコピー」を基本とし、ミュータブル共有を避ける。
4. ランダム性 (乱数) はテストしやすいよう抽象化 (例: `randomFn` を引数に受ける) を検討。
5. 1 ファイルの責務を狭く保つ (概ね 200 行以内目安)。
6. ログ/デバッグは `src/lib/presentation/utils/logUtil.ts` 経由で統一。
7. 早期リターンでネストを浅く維持。

### コメント / ドキュメント

- 複雑な計算 (ダメージ、成長ロジック等) は数式や確率根拠を JSDoc で簡潔に記述。
- 意図を失いやすいマジックナンバーは禁止。`const` 命名で意味付け。

## Copilot へのプロンプト例

安全な活用を促し再利用性を高めるための例。

### 例1: ドメインサービス拡張

```
目的: クリティカルヒット計算を追加したい。
既存: damageService.ts で基礎ダメージ算出。
要件: 5% 基礎確率 + キャラ Luck * 0.5% (上限 25%)。クリティカル時 x1.5。
出力: 新しい純粋関数 computeDamageWithCritical(baseArgs, randFn) を提案。
副作用禁止 / 既存 computeDamage を内部再利用。
```

### 例2: CSV 読み込みバリデーション

```
目的: characters.csv 読み込み時に必須列チェックを追加。
列: id,name,hp,attack,rarity
不足 or パース失敗時は throw ではなく { errors: [...], records: [...] } を返す構造に刷新。
repository ファイルへの最小差分パッチを出力。
```

### 例3: UI コンポーネント改善

```
目的: CharacterPanel.svelte にホバー詳細ツールチップを追加。
制約: 既存スタイル崩さず、TooltipBadge.svelte を再利用。アクセシビリティ属性 (aria-label) 追加。
```

## 将来の改善候補

- docs/ ディレクトリ新設 (ゲーム内計算式一覧)
- バランス調整用シミュレーションスクリプト (Node CLI)
- i18n 基盤 (英語/日本語切替)

## ライセンス / 著作権

外部アセットを追加する際はライセンス表記を README に追記。生成画像/音声は出典と生成プロンプトをメタデータで保持。
