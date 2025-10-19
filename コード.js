/** 設定 */
const SHEET_NAME = 'links';
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const LINE_CHANNEL_SECRET = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_SECRET');
const LINE_CHANNEL_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_TOKEN');

/************************************************************
 * LINEトークのURLをスプレッドシートに自動転記（最小構成）
 ************************************************************/



// ===== doPost (Webhook受信) =====
function doPost(e) {
  // === テスト実行時の仮引数 ===
  if (!e || !e.postData) {
    Logger.log('★ テストモードで実行しています');
    const sampleUrl = 'https://example.com'; // ← サンプルURL
    const body = JSON.stringify({
      events: [
        {
          type: 'message',
          replyToken: 'dummy',
          source: { type: 'user', userId: 'U123456' },
          message: { type: 'text', text: sampleUrl }
        }
      ]
    });
    e = {
      postData: {
        contents: body,
        type: 'application/json',
        headers: { 'X-Line-Signature': '' }
      }
    };
  }

  try {
    const raw = e?.postData?.contents || '';
    const sig = e?.postData?.headers?.['X-Line-Signature'] || e?.postData?.headers?.['x-line-signature'] || '';

    // --- 署名確認（デバッグ時はfalseでスキップ可能）---
    const SIGNATURE_CHECK = false; // ← テスト時はfalse
    if (SIGNATURE_CHECK && !verifySignature(raw, sig)) {
      Logger.log('署名NG');
      return ContentService.createTextOutput('NG(signature)');
    }

    // --- JSONパース ---
    const data = JSON.parse(raw);
    const events = data.events || [];
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // ヘッダーがなければ作成
    if (sh.getLastRow() === 0) {
      sh.appendRow(['timestamp', 'userType', 'userId', 'text', 'url']);
    }

    // 各イベントを処理
    for (const ev of events) {
      if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text') continue;
      const text = ev.message.text;
      const urls = extractUrls(text);
      if (urls.length === 0) continue;

      const sourceType = ev.source.type;
      const sourceId =
        sourceType === 'user'
          ? ev.source.userId
          : sourceType === 'group'
          ? ev.source.groupId
          : sourceType === 'room'
          ? ev.source.roomId
          : '';

      const now = new Date();
      urls.forEach((u) => sh.appendRow([now, sourceType, sourceId, text, u]));
    }

    // return ContentService.createTextOutput('OK');
    // 必ず200を返す
    return ContentService
      .createTextOutput('OK')
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    Logger.log(err);
    return ContentService.createTextOutput('ERR');
  }
}

// ===== URL抽出 =====
function extractUrls(text) {
  if (!text) return [];
  const re = /(https?:\/\/[^\s<>"'()]+)/gi;
  return (text.match(re) || []);
}

// ===== LINE署名検証 =====
function verifySignature(rawBody, signature) {
  if (!rawBody || !signature) return false;
  const mac = Utilities.computeHmacSha256Signature(rawBody, LINE_CHANNEL_SECRET);
  const expected = Utilities.base64Encode(mac);
  return expected === signature;
}
