<div align="center">

<img src="docs/assets/hero-banner.png" alt="QueenBee Workstation" width="100%" />

# 🐝 QueenBee Workstation

### マルチエージェント管理・監視 Web インターフェース

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Apache_2.0-yellow?style=for-the-badge)](LICENSE)

**[中文](README.md) | [English](README_EN.md) | 日本語**

**QueenBee Workstation は [QueenBee](https://github.com/heyangguang/queenbee) マルチエージェントエンジンの Web 管理インターフェースです。** エージェントの状態をリアルタイムに監視し、チームコラボレーションを管理し、メッセージキューを検査し、スキルとメモリを設定 — 高密度な Dashboard でエージェントクラスター全体を制御します。

[はじめに](#-はじめに) · [機能](#-機能) · [技術スタック](#-技術スタック) · [コントリビュート](#-コントリビュート)

</div>

---

## ✨ 機能

### 📊 リアルタイム Dashboard
ホームページのダッシュボードが SSE 経由でシステム全景をリアルタイム表示：
- **エージェント統計** — 合計数、オンライン/オフライン、アクティブ会話数
- **キュー状態** — Pending / Processing / Completed / Dead メッセージ数
- **レスポンス時間** — 平均処理時間、トレンドチャート
- **クイックアクセス** — エージェント、チーム、キュー管理へワンクリックジャンプ

### 💬 チャットインターフェース
エージェントと直接会話するためのコアインターフェース：
- **@mention ルーティング** — メッセージ内で `@agent-name` を使い直接送信
- **リアルタイムストリーミング** — SSE によるエージェントレスポンスのプッシュ配信
- **Markdown レンダリング** — GFM サポート（コードブロック、テーブル、リスト）
- **会話履歴** — 過去のチャット履歴のブランチと検索

### 🤖 エージェント管理
フルライフサイクルのエージェント管理：
- **作成 / 編集** — 名前、プロバイダー、モデル、フォールバックプロバイダーを設定
- **プロンプト編集** — エージェントのシステムプロンプトを表示・修正
- **ソウル表示** — エージェントの SOUL.md 自省ファイルを閲覧
- **スキル管理** — エージェントへのスキル追加・削除
- **リセット / 強制終了** — エージェントの状態リセットまたは実行中プロセスの強制終了

### 👥 チーム管理
エージェントをコラボレーションチームに編成：
- **チーム作成** — チーム名、リーダーエージェント、メンバーリストを設定
- **メンバー管理** — ドラッグ＆ドロップでの並べ替え、メンバーの追加・削除
- **プロジェクト紐付け** — チームを特定のプロジェクトディレクトリに紐付け

### 📬 メッセージキュー監視
完全なキュー可観測性：
- **キュー状態** — リアルタイム Pending/Processing/Completed/Dead カウント
- **デッドレター管理** — 失敗メッセージの表示、ワンクリックリトライまたは削除
- **Processing 復旧** — スタックしたメッセージを Pending 状態に復旧
- **待機メッセージ** — 処理待ちメッセージの詳細を表示

### 🧩 スキル管理
集中型スキル管理：
- **スキル定義 CRUD** — スキル定義の作成、編集、削除
- **エージェントマウント** — 各種エージェントにオンデマンドでスキルを割り当て
- **内蔵スキルインポート** — ファイルシステムから内蔵スキルをワンクリックインポート
- **CLI グローバルスキル** — 各 CLI にインストール済みのグローバルスキルをスキャン

### 📂 プロジェクト管理
マルチプロジェクトワークスペース：
- **プロジェクト一覧** — 複数プロジェクトの作成と管理
- **ディレクトリ紐付け** — プロジェクトをローカルコードディレクトリに紐付け
- **プロジェクトレベルメモリ** — プロジェクト単位でエージェントメモリを分離

### ⚙️ 設定
グローバルシステム設定：
- **プロバイダー切替** — デフォルト AI プロバイダーとモデル設定
- **環境変数** — API キー等の機密設定
- **圧縮閾値** — コンテキスト圧縮がトリガーされる文字数
- **タイムアウト設定** — エージェント呼び出しのタイムアウト時間

### 📋 補助機能
- **ログ表示** — キューログ、エラーログ、デバッグログ
- **モニター** — システム状態（OS、メモリ、Goroutine）
- **デッドレター** — デッドレターメッセージの詳細情報とリトライ操作
- **会話履歴** — 過去の会話のブラウジング

---

## 🚀 はじめに

### 前提条件

- **Node.js** 20+
- **npm** 10+
- 稼働中の [QueenBee バックエンド](https://github.com/heyangguang/queenbee)（デフォルト `localhost:9876`）

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/heyangguang/queenbee-ui.git
cd queenbee-ui

# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてアプリケーションを使用できます。

### 環境設定

`.env.local` を作成：

```env
# QueenBee バックエンド URL
NEXT_PUBLIC_API_URL=http://localhost:9876
```

### プロダクションビルド

```bash
npm run build
npm start
```

---

## 🛠 技術スタック

| カテゴリ | 技術 | 用途 |
|:---------|:-----|:-----|
| **フレームワーク** | [Next.js 16](https://nextjs.org/) | App Router, SSR |
| **UI** | [React 19](https://react.dev/) | コンポーネントアーキテクチャ |
| **言語** | [TypeScript 5](https://www.typescriptlang.org/) | 型安全性 |
| **スタイリング** | [Tailwind CSS 4](https://tailwindcss.com/) | アトミック CSS |
| **コンポーネント** | [Radix UI](https://www.radix-ui.com/) | アクセシブルな基盤コンポーネント |
| **アイコン** | [Lucide React](https://lucide.dev/) | アイコンライブラリ |
| **Markdown** | [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) | GFM レンダリング |
| **ドラッグ＆ドロップ** | [@dnd-kit](https://dndkit.com/) | ドラッグ＆ドロップソート |

---

## 📁 プロジェクト構成

```
queenbee-ui/
├── public/assets/            # 静的アセット
├── src/
│   ├── app/                  # 📱 Next.js App Router
│   │   ├── page.tsx          #   Dashboard（リアルタイム統計 + クイックアクセス）
│   │   ├── layout.tsx        #   ルートレイアウト
│   │   ├── globals.css       #   グローバルスタイル + デザイントークン
│   │   ├── chat/             #   💬 エージェントチャットインターフェース
│   │   ├── agents/           #   🤖 エージェント CRUD + プロンプト + ソウル + スキル
│   │   ├── teams/            #   👥 チーム管理
│   │   ├── projects/         #   📂 プロジェクト管理
│   │   ├── skills/           #   🧩 スキル定義管理
│   │   ├── office/           #   🏢 ワークスペース概要
│   │   ├── settings/         #   ⚙️ システム設定
│   │   ├── monitor/          #   📊 システム監視
│   │   ├── logs/             #   📋 ログ表示
│   │   ├── conversations/    #   💭 会話履歴
│   │   └── dead-letters/     #   📮 デッドレターメッセージ
│   ├── components/           # 🧱 再利用可能なコンポーネント
│   │   ├── ui/               #   基盤 UI コンポーネント (Button, Card, Dialog...)
│   │   ├── chat-view.tsx     #   コアチャットコンポーネント（Markdown + SSE ストリーミング）
│   │   └── sidebar.tsx       #   ナビゲーションサイドバー
│   └── lib/                  # 📚 ユーティリティ
│       ├── hooks.ts          #   usePolling, useSSE カスタムフック
│       └── utils.ts          #   API クライアント関数
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 🧪 開発

```bash
# 開発モード（ホットリロード）
npm run dev

# プロダクションビルド
npm run build

# Lint チェック
npm run lint
```

---

## 🤝 コントリビュート

コントリビューション大歓迎です！

1. リポジトリを **Fork**
2. **ブランチを作成** (`git checkout -b feat/new-feature`)
3. **コミット** (`git commit -m 'feat: add new feature'`)
4. **プッシュ** (`git push origin feat/new-feature`)
5. **Pull Request を作成**

---

## 📄 ライセンス

**Apache License 2.0** — 詳細は [LICENSE](LICENSE) を参照してください。

---

## 👤 著者

<table>
<tr>
<td align="center">
<a href="https://github.com/heyangguang">
<img src="https://github.com/heyangguang.png" width="100px;" alt="Kuber" /><br />
<sub><b>Kuber</b></sub>
</a><br />
<a href="mailto:heyangev@gmail.com">📧 heyangev@gmail.com</a>
</td>
</tr>
</table>

---

## 🔗 関連プロジェクト

| プロジェクト | 説明 |
|:------------|:-----|
| [queenbee](https://github.com/heyangguang/queenbee) | 🐝 Go バックエンドエンジン — メッセージキュー + エージェントスケジューリング |
| [queenbee-ui](https://github.com/heyangguang/queenbee-ui) | 🖥 本リポジトリ — Web 管理インターフェース |

---

<div align="center">

**Built with 🐝 by the QueenBee Community**

[⭐ GitHub でスターして応援](https://github.com/heyangguang/queenbee-ui) — あなたのサポートが私たちの原動力です！

</div>
