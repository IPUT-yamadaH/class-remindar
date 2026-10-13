# Class Reminder

**Version 1.0.0**

Google Calendarの授業予定をもとに、授業開始の約10分前にSlackの自分宛てDMで出席ページを知らせるGoogle Apps Scriptです。

## できること

- 曜日ごとの時間割から、指定期間のGoogle Calendar予定を作成
- 休講日や長期休暇など、指定日の予定作成を除外
- 同じ設定で再実行しても、作成済みの予定を重複登録しない
- 科目ごとに異なる出席ページURLを登録
- 授業開始前にSlack DMを送信
- Slack接続確認用のテストDMを送信

## 仕組み

```text
設定した時間割 ──> Google Calendar ──> Apps Scriptの定期確認 ──> Slack DM
                                           └─ 科目に対応する出席URL
```

## 用意するもの

- GoogleアカウントとGoogle Apps Script
- 予定を書き込むGoogle Calendar
- Slackワークスペースで作成・インストールしたSlack App
- Slack Appに付与したBot Token Scopes: `chat:write`、`im:write`

## 導入

1. GitHubからこのリポジトリをダウンロードするか、`Code.gs` と `appsscript.json` をGoogle Apps Scriptプロジェクトにコピーします。
2. Apps Scriptのプロジェクト設定でタイムゾーンを `Asia/Tokyo` にします。別の地域で使う場合は、`Code.gs` とマニフェストのタイムゾーンも合わせて変更してください。
3. `Code.gs` の `CONFIG`、`PERIOD_TIMES`、`WEEKLY_LESSONS`、`ATTENDANCE_URLS` を自分の予定に合わせます。
4. Apps Scriptの「プロジェクトの設定」→「スクリプト プロパティ」に次の2つを登録します。

   | プロパティ | 値 |
   | --- | --- |
   | `SLACK_BOT_TOKEN` | Slack AppのBot User OAuth Token (`xoxb-...`) |
   | `SLACK_USER_ID` | 通知を受け取るSlackメンバーID (`U...` または `W...`) |

5. `createClassEvents()` を実行し、Google Calendarへのアクセスを許可します。
6. `sendTestSlackDm()` を実行し、SlackにテストDMが届くことを確認します。外部リクエストの許可を求められた場合は許可します。
7. `installReminderTrigger()` を実行し、定期実行を許可します。

## Slack Appの準備

Slack APIのアプリ管理画面でワークスペース用のAppを作り、「OAuth & Permissions」のBot Token Scopesに `chat:write` と `im:write` を追加してインストールします。スコープを後から追加した場合は、Appを再インストールして新しいトークンを使ってください。Bot TokenはソースコードやGitHubに書かず、Apps Scriptのスクリプトプロパティにだけ保存します。

## 時間割の設定例

```javascript
const WEEKLY_LESSONS = [
  { weekday: 1, subject: 'Example course A', periods: [1, 2] }, // 月曜 1・2限
  { weekday: 3, subject: 'Example course B', periods: [3] }    // 水曜 3限
];
```

曜日は日曜を `0`、月曜を `1`、土曜を `6` とします。連続する時限は1つの予定にまとめます。時限の開始・終了時刻は `PERIOD_TIMES` で設定します。`ATTENDANCE_URLS` の科目名は `WEEKLY_LESSONS` と完全一致させてください。休講日などは `CONFIG.excludedDates` に `YYYY-MM-DD` 形式で追加します。

## GitHub公開前の確認

- `SLACK_BOT_TOKEN`、SlackメンバーID、実際の出席URLをソースに書かない
- 実際の時間割、学校名、PDF、カレンダーの書き出し、個人情報をコミットしない
- スクリーンショットを載せる場合は、個人名・通知内容・URLを隠す
- 公開後にトークンを誤って含めたと気づいた場合は、すぐにSlack側で失効・再発行する

## 制限事項

- SlackやGoogle Driveを監視してPDFを自動取得する機能、PDFのOCR、時間割の自動読み取りはありません。時間割はコードに手入力します。
- 出席ページを開くためのリンクを通知します。出席コードの取得やフォーム送信は行いません。
- Apps Scriptの時間トリガーは実行時刻に多少のずれが生じる場合があります。
- `createClassEvents()` は既存イベントを重複登録しませんが、時間割を変更した場合に作成済みイベントを自動更新しません。

## 権限とプライバシー

このスクリプトは、設定したGoogle CalendarへのアクセスとSlack APIへの外部リクエストを使います。利用前にコードを確認し、所属組織や学校のルールに従ってください。トークンや個人データはGitHubに公開しないでください。

## ライセンス

MIT License。詳細は [LICENSE](LICENSE) を参照してください。
