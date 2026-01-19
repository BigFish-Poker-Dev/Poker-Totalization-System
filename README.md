# Poker Totalization System

ポーカーの戦績、グループ、収支を管理するためのWebアプリケーションです。
プレイヤーは各グループに参加し、日々のポーカーセッションの記録（バイイン、終了時のスタックなど）をつけることができます。管理者はグループごとの設定やメンバー管理を行うことができます。

## 機能概要

- **グループ管理**:
  - グループの作成と設定（ステークス、ランキング設定など）
  - パスワードによるプレイヤーおよび管理者の参加
- **戦績記録**:
  - セッションごとのバイイン、終了スタックの入力
  - 収支（BB表記）の自動計算
  - 履歴の編集と監査ログ
- **ロールベースのアクセス制御**:
  - **プレイヤー**: 自分の戦績の記録・閲覧、グループランキングの閲覧
  - **管理者**: グループ設定の変更、メンバー管理

## 技術スタック

- **Frontend**: [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Backend / BaaS**: [Firebase](https://firebase.google.com/)
  - Authentication (Google Auth etc.)
  - Firestore (Database)
  - Cloud Functions (Backend logic)
- **Routing**: [React Router](https://reactrouter.com/)

## 環境構築

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd Poker-Totalization-System
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

プロジェクトルートに `.env` ファイル（または `.env.local`）を作成し、Firebaseの設定を追加してください。

```env
VITE_FB_API_KEY=your_api_key
VITE_FB_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FB_PROJECT_ID=your_project_id
VITE_FB_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FB_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FB_APP_ID=your_app_id
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` (またはコンソールに表示されるURL) にアクセスしてください。

## ディレクトリ構造

- `src/pages`: アプリケーションの主要なページコンポーネント (Login, Dashboard, GroupPage)
- `src/components`: 再利用可能なUIコンポーネント
- `src/types`: TypeScriptの型定義 (Firestoreのドキュメント構造など)
- `src/hooks`: カスタムReactフック
- `src/lib`: ライブラリの設定 (firebase.tsなど)
- `functions`: Firebase Cloud Functionsのコード

## スクリプト

- `npm run dev`: 開発サーバーを起動
- `npm run build`: プロダクションビルドを作成
- `npm run preview`: ビルドしたアプリをローカルでプレビュー
