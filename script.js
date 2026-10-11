/* =========================================================
   借用書・契約書 作成ツール — script.js
   依存ゼロ・純粋なフロントエンドのみ。
   入力内容は一切外部へ送信しません（すべてブラウザ内で処理）。
   ========================================================= */

(function () {
  'use strict';

  /* ---------------------------------------------------------
     1. 基本ユーティリティ
     --------------------------------------------------------- */

  function $(id) { return document.getElementById(id); }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* 数字だけを取り出して整数化（"1,234,567" → 1234567） */
  function num(v) {
    var s = String(v == null ? '' : v).replace(/[^\d]/g, '');
    if (!s) return 0;
    var n = parseInt(s, 10);
    return isNaN(n) ? 0 : n;
  }

  /* 小数を許可（利率など） */
  function dec(v) {
    var s = String(v == null ? '' : v).replace(/[^\d.]/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function yen(n) {
    return '￥' + Number(n || 0).toLocaleString('ja-JP') + '-';
  }

  function pct(n) {
    var r = Math.round(Number(n || 0) * 10) / 10;
    return String(r) + '％';
  }

  /* ---------------------------------------------------------
     2. 金額の大字（漢数字）
     ---------------------------------------------------------
     加筆による改ざんが容易な「一・二・三」および「壱拾・弐拾・参拾」には
     大字（壱・弐・参・拾）を用い、それ以外は読みやすい常用の漢数字で表記する。
       例: 1234567 → 壱百弐拾参万四千五百六十七
           1000000 → 壱百万
           108     → 壱百八
           60      → 六十
     --------------------------------------------------------- */

  var DAJI_DIGIT = ['', '壱', '弐', '参', '四', '五', '六', '七', '八', '九'];

  /* 十の位の従属字。係数が一・二・三のときだけ大字「拾」を使う。 */
  function tenUnit(digit) { return digit <= 3 ? '拾' : '十'; }

  var DAJI_UNIT = ['', null, '百', '千'];
  var DAJI_BIG = ['', '万', '億', '兆'];

  function kanjiNumber(n) {
    var x = Math.floor(Math.abs(Number(n) || 0));
    if (x === 0) return '零';

    var out = '';
    var groupIndex = 0;

    while (x > 0) {
      var group = x % 10000;
      if (group > 0) {
        var groupStr = '';
        var g = group;
        var unitIndex = 0;
        while (g > 0) {
          var digit = g % 10;
          if (digit > 0) {
            var unit = (unitIndex === 1) ? tenUnit(digit) : DAJI_UNIT[unitIndex];
            groupStr = DAJI_DIGIT[digit] + unit + groupStr;
          }
          g = Math.floor(g / 10);
          unitIndex += 1;
        }
        out = groupStr + DAJI_BIG[groupIndex] + out;
      }
      x = Math.floor(x / 10000);
      groupIndex += 1;
    }

    return out;
  }

  /* 「金壱百弐拾参万四千五百六十七円」 */
  function dajiAmount(n) {
    return '金' + kanjiNumber(num(n)) + '円';
  }

  /* ---------------------------------------------------------
     3. 日付（西暦 ⇄ 令和）
     --------------------------------------------------------- */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function shiftISO(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* ISO 文字列 → 「令和8年10月12日」／「2026年10月12日」 */
  function fmtDate(iso, wareki) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return '<span class="ph">（未入力）</span>';
    var y = parseInt(m[1], 10);
    var mo = parseInt(m[2], 10);
    var d = parseInt(m[3], 10);
    var body = mo + '月' + d + '日';
    if (wareki) {
      var r = y - 2018; /* 令和1年 = 2019年 */
      if (r > 0) return '令和' + (r === 1 ? '元' : String(r)) + '年' + body;
    }
    return y + '年' + body;
  }

  /* ---------------------------------------------------------
     4. 利息制限法（利息の上限）
     ---------------------------------------------------------
     元本10万円未満: 年20％ ／ 10万円以上100万円未満: 年18％ ／
     100万円以上: 年15％。遅延損害金は約定利率の1.46倍が上限。
     --------------------------------------------------------- */

  function rateLimit(principal) {
    var p = num(principal);
    if (p < 100000) return 20;
    if (p < 1000000) return 18;
    return 15;
  }

  function delayLimit(principal, interestRate) {
    var cap = rateLimit(principal) * 1.46;
    var byAgreement = dec(interestRate) * 1.46;
    var v = byAgreement > 0 ? byAgreement : cap;
    if (v > cap) v = cap;
    return Math.round(v * 10) / 10;
  }

  /* ---------------------------------------------------------
     5. 画面表示言語（中文 ⇄ 日本語）— 画面のみ。帳票は常に日本語。
     --------------------------------------------------------- */

  var I18N = {
    brandName:    { zh: '借用书・合同 生成工具', ja: '借用書・契約書 作成ツール' },
    tagline:      { zh: '免费・无需注册・浏览器内完成', ja: '無料・登録不要・ブラウザだけで完結' },
    btnPrint:     { zh: '打印 / 保存 PDF', ja: '印刷 / PDF保存' },
    btnSample:    { zh: '填入示例', ja: '記入例を入れる' },
    btnReset:     { zh: '清空重填', ja: 'リセット' },
    btnLang:      { zh: '日本語', ja: '中文' },

    formTitle:    { zh: '选择书式，填写项目即可', ja: '書式を選んで、項目を埋めるだけ' },
    formHint:     { zh: '左侧填写，右侧实时预览。书式可用下面的标签切换。',
                    ja: '左側に入力すると、右側のプレビューにすぐ反映されます。書式は下のタブで切り替えられます。' },
    previewTitle: { zh: '预览（A4）', ja: 'プレビュー（A4）' },
    badgeTpl:     { zh: '参考模板', ja: '参考テンプレート' },

    legalNote:    { zh: '本工具生成的是格式规范的参考模板，不构成法律意见，也不保证内容的合法性。大额借贷或重要合同，请务必咨询弁護士・司法書士・行政書士等专业人士。',
                    ja: '本ツールが生成するのは書式を整えた参考テンプレートです。法律上の助言ではなく、内容の法的な有効性を保証するものではありません。高額な貸借や重要な契約は、弁護士・司法書士・行政書士などの専門家にご相談ください。' },
    privacy:      { zh: '输入内容不会发送到服务器，全部只在你的浏览器内处理。',
                    ja: '入力内容はサーバーに送信されません。すべてお使いのブラウザ内だけで処理されます。' },

    shareTitle:   { zh: '分享这个工具', ja: 'このツールをシェアする' },
    shareX:       { zh: '分享到 X', ja: 'X で共有' },
    shareLine:    { zh: '分享到 LINE', ja: 'LINE で共有' },
    shareCopy:    { zh: '复制链接', ja: 'リンクをコピー' },
    shareCopied:  { zh: '已复制', ja: 'コピーしました' },

    footerText:   { zh: '借用书・合同 生成工具 — 免费生成借用書・売買契約書・覚書・誓約書的模板',
                    ja: '借用書・契約書 作成ツール — 借用書・売買契約書・覚書・誓約書をつくる無料テンプレート' },

    /* フィールドセットの見出し */
    legendCommon:    { zh: '基本信息', ja: '基本情報' },
    legendAmount:    { zh: '金额（自动生成大字）', ja: '金額（大字を自動生成）' },
    legendTerms:     { zh: '约定条件', ja: '約定条件' },
    legendParties:   { zh: '当事人', ja: '当事者' },
    legendPartiesAB: { zh: '当事人', ja: '当事者' },
    legendDoc:       { zh: '文书内容', ja: '文書の内容' },

    dajiLabel:    { zh: '大字（文书中显示的写法）', ja: '大字（文書に記載される表記）' },
    optTag:       { zh: '选填', ja: '任意' },

    lblDocDate:   { zh: '作成日期', ja: '作成日' },
    lblUseWareki: { zh: '日期用年号（令和）表示', ja: '日付を元号（令和）で表記する' },

    lblAmount:    { zh: '金额（日元）', ja: '金額（円）' },
    lblPrice:     { zh: '买卖价款（日元）', ja: '売買代金（円）' },
    lblRepayDeadline: { zh: '还款期限', ja: '返済期限' },
    lblInterest:  { zh: '利息（年率％）', ja: '利息（年率％）' },
    lblDelay:     { zh: '迟延损害金（年率％）', ja: '遅延損害金（年率％）' },
    lblRepayMethod: { zh: '还款方法', ja: '返済方法' },

    lblBorrower:  { zh: '借主（借款人）', ja: '借主（借りる人）' },
    lblLender:    { zh: '貸主（出借人）', ja: '貸主（貸す人）' },
    lblSeller:    { zh: '売主（卖方）', ja: '売主（売る人）' },
    lblBuyer:     { zh: '買主（买方）', ja: '買主（買う人）' },
    lblPartyA:    { zh: '甲方', ja: '甲' },
    lblPartyB:    { zh: '乙方', ja: '乙' },
    lblPledger:   { zh: '誓約者（承诺人）', ja: '誓約者' },
    lblName:      { zh: '姓名', ja: '氏名' },
    lblAddr:      { zh: '住址', ja: '住所' },
    lblTel:       { zh: '电话', ja: '電話番号' },

    lblItemName:  { zh: '品名', ja: '品名' },
    lblItemQty:   { zh: '数量', ja: '数量' },
    lblItemDetail: { zh: '详细・特征（型号・颜色・编号等）', ja: '詳細（型番・色・番号など）' },
    lblItemValue: { zh: '时价（参考）', ja: '時価（参考）' },
    lblReturnDeadline: { zh: '返还期限', ja: '返却期限' },
    lblReturnPlace: { zh: '返还地点', ja: '返却場所' },

    lblGoodsName: { zh: '目的物名称', ja: '目的物の名称' },
    lblGoodsDetail: { zh: '目的物详细（型号・年式・里程・状态等）', ja: '目的物の詳細（型番・年式・走行距離・状態など）' },
    lblDeliverDate: { zh: '交付日', ja: '引渡日' },
    lblDeliverPlace: { zh: '交付地点', ja: '引渡場所' },
    lblPayment:   { zh: '付款方法', ja: '代金の支払方法' },
    lblWarranty:  { zh: '瑕疵担保责任', ja: '瑕疵担保責任' },
    lblWarrantyDays: { zh: '发现瑕疵的通知期间（天）', ja: '瑕疵の通知期間（日）' },

    lblMemoSubject: { zh: '事由・件名', ja: '件名・表題' },
    lblMemoItems: { zh: '确认事项（每行一条）', ja: '確認事項（1行に1項目）' },
    lblPledgeTo:  { zh: '提交对象（对方）', ja: '提出先（宛先）' },
    lblPledgeItems: { zh: '誓約事项（每行一条）', ja: '誓約事項（1行に1項目）' },

    rateHintNone:      { zh: '输入本金后，会显示利息上限（利息制限法）。', ja: '元本を入力すると、利息の上限（利息制限法）を表示します。' },
    rateHintOk:        { zh: '利息上限：年%L％（本金%P）。', ja: '利息の上限：年%L％（元本%P）。' },
    rateHintOver:      { zh: '超过利息上限（年%L％）。超过部分无效，请修改。', ja: '利息の上限（年%L％）を超えています。超過部分は無効となるため、修正してください。' },
    rateHintDelay:     { zh: '迟延损害金上限：年%D％（约定利率的1.46倍）。', ja: '遅延損害金の上限：年%D％（約定利率の1.46倍）。' },
    rateHintDelayOver: { zh: '迟延损害金超过上限（年%D％），请修改。', ja: '遅延損害金が上限（年%D％）を超えています。修正してください。' }
  };

  var lang = 'ja';

  function tr(key) {
    var e = I18N[key];
    if (!e) return key;
    return e[lang] || e.ja;
  }

  /* data-i18n / data-i18n-aria を一括適用 */
  function applyI18n(next) {
    lang = next;
    document.documentElement.lang = (lang === 'zh') ? 'zh-CN' : 'ja';

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var e = I18N[el.getAttribute('data-i18n')];
      if (e) el.textContent = e[lang] || e.ja;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var e = I18N[el.getAttribute('data-i18n-aria')];
      if (e) el.setAttribute('aria-label', e[lang] || e.ja);
    });

    var b = $('langBtn');
    if (b) b.textContent = tr('btnLang');
  }

  /* ---------------------------------------------------------
     6. フィールド定義ヘルパ（ラベルは常に二言語で保持する）
     --------------------------------------------------------- */

  function opt(ja, zh) { return { ja: ja, zh: zh }; }

  function L(key) {
    var e = I18N[key] || { ja: key, zh: key };
    return opt(e.ja, e.zh);
  }

  /* 「借主：氏名」のような連結ラベル */
  function LJ(a, sep, b) {
    var x = L(a), y = L(b);
    return opt(x.ja + sep + y.ja, x.zh + sep + y.zh);
  }

  function T(id, label, phJa, phZh, extra) {
    var o = { id: id, type: 'text', label: label, ph: opt(phJa || '', phZh || '') };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  function D(id, label) { return { id: id, type: 'date', label: label }; }

  function TA(id, label, phJa, phZh, extra) {
    var o = { id: id, type: 'textarea', label: label, ph: opt(phJa || '', phZh || '') };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  function SEL(id, label, options, extra) {
    var o = { id: id, type: 'select', label: label, options: options };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  function CHK(id, label) { return { id: id, type: 'checkbox', label: label }; }

  /* 当事者の3点セット（氏名・住所・電話） */
  function partyFields(prefix, labelName, labelAddr) {
    return [
      T(prefix + '_name', labelName, '例：山田 太郎', '例：山田 太郎'),
      T(prefix + '_addr', labelAddr, '例：東京都新宿区西新宿2-8-1', '例：東京都新宿区西新宿2-8-1'),
      T(prefix + '_tel', L('lblTel'), '例：090-1234-5678', '例：090-1234-5678', { opt: true })
    ];
  }

  /* ---------------------------------------------------------
     7. 文書レンダリング用ヘルパ
     --------------------------------------------------------- */

  function val(s, ph) {
    var t = (s == null ? '' : String(s)).trim();
    if (t) return esc(t);
    return '<span class="ph">' + esc(ph || '（未入力）') + '</span>';
  }

  function art(no, title, body) {
    return '<li><span class="art-no">' + esc(no) + '</span>' +
           '<span class="art-body"><strong>' + esc(title) + '</strong>　' + body + '</span></li>';
  }

  function itemsList(text) {
    var lines = String(text || '').split(/\r?\n/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
    if (!lines.length) {
      return '<ul class="doc-items"><li><span class="it-no">1.</span>' +
             '<span class="it-body"><span class="ph">（未入力）</span></span></li></ul>';
    }
    var h = '<ul class="doc-items">';
    lines.forEach(function (t, i) {
      h += '<li><span class="it-no">' + (i + 1) + '.</span><span class="it-body">' + esc(t) + '</span></li>';
    });
    return h + '</ul>';
  }

  /* 署名欄（役割 ＋ 住所／氏名＋㊞／電話） */
  function signBlock(role, addr, name, tel) {
    var h = '<div class="sign-row"><span class="sign-role">' + esc(role) + '</span>' +
            '<span class="sign-body">';
    h += '<span class="sign-line">住所：' + val(addr, '（住所）') + '</span>';
    h += '<span class="sign-name">氏名：' + val(name, '（氏名）') + '　㊞</span>';
    if (tel && String(tel).trim()) h += '<span class="sign-line">電話：' + esc(tel) + '</span>';
    return h + '</span></div>';
  }

  function footnote() {
    return '<p class="paper-footnote">※ 本ツールが生成した参考テンプレートです。法律上の助言ではなく、' +
           '内容の法的な有効性を保証するものではありません。金額・日付・当事者情報をよく確認し、' +
           '必要に応じて弁護士・司法書士・行政書士などの専門家にご相談ください。</p>';
  }

  function dateLine(v) {
    return '<div class="doc-date">' + fmtDate(v.docDate, !!v.useWareki) + '</div>';
  }

  /* 金額（大字＋数字）。a > 0 のときだけ大字を出す */
  function amountBlock(v) {
    var a = num(v.amount);
    var h = '<p class="doc-amount">金<span class="amt-daji">' +
            (a > 0 ? kanjiNumber(a) : '<span class="ph">（金額未入力）</span>') +
            '</span>円也</p>';
    h += '<p class="doc-amount-sub">' + (a > 0 ? esc(yen(a)) : '<span class="ph">—</span>') + '</p>';
    return h;
  }

  function amountInline(v) {
    var a = num(v.amount);
    return '金' + (a > 0 ? kanjiNumber(a) : '<span class="ph">（金額未入力）</span>') +
           '円也（' + (a > 0 ? esc(yen(a)) : '<span class="ph">—</span>') + '）';
  }

  function warrantyText(v) {
    if (v.warranty === 'full') {
      var d = num(v.warrantyDays) || 14;
      return '甲は、引渡しの日から' + d + '日以内に乙が通知した本件目的物の瑕疵について、瑕疵担保責任を負う。' +
             'ただし、乙の責めに帰すべき事由により生じた瑕疵、および乙が引渡しの時に現状を確認して承諾した瑕疵については、この限りでない。';
    }
    return '乙は、本件目的物を現状有姿で引き受けるものとし、引渡し後に発見された瑕疵について、' +
           '甲に対し瑕疵担保責任を追及しない。ただし、甲が故意または重過失により隠蔽した瑕疵については、この限りでない。';
  }

  /* ---------------------------------------------------------
     8. 書式（テンプレート）定義
     --------------------------------------------------------- */

  var TEMPLATES = {

    /* ---------------- ① 借用書（金銭） ---------------- */
    'loan-money': {
      tabJa: '借用書（金銭）',
      tabZh: '借用书（金钱）',
      groups: [
        {
          legend: 'legendAmount',
          fields: [
            T('amount', L('lblAmount'), '例：1000000', '例：1000000'),
            { id: 'dajiBox', type: 'daji' }
          ]
        },
        {
          legend: 'legendTerms',
          fields: [
            D('repayDeadline', L('lblRepayDeadline')),
            T('repayMethod', L('lblRepayMethod'), '例：毎月末日までに金5万円ずつ', '例：每月末偿还5万日元', { full: true }),
            T('interestRate', L('lblInterest'), '例：15', '例：15'),
            T('delayRate', L('lblDelay'), '例：20', '例：20'),
            { id: 'rateHint', type: 'hint' }
          ]
        },
        {
          legend: 'legendParties',
          fields: partyFields('borrower', LJ('lblBorrower', '：', 'lblName'), LJ('lblBorrower', '：', 'lblAddr'))
            .concat(partyFields('lender', LJ('lblLender', '：', 'lblName'), LJ('lblLender', '：', 'lblAddr')))
        },
        {
          legend: 'legendCommon',
          fields: [
            D('docDate', L('lblDocDate')),
            CHK('useWareki', L('lblUseWareki'))
          ]
        }
      ],
      sample: {
        amount: '1000000',
        repayDeadline: shiftISO(365),
        repayMethod: '毎月末日までに金5万円ずつ、20回に分割して支払う。',
        interestRate: '15',
        delayRate: '20',
        borrower_name: '田中 健太',
        borrower_addr: '神奈川県横浜市中区山下町1-1',
        borrower_tel: '090-1111-2222',
        lender_name: '佐藤 一郎',
        lender_addr: '東京都新宿区西新宿2-8-1',
        lender_tel: '080-3333-4444',
        docDate: todayISO(),
        useWareki: true
      },
      render: function (v) {
        var w = !!v.useWareki;
        var a = num(v.amount);
        var h = '<h1 class="doc-title">借用書</h1>';
        h += amountBlock(v);
        h += '<p class="doc-lead">上記金額を、下記の約定により借用いたしました。</p>';

        h += '<ol class="doc-articles">';
        h += art('第1条', '（返済期限）',
          v.repayDeadline ? fmtDate(v.repayDeadline, w) + '限り' : '<span class="ph">（別途協議のうえ定める）</span>');
        h += art('第2条', '（利息）',
          dec(v.interestRate) > 0
            ? '本件消費貸借の利息は、年' + pct(v.interestRate) + 'とする。'
            : '本件消費貸借については、利息を付さないものとする。');
        h += art('第3条', '（遅延損害金）',
          dec(v.delayRate) > 0
            ? '借主が返済期日までに返済しない場合、借主は貸主に対し、返済期日の翌日から完済に至るまで、' +
              '未返済元金に対し年' + pct(v.delayRate) + 'の割合による遅延損害金を支払う。'
            : '借主が返済期日までに返済しない場合の遅延損害金は、別途協議のうえ定める。');
        h += art('第4条', '（返済方法）', val(v.repayMethod, '（別途協議のうえ定める）'));
        h += art('第5条', '（協議）', '本借用書に定めのない事項は、貸主・借主が誠意をもって協議のうえ定める。');
        h += '</ol>';

        h += '<p class="doc-close">上記の債務を履行することを約束いたします。</p>';
        h += dateLine(v);

        h += '<div class="doc-sign">';
        h += signBlock('借主', v.borrower_addr, v.borrower_name, v.borrower_tel);
        h += signBlock('貸主', v.lender_addr, v.lender_name, v.lender_tel);
        h += '</div>';

        h += '<p class="doc-note">※ 本借用書は2通作成し、貸主・借主が各自1通を保有します。' +
             '金額は改ざん防止のため、大字（' + (a > 0 ? esc(kanjiNumber(a)) : '—') + '）と数字を併記しています。' +
             'なお、金銭の貸借に関する書面は収入印紙が必要となる場合があります。</p>';
        h += footnote();
        return h;
      }
    },

    /* ---------------- ② 借用書（物品） ---------------- */
    'loan-item': {
      tabJa: '借用書（物品）',
      tabZh: '借用书（物品）',
      groups: [
        {
          legend: 'legendDoc',
          fields: [
            T('itemName', L('lblItemName'), '例：ノートパソコン', '例：笔记本电脑'),
            T('itemQty', L('lblItemQty'), '例：1台', '例：1台'),
            T('itemDetail', L('lblItemDetail'), '例：〇〇製 型番XXXX、シリアルNo.12345', '例：〇〇制 型号XXXX、序列号12345', { full: true }),
            T('itemValue', L('lblItemValue'), '例：120000', '例：120000', { opt: true })
          ]
        },
        {
          legend: 'legendTerms',
          fields: [
            D('returnDeadline', L('lblReturnDeadline')),
            T('returnPlace', L('lblReturnPlace'), '例：貸主自宅（東京都新宿区西新宿2-8-1）', '例：貸主住所', { full: true })
          ]
        },
        {
          legend: 'legendParties',
          fields: partyFields('borrower', LJ('lblBorrower', '：', 'lblName'), LJ('lblBorrower', '：', 'lblAddr'))
            .concat(partyFields('lender', LJ('lblLender', '：', 'lblName'), LJ('lblLender', '：', 'lblAddr')))
        },
        {
          legend: 'legendCommon',
          fields: [
            D('docDate', L('lblDocDate')),
            CHK('useWareki', L('lblUseWareki'))
          ]
        }
      ],
      sample: {
        itemName: 'ノートパソコン',
        itemQty: '1台',
        itemDetail: '〇〇製 型番 XXXX-15、シリアルNo. 1234567890。付属品（ACアダプタ・専用ケース）を含む。',
        itemValue: '120000',
        returnDeadline: shiftISO(90),
        returnPlace: '貸主自宅（東京都新宿区西新宿2-8-1）',
        borrower_name: '田中 健太',
        borrower_addr: '神奈川県横浜市中区山下町1-1',
        borrower_tel: '090-1111-2222',
        lender_name: '佐藤 一郎',
        lender_addr: '東京都新宿区西新宿2-8-1',
        lender_tel: '080-3333-4444',
        docDate: todayISO(),
        useWareki: true
      },
      render: function (v) {
        var w = !!v.useWareki;
        var iv = num(v.itemValue);
        var h = '<h1 class="doc-title">借用書</h1>';
        h += '<p class="doc-subtitle">（物品の借用）</p>';
        h += '<p class="doc-lead">下記の物品を借用いたしました。</p>';
        h += '<p class="doc-ref">記</p>';
        h += '<ul class="doc-items">';
        h += '<li><span class="it-no">1.</span><span class="it-body">品名　' + val(v.itemName, '（品名）') + '</span></li>';
        h += '<li><span class="it-no">2.</span><span class="it-body">数量　' + val(v.itemQty, '（数量）') + '</span></li>';
        h += '<li><span class="it-no">3.</span><span class="it-body">詳細　' + val(v.itemDetail, '（型番・状態など）') + '</span></li>';
        h += '<li><span class="it-no">4.</span><span class="it-body">時価　' +
             (iv > 0 ? esc('金' + kanjiNumber(iv) + '円也（' + yen(iv) + '）') : '<span class="ph">（参考値）</span>') +
             '</span></li>';
        h += '<li><span class="it-no">5.</span><span class="it-body">返却期限　' + fmtDate(v.returnDeadline, w) + '</span></li>';
        h += '<li><span class="it-no">6.</span><span class="it-body">返却場所　' + val(v.returnPlace, '（返却場所）') + '</span></li>';
        h += '</ul>';
        h += '<p class="doc-ref">以上</p>';
        h += '<p class="doc-close">上記の物品を、善良な管理者の注意をもって使用・保管し、返却期限までに原状に復して返却することを約束いたします。' +
             '万一、滅失または毀損したときは、時価相当額を賠償いたします。</p>';
        h += dateLine(v);
        h += '<div class="doc-sign">';
        h += signBlock('借主', v.borrower_addr, v.borrower_name, v.borrower_tel);
        h += signBlock('貸主', v.lender_addr, v.lender_name, v.lender_tel);
        h += '</div>';
        h += '<p class="doc-note">※ 本借用書は2通作成し、貸主・借主が各自1通を保有します。</p>';
        h += footnote();
        return h;
      }
    },

    /* ---------------- ③ 売買契約書 ---------------- */
    'sales': {
      tabJa: '売買契約書',
      tabZh: '买卖合同',
      groups: [
        {
          legend: 'legendDoc',
          fields: [
            T('goodsName', L('lblGoodsName'), '例：中古自動車', '例：二手车'),
            T('goodsDetail', L('lblGoodsDetail'), '例：〇〇製 年式2020年、走行距離45,000km、車台番号XXXX-1234567', '例：〇〇制 2020年款、里程45000km、车架号XXXX', { full: true })
          ]
        },
        {
          legend: 'legendAmount',
          fields: [
            T('amount', L('lblPrice'), '例：350000', '例：350000'),
            { id: 'dajiBox', type: 'daji' }
          ]
        },
        {
          legend: 'legendTerms',
          fields: [
            T('paymentMethod', L('lblPayment'), '例：引渡しと同時に、買主が売主に現金で一括支払う。', '例：交付同时一次性现金付清', { full: true }),
            D('deliverDate', L('lblDeliverDate')),
            T('deliverPlace', L('lblDeliverPlace'), '例：売主指定の場所（東京都新宿区西新宿2-8-1）', '例：卖方指定地点', { full: true }),
            SEL('warranty', L('lblWarranty'), [
              { v: 'none', ja: '現状有姿（ノークレーム・ノーリターン）', zh: '现状交付（不承担瑕疵责任）' },
              { v: 'full', ja: '瑕疵担保責任を負う', zh: '承担瑕疵担保责任' }
            ]),
            T('warrantyDays', L('lblWarrantyDays'), '例：14', '例：14', { showIf: 'warranty=full', opt: true })
          ]
        },
        {
          legend: 'legendPartiesAB',
          fields: partyFields('seller', LJ('lblSeller', '：', 'lblName'), LJ('lblSeller', '：', 'lblAddr'))
            .concat(partyFields('buyer', LJ('lblBuyer', '：', 'lblName'), LJ('lblBuyer', '：', 'lblAddr')))
        },
        {
          legend: 'legendCommon',
          fields: [
            D('docDate', L('lblDocDate')),
            CHK('useWareki', L('lblUseWareki'))
          ]
        }
      ],
      sample: {
        goodsName: '中古自動車',
        goodsDetail: '〇〇製 年式2020年、走行距離45,000km、車台番号 XXXX-1234567。別途口頭で確認した箇所に小傷・へこみあり。',
        amount: '350000',
        paymentMethod: '引渡しと同時に、買主が売主に対し現金で一括支払うものとする。',
        deliverDate: shiftISO(14),
        deliverPlace: '売主指定の場所（東京都新宿区西新宿2-8-1）',
        warranty: 'none',
        warrantyDays: '14',
        seller_name: '佐藤 一郎',
        seller_addr: '東京都新宿区西新宿2-8-1',
        seller_tel: '080-3333-4444',
        buyer_name: '田中 健太',
        buyer_addr: '神奈川県横浜市中区山下町1-1',
        buyer_tel: '090-1111-2222',
        docDate: todayISO(),
        useWareki: true
      },
      render: function (v) {
        var w = !!v.useWareki;
        var h = '<h1 class="doc-title">売買契約書</h1>';
        h += '<p class="doc-lead">売主　' + val(v.seller_name, '（売主氏名）') +
             '（以下「甲」という。）と、買主　' + val(v.buyer_name, '（買主氏名）') +
             '（以下「乙」という。）とは、次のとおり売買契約（以下「本契約」という。）を締結した。</p>';

        h += '<ol class="doc-articles">';
        h += art('第1条', '（目的物）',
          '甲は、下記の目的物（以下「本件目的物」という。）を乙に売り渡し、乙はこれを買い受けた。' +
          '<ul class="doc-list">' +
          '<li>名称　' + val(v.goodsName, '（名称）') + '</li>' +
          '<li>詳細　' + val(v.goodsDetail, '（型番・年式・状態など）') + '</li>' +
          '</ul>');
        h += art('第2条', '（売買代金）', '本件目的物の売買代金は、' + amountInline(v) + 'とする。');
        h += art('第3条', '（代金の支払）', val(v.paymentMethod, '（別途協議のうえ定める）'));
        h += art('第4条', '（引渡し）',
          '甲は、' + fmtDate(v.deliverDate, w) + 'までに、' +
          val(v.deliverPlace, '（別途協議のうえ定める場所）') + 'において、本件目的物を乙に引き渡す。' +
          '引渡し後の本件目的物の管理・維持に要する費用は、乙の負担とする。');
        h += art('第5条', '（瑕疵担保責任）', warrantyText(v));
        h += art('第6条', '（協議）', '本契約に定めのない事項は、甲乙が誠意をもって協議のうえ定める。');
        h += '</ol>';

        h += '<p class="doc-close">本契約の成立を証するため、本書2通を作成し、甲・乙が各自1通を保有する。</p>';
        h += dateLine(v);
        h += '<div class="doc-sign">';
        h += signBlock('甲（売主）', v.seller_addr, v.seller_name, v.seller_tel);
        h += signBlock('乙（買主）', v.buyer_addr, v.buyer_name, v.buyer_tel);
        h += '</div>';
        h += footnote();
        return h;
      }
    },

    /* ---------------- ④ 覚書 ---------------- */
    'memo': {
      tabJa: '覚書',
      tabZh: '备忘录',
      groups: [
        {
          legend: 'legendDoc',
          fields: [
            T('subject', L('lblMemoSubject'), '例：〇〇に関する確認事項', '例：关于〇〇的确认事项', { full: true, opt: true }),
            TA('items', L('lblMemoItems'),
               '例：\n甲は乙に対し、2026年10月31日までに金100,000円を支払う。\n上記の支払いをもって、本件に関する一切の債権債務は消滅する。',
               '例：\n甲于2026年10月31日前向乙支付10万日元。\n上述支付完成后，本事项的全部债权债务消灭。')
          ]
        },
        {
          legend: 'legendPartiesAB',
          fields: partyFields('partyA', LJ('lblPartyA', '：', 'lblName'), LJ('lblPartyA', '：', 'lblAddr'))
            .concat(partyFields('partyB', LJ('lblPartyB', '：', 'lblName'), LJ('lblPartyB', '：', 'lblAddr')))
        },
        {
          legend: 'legendCommon',
          fields: [
            D('docDate', L('lblDocDate')),
            CHK('useWareki', L('lblUseWareki'))
          ]
        }
      ],
      sample: {
        subject: '貸金の返済に関する確認事項',
        items: '甲は乙に対し、2026年10月31日までに、金100,000円を乙の指定する口座に振り込んで支払う。\n' +
               '乙は、上記の支払いを受けたときは、直ちに甲に対し受領証を交付する。\n' +
               '上記の支払いをもって、甲乙間の本件貸金に関する一切の債権債務は消滅し、相互に何らの請求をしない。',
        partyA_name: '田中 健太',
        partyA_addr: '神奈川県横浜市中区山下町1-1',
        partyA_tel: '090-1111-2222',
        partyB_name: '佐藤 一郎',
        partyB_addr: '東京都新宿区西新宿2-8-1',
        partyB_tel: '080-3333-4444',
        docDate: todayISO(),
        useWareki: true
      },
      render: function (v) {
        var h = '<h1 class="doc-title">覚書</h1>';
        if (String(v.subject || '').trim()) {
          h += '<p class="doc-subtitle">（' + esc(String(v.subject).trim()) + '）</p>';
        }
        h += '<p class="doc-lead">' + val(v.partyA_name, '（甲）') + '（以下「甲」という。）と、' +
             val(v.partyB_name, '（乙）') + '（以下「乙」という。）とは、下記の事項について確認した。</p>';
        h += '<p class="doc-ref">記</p>';
        h += itemsList(v.items);
        h += '<p class="doc-close">本覚書に定めのない事項は、甲乙が誠意をもって協議のうえ決定する。' +
             '本覚書の成立を証するため、本書2通を作成し、甲乙が各自1通を保有する。</p>';
        h += dateLine(v);
        h += '<div class="doc-sign">';
        h += signBlock('甲', v.partyA_addr, v.partyA_name, v.partyA_tel);
        h += signBlock('乙', v.partyB_addr, v.partyB_name, v.partyB_tel);
        h += '</div>';
        h += footnote();
        return h;
      }
    },

    /* ---------------- ⑤ 誓約書 ---------------- */
    'pledge': {
      tabJa: '誓約書',
      tabZh: '承诺书',
      groups: [
        {
          legend: 'legendDoc',
          fields: [
            T('pledgeTo', L('lblPledgeTo'), '例：株式会社〇〇 御中', '例：株式会社〇〇 收', { full: true, opt: true }),
            TA('items', L('lblPledgeItems'),
               '例：\n業務上知り得た秘密情報を、在職中および退職後においても第三者に開示しないこと。\n会社の備品・機密資料を私的に使用または持ち出さないこと。',
               '例：\n对在职期间知悉的商业秘密，在职及离职后均不向第三方披露。\n不将公司物品及机密资料私用或带出。')
          ]
        },
        {
          legend: 'legendParties',
          fields: partyFields('pledger', LJ('lblPledger', '：', 'lblName'), LJ('lblPledger', '：', 'lblAddr'))
        },
        {
          legend: 'legendCommon',
          fields: [
            D('docDate', L('lblDocDate')),
            CHK('useWareki', L('lblUseWareki'))
          ]
        }
      ],
      sample: {
        pledgeTo: '株式会社〇〇 御中',
        items: '業務上知り得た秘密情報を、在職中および退職後においても、第三者に開示または漏洩しないこと。\n' +
               '会社の備品・機密資料を、私的に使用または社外に持ち出さないこと。\n' +
               '上記に違反した場合、これにより会社に生じた損害を賠償する責任を負うこと。',
        pledger_name: '田中 健太',
        pledger_addr: '神奈川県横浜市中区山下町1-1',
        pledger_tel: '090-1111-2222',
        docDate: todayISO(),
        useWareki: true
      },
      render: function (v) {
        var h = '<h1 class="doc-title">誓約書</h1>';
        if (String(v.pledgeTo || '').trim()) {
          h += '<p class="doc-ref">' + esc(String(v.pledgeTo).trim()) + '</p>';
        }
        h += '<p class="doc-lead">私は、下記の事項を誓約いたします。</p>';
        h += '<p class="doc-ref">記</p>';
        h += itemsList(v.items);
        h += '<p class="doc-close">上記の誓約に相違ないことを誓約いたします。' +
             '万一、上記の誓約に違反した場合には、いかなる処分・請求を受けても異議なく従い、' +
             'これにより生じた損害を賠償する責任を負うことを誓約いたします。</p>';
        h += dateLine(v);
        h += '<div class="doc-sign">';
        h += signBlock('誓約者', v.pledger_addr, v.pledger_name, v.pledger_tel);
        h += '</div>';
        h += footnote();
        return h;
      }
    }
  };

  /* ---------------------------------------------------------
     9. 状態
     --------------------------------------------------------- */

  var state = {};              /* 全フィールドの値（id → 文字列 or boolean） */
  var current = 'loan-money';  /* 現在の書式 */

  function tmpl() { return TEMPLATES[current]; }

  function allFields() {
    var out = [];
    tmpl().groups.forEach(function (g) {
      g.fields.forEach(function (f) { out.push(f); });
    });
    return out;
  }

  function blankValue(f) {
    if (f.type === 'checkbox') return false;
    if (f.type === 'select') return (f.options && f.options[0]) ? f.options[0].v : '';
    return '';
  }

  /* ---------------------------------------------------------
     10. フォーム生成
     --------------------------------------------------------- */

  function labelOf(f) {
    if (!f.label) return '';
    return f.label[lang] || f.label.ja;
  }

  function fieldHTML(f) {
    var id = 'f_' + f.id;
    var labelText = labelOf(f);
    var phText = f.ph ? (f.ph[lang] || f.ph.ja) : '';
    var v = state[f.id];
    var cls = f.full ? 'fld full' : 'fld';
    var tag = f.opt ? '<span class="opt-tag">' + esc(tr('optTag')) + '</span>' : '';
    var label = '<label for="' + id + '">' + esc(labelText) + tag + '</label>';

    if (f.type === 'checkbox') {
      return '<div class="' + cls + ' fld-check">' +
        '<input type="checkbox" id="' + id + '" data-key="' + f.id + '"' + (v ? ' checked' : '') + '>' +
        '<label for="' + id + '">' + esc(labelText) + '</label></div>';
    }

    if (f.type === 'date') {
      return '<div class="' + cls + '">' + label +
        '<input type="date" id="' + id + '" data-key="' + f.id + '" value="' + esc(v || '') + '"></div>';
    }

    if (f.type === 'textarea') {
      return '<div class="' + cls + '">' + label +
        '<textarea id="' + id + '" data-key="' + f.id + '" rows="6" placeholder="' + esc(phText) + '">' +
        esc(v || '') + '</textarea></div>';
    }

    if (f.type === 'select') {
      var cur = (v == null || v === '') ? blankValue(f) : v;
      var opts = (f.options || []).map(function (o) {
        return '<option value="' + esc(o.v) + '"' + (String(cur) === o.v ? ' selected' : '') + '>' +
               esc(o[lang] || o.ja) + '</option>';
      }).join('');
      return '<div class="' + cls + '">' + label +
        '<select id="' + id + '" data-key="' + f.id + '">' + opts + '</select></div>';
    }

    if (f.type === 'daji') {
      return '<div class="fld full">' +
        '<div class="daji-box"><span class="daji-label">' + esc(tr('dajiLabel')) + '</span>' +
        '<span class="daji-value" id="dajiValue"></span></div></div>';
    }

    if (f.type === 'hint') {
      return '<div class="fld full"><div class="rate-hint" id="rateHint"></div></div>';
    }

    return '<div class="' + cls + '">' + label +
      '<input type="text" id="' + id + '" data-key="' + f.id + '" value="' + esc(v || '') +
      '" placeholder="' + esc(phText) + '" inputmode="' + (f.id === 'amount' || f.id === 'itemValue' ? 'numeric' : 'text') + '"></div>';
  }

  function buildForm() {
    var form = $('docForm');
    if (!form) return;
    var html = '';

    tmpl().groups.forEach(function (g) {
      html += '<fieldset class="fieldset"><legend>' + esc(tr(g.legend)) + '</legend><div class="grid">';
      g.fields.forEach(function (f) { html += fieldHTML(f); });
      html += '</div></fieldset>';
    });

    form.innerHTML = html;
    updateConditionals();
  }

  /* 条件付きフィールドの表示制御（showIf: "warranty=full"） */
  function updateConditionals() {
    var form = $('docForm');
    if (!form) return;
    allFields().forEach(function (f) {
      if (!f.showIf) return;
      var parts = String(f.showIf).split('=');
      var wrap = form.querySelector('[data-key="' + f.id + '"]');
      if (!wrap) return;
      var box = wrap.closest('.fld');
      if (!box) return;
      var cur = state[parts[0]];
      box.hidden = (String(cur == null ? '' : cur) !== parts[1]);
    });
  }

  function buildTabs() {
    var box = $('tplTabs');
    if (!box) return;
    var html = '';
    Object.keys(TEMPLATES).forEach(function (id) {
      var t = TEMPLATES[id];
      html += '<button type="button" class="tpl-tab" role="tab" data-tpl="' + id +
              '" aria-selected="' + (id === current ? 'true' : 'false') + '">' +
              esc(lang === 'zh' ? t.tabZh : t.tabJa) +
              '<small>' + esc(lang === 'zh' ? t.tabJa : t.tabZh) + '</small></button>';
    });
    box.innerHTML = html;
  }

  /* ---------------------------------------------------------
     11. プレビュー描画
     --------------------------------------------------------- */

  function syncPreview() {
    var paper = $('paper');
    if (paper) paper.innerHTML = tmpl().render(state);
  }

  function syncAmountBox() {
    var el = $('dajiValue');
    if (!el) return;
    var a = num(state.amount);
    if (a > 0) el.textContent = dajiAmount(a) + '也　（' + yen(a) + '）';
    else el.textContent = lang === 'zh' ? '请输入金额' : '金額を入力してください';
  }

  function syncRateHint() {
    var el = $('rateHint');
    if (!el) return;
    var p = num(state.amount);
    var limit = rateLimit(p);
    var i = dec(state.interestRate);
    var d = dec(state.delayRate);
    var dMax = delayLimit(p, i);
    var msgs = [];
    var warn = false;

    if (p > 0) {
      if (i > limit) {
        warn = true;
        msgs.push(tr('rateHintOver').replace('%L', String(limit)));
      } else {
        msgs.push(tr('rateHintOk').replace('%L', String(limit)).replace('%P', yen(p)));
      }
      if (d > 0) {
        if (d > dMax) {
          warn = true;
          msgs.push(tr('rateHintDelayOver').replace('%D', String(dMax)));
        } else {
          msgs.push(tr('rateHintDelay').replace('%D', String(dMax)));
        }
      }
    } else {
      msgs.push(tr('rateHintNone'));
    }

    el.textContent = msgs.join(' ');
    el.className = 'rate-hint' + (warn ? ' warn' : (p > 0 ? ' ok' : ''));
  }

  function syncUI() {
    syncAmountBox();
    syncRateHint();
    syncPreview();
  }

  /* ---------------------------------------------------------
     12. フォームの読み書き
     --------------------------------------------------------- */

  function readForm() {
    var form = $('docForm');
    if (!form) return;
    form.querySelectorAll('[data-key]').forEach(function (el) {
      var k = el.getAttribute('data-key');
      state[k] = (el.type === 'checkbox') ? !!el.checked : el.value;
    });
  }

  function writeForm() {
    var form = $('docForm');
    if (!form) return;
    form.querySelectorAll('[data-key]').forEach(function (el) {
      var v = state[el.getAttribute('data-key')];
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = (v == null ? '' : v);
    });
  }

  /* ---------------------------------------------------------
     13. 操作
     --------------------------------------------------------- */

  function setTemplate(id) {
    if (!TEMPLATES[id]) return;
    readForm();
    current = id;
    buildTabs();
    buildForm();
    syncUI();
  }

  function fillSample() {
    var s = tmpl().sample || {};
    allFields().forEach(function (f) {
      if (f.type === 'daji' || f.type === 'hint') return;
      state[f.id] = Object.prototype.hasOwnProperty.call(s, f.id) ? s[f.id] : blankValue(f);
    });
    writeForm();
    updateConditionals();
    syncUI();
  }

  function resetAll() {
    allFields().forEach(function (f) {
      if (f.type === 'daji' || f.type === 'hint') return;
      state[f.id] = blankValue(f);
    });
    state.useWareki = true;
    writeForm();
    updateConditionals();
    syncUI();
  }

  function printDoc() { window.print(); }

  /* ---------------------------------------------------------
     14. 共有
     --------------------------------------------------------- */

  var SHARE_URL = 'https://www.reveriel.com/shakuyo-contract/';
  var SHARE_TEXT = {
    ja: '借用書・売買契約書・覚書・誓約書を無料で作成できるテンプレートツール。金額の大字（漢数字）も自動変換。',
    zh: '免费生成借用书・买卖合同・备忘录・承诺书的模板工具，金额自动转大字（汉数字）。'
  };

  function shareText() { return SHARE_TEXT[lang] || SHARE_TEXT.ja; }

  function shareX() {
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText()) +
      '&url=' + encodeURIComponent(SHARE_URL), '_blank', 'noopener');
  }

  function shareLine() {
    window.open('https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(SHARE_URL) +
      '&text=' + encodeURIComponent(shareText()), '_blank', 'noopener');
  }

  function fallbackCopy(done) {
    try {
      var ta = document.createElement('textarea');
      ta.value = SHARE_URL;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch (e) { /* クリップボードが使えない環境では何もしない */ }
  }

  function copyLink() {
    var label = $('shareCopyLabel');
    var done = function () {
      if (!label) return;
      label.textContent = tr('shareCopied');
      setTimeout(function () { label.textContent = tr('shareCopy'); }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(SHARE_URL).then(done, function () { fallbackCopy(done); });
    } else {
      fallbackCopy(done);
    }
  }

  /* ---------------------------------------------------------
     15. 初期化
     --------------------------------------------------------- */

  function init() {
    var urlEl = $('shareUrlText');
    if (urlEl) urlEl.textContent = SHARE_URL;
    if (state.useWareki === undefined) state.useWareki = true;

    buildTabs();
    buildForm();

    var langBtn = $('langBtn');
    if (langBtn) {
      langBtn.addEventListener('click', function () {
        readForm();
        applyI18n(lang === 'ja' ? 'zh' : 'ja');
        buildTabs();
        buildForm();
        syncUI();
      });
    }

    var tabs = $('tplTabs');
    if (tabs) {
      tabs.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('.tpl-tab') : null;
        if (b) setTemplate(b.getAttribute('data-tpl'));
      });
    }

    var form = $('docForm');
    if (form) {
      var onInput = function (e) {
        var t = e.target;
        if (!t || !t.getAttribute) return;
        var k = t.getAttribute('data-key');
        if (!k) return;
        state[k] = (t.type === 'checkbox') ? !!t.checked : t.value;
        updateConditionals();
        syncUI();
      };
      form.addEventListener('input', onInput);
      form.addEventListener('change', onInput);
    }

    var bind = function (id, fn) { var el = $(id); if (el) el.addEventListener('click', fn); };
    bind('printBtn', printDoc);
    bind('topPrintBtn', printDoc);
    bind('sampleBtn', fillSample);
    bind('resetBtn', resetAll);
    bind('shareXBtn', shareX);
    bind('shareLineBtn', shareLine);
    bind('shareCopyBtn', copyLink);

    applyI18n(lang);
    syncUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* テスト・デバッグ用に公開（画面の挙動には影響しない） */
  window.ShakuyoApp = {
    kanjiNumber: kanjiNumber,
    dajiAmount: dajiAmount,
    rateLimit: rateLimit,
    delayLimit: delayLimit,
    fmtDate: fmtDate,
    yen: yen,
    templates: function () { return Object.keys(TEMPLATES); },
    current: function () { return current; },
    setTemplate: setTemplate,
    getState: function () { return JSON.parse(JSON.stringify(state)); },
    setValues: function (o) {
      readForm();
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) state[k] = o[k];
      writeForm();
      updateConditionals();
      syncUI();
    },
    fillSample: fillSample,
    reset: resetAll
  };
})();
