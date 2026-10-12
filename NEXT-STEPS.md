# shakuyo-contract（借用書・契約書 作成ツール） NEXT-STEPS

最終更新：2026-10-12
公開URL：https://www.reveriel.com/shakuyo-contract/

---

## 1. 現状

### プロダクト
- 純静的サイト（HTML/CSS/JS）。ビルド不要、サーバー送信なしのブラウザ完結型。
- 生成できる書式：借用書（金銭／物品）・売買契約書・覚書・誓約書の5種類。
- 主要機能：金額の大字（漢数字）自動変換、利息制限法の上限チェック、元号変換、A4印刷／PDF保存、日中各語切替。

### ページ構成（改修後）
| ページ | 役割 | JSON-LD |
|---|---|---|
| `index.html` | ツール本体＋SEO本文＋FAQ | WebApplication + FAQPage |
| `kakikata.html` | 借用書の書き方と例文 | Article + FAQPage |
| `risoku.html` | 利息の書き方と利息制限法 | Article + FAQPage |
| `kinsen-shohitai.html` | 借用書と金銭消費貸借契約書の違い | Article + FAQPage |
| `denshi-keiyaku.html` | 電子契約サービス／クラウドサイン・freee契約 | Article + FAQPage |
| `privacy.html` | プライバシーポリシー | （なし／静的文書） |
| `company.html` | 運営者情報 | （なし／静的文書） |

### チェックリスト充足状況
- [x] canonical 絶対URL（全7ページ）
- [x] JSON-LD（ツール＝WebApplication、記事＝Article+FAQPage）
- [x] 共有・拡散（X / LINE / リンクコピー）
- [x] フィードバックFAB（右下固定、print時は非表示）
- [x] Cloudflare beacon（token `6fc01bf3ac5e457ba1bd16b91e5b653e`）
- [x] 相互リンク（index ↔ 各記事 ↔ 記事間）
- [x] 運営者情報／プライバシーポリシー（ASP審査用）

---

## 2. 今回の改修（2026-10-12 実施）

1. **privacy.html 新規**（日本語）：ブラウザ完結＝入力データ非送信を明示、Cloudflare Web Analytics・Google Fonts、アフィリエイト開示、問い合わせ窓口。
2. **company.html 新規**：運営者 GUO XING、所在地は「大阪府大阪市」のみ。電話・番地は非公開、メールは「必要時にフォーム経由で案内」方式。
3. **フッター整備**：index ＋ 既存3記事の全ページに privacy／company リンクを追加。
4. **denshi-keiyaku.html 新規**（約2,600字）：電子契約の仕組み、電子署名法3条、収入印紙が不要になる理由、クラウドサイン vs freee契約の比較表、締結5ステップ、注意点、FAQ4件。ホームCTAを4箇所配置（上部ボックス／中間／下部ボックス前／フッター前）。
5. **【PR】電子契約アフィリエイト枠**：`denshi-keiyaku.html` に `rel="nofollow sponsored noopener"` ＋【PR】バッジ付きのカード2枚（クラウドサイン／freee契約）。**href は A8 の実リンクに差し替え待ち**。
6. **sitemap.xml**：新規3ページを追加（計7 URL）。

---

## 3. 次にやること（優先順）

### P0 — ASP提携・収益化（今すぐ）
1. A8.net で「クラウドサイン」「freee」の提携申請 → 承認後に `denshi-keiyaku.html` の `PLACEHOLDER-*` を実リンクへ差し替え。
2. 差し替え時に `rel="nofollow sponsored noopener"` を維持（ステマ規制・Google ガイドライン対応）。【PR】表記も維持。
3. ASP審査用に privacy／company のURLを提出（`/shakuyo-contract/privacy.html`、`/shakuyo-contract/company.html`）。
4. 承認後、`index.html` の下部にも PR枠を1つ追加するか検討（現在は記事内のみ＝方針どおり「日本語ページ限定」）。

### P1 — コンテンツ層の拡充（SEOロングテール）
- [ ] `kakikata.html` に「借用書 ひな形 無料ダウンロード」系の検索意図を取り込む（PDF出力手順のスクショ解説）。
- [ ] 「借用書 収入印紙 金額 一覧」記事（印紙税額表の要点）— 検索需要大。
- [ ] 「借用書 時効」「借用書 ない 場合 裁判」など、トラブル系クエリの記事。
- [ ] 「電子契約 個人間」の関連記事でクラスタ化（`denshi-keiyaku.html` をハブに）。
- [ ] 各記事末に「次に読む」内部リンクを3本以上に統一（現在 related 3本）。

### P2 — ツール本体の機能拡張
- [ ] 公正証書（強制執行認諾文言つき）のチェックリスト出力。
- [ ] 連帯保証人・担保の入力欄（現在なし）。
- [ ] 分割返済スケジュール表の自動生成。
- [ ] 入力内容の localStorage 保存（任意ON/OFF）— 保存しない設計のため、privacy.html の記載も同時更新が必要。

### P3 — 計測・改善
- [ ] Cloudflare Analytics で `/denshi-keiyaku.html` の流入と PR枠クリックを比較。
- [ ] フィードバックフォーム経由の要望を月次でレビュー。
- [ ] Search Console に sitemap 再送信、`denshi-keiyaku.html` のインデックス確認。

---

## 4. 運用ルール（変更時に守ること）
- canonical は必ず絶対URL。新規ページ追加時は sitemap.xml と index の「書き方ガイド」一覧＋記事間 related を同時更新。
- 法務表記は「運営者：GUO XING」「所在地：大阪府大阪市」のみ。電話・番地は掲載しない。メールは必要時に個別案内。
- アフィリエイトは日本語ページ限定・【PR】明示・`rel="nofollow sponsored"`。
- 免責文（参考テンプレートであり法的助言ではない）は全記事に残す。
- デプロイは未実施。反映は別途リリース作業で行う。
