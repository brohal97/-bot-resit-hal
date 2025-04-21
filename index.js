require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const API_KEY = process.env.VISION_API_KEY;

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
let pendingUploads = {};

console.log("🤖 BOT AKTIF – RESIT PERBELANJAAN | BAYAR KOMISEN | BAYAR TRANSPORT");

async function replyUITrick(chatId, text, replyTo) {
  const sent = await bot.sendMessage(chatId, `❗️𝐒𝐢𝐥𝐚 𝐇𝐚𝐧𝐭𝐚𝐫 𝐑𝐞𝐬𝐢𝐭 𝐒𝐞𝐠𝐫𝐚❗️`, {
    reply_to_message_id: replyTo,
    parse_mode: "HTML",
    reply_markup: {
      force_reply: true
    }
  });
  return sent.message_id;
}

function cariTarikhDalamText(teks) {
  const pattern1 = /\b(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})\b/;
  const match1 = teks.match(pattern1);
  if (match1) {
    const [_, dd, mm, yyyy] = match1;
    return `${yyyy.length === 2 ? '20' + yyyy : yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return null;
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (typeof msg.text !== "string") return;

  const text = msg.text.trim();
  const originalMsgId = msg.message_id;

  const namaSah = ["RESIT PERBELANJAAN", "BAYAR KOMISEN", "BAYAR TRANSPORT"];
  const isKategoriSah = namaSah.some((nama) => text.toUpperCase().startsWith(nama));
  if (!isKategoriSah) return;

  if (text.length < 20) {
    await bot.sendMessage(chatId, "⚠️ Sila tambah maklumat seperti tarikh, lokasi dan jumlah dalam mesej.");
    return;
  }

  try {
    await bot.deleteMessage(chatId, originalMsgId);
  } catch (e) {
    console.error("❌ Gagal padam mesej asal:", e.message);
  }

  const lines = text.split('\n');
  const firstLine = lines[0] ? `<b>${lines[0]}</b>` : '';
  const otherLines = lines.slice(1).join('\n');
  const formattedText = `${firstLine}\n${otherLines}`;

  const sent = await bot.sendMessage(chatId, formattedText, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📸 Upload Resit", callback_data: `upload_${originalMsgId}` }]
      ]
    }
  });

  pendingUploads[sent.message_id] = {
    detail: text,
    chatId: chatId,
    replyTo: sent.message_id,
    captionMsgId: sent.message_id
  };
});

bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  if (!data.startsWith("upload_")) return;

  const uploadInfo = pendingUploads[msg.message_id];
  if (!uploadInfo) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "❌ Resit tidak dijumpai atau telah tamat.",
      show_alert: true
    });
    return;
  }

  const replyMsgId = await replyUITrick(uploadInfo.chatId, uploadInfo.detail, uploadInfo.replyTo);
  pendingUploads[replyMsgId] = {
    detail: uploadInfo.detail,
    chatId: uploadInfo.chatId,
    replyTo: replyMsgId,
    captionMsgId: msg.message_id
  };

  await bot.answerCallbackQuery(callbackQuery.id);
});

bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const replyToMsg = msg.reply_to_message;
  if (!replyToMsg) return;

  const matched = pendingUploads[replyToMsg.message_id];
  if (!matched) return;

  const photo = msg.photo[msg.photo.length - 1];
  const file = await bot.getFile(photo.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

  const lines = matched.detail.split('\n');
  const firstLine = lines[0] ? `<b>${lines[0]}</b>` : '';
  const otherLines = lines.slice(1).join('\n');
  const formattedCaption = `${firstLine}\n${otherLines}`;

  try {
    await bot.sendChatAction(chatId, 'upload_photo');
    const imageBuffer = await axios.get(fileUrl, { responseType: 'arraybuffer' }).then(res => Buffer.from(res.data, 'binary'));

    await bot.sendPhoto(chatId, imageBuffer, {
      caption: formattedCaption,
      parse_mode: "HTML"
    });

    await bot.deleteMessage(chatId, msg.message_id);
    await bot.deleteMessage(chatId, replyToMsg.message_id);
    await bot.deleteMessage(chatId, matched.captionMsgId);

    if (matched.detail.toUpperCase().startsWith("RESIT PERBELANJAAN")) {
      const visionResponse = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
        {
          requests: [
            {
              image: { source: { imageUri: fileUrl } },
              features: [{ type: 'TEXT_DETECTION' }]
            }
          ]
        }
      );

      const response = visionResponse.data.responses[0];
      const ocrText = response.fullTextAnnotation?.text || response.textAnnotations?.[0]?.description || '';

      const tarikhCaption = cariTarikhDalamText(matched.detail);
      const tarikhOCR = cariTarikhDalamText(ocrText);

      if (tarikhCaption && tarikhOCR && tarikhCaption === tarikhOCR) {
        await bot.sendMessage(chatId, `✅ Tarikh padan: ${tarikhCaption}`);
      } else {
        await bot.sendMessage(chatId, `❌ Tarikh tidak sepadan.\n📅 Caption: ${tarikhCaption || '❓'}\n🧾 Gambar: ${tarikhOCR || '❓'}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Luluskan Secara Manual", callback_data: `manual_${replyToMsg.message_id}` }]
            ]
          }
        });
      }
    }

    delete pendingUploads[replyToMsg.message_id];
  } catch (e) {
    console.error("❌ Error hantar semula gambar:", e.message);
  }
});

