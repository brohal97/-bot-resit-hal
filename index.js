require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
let pendingUploads = {};

console.log("🤖 BOT AKTIF – RESIT PERBELANJAAN | KOMISEN | TRANSPORT");

// Buang font pelik
function normalizeFont(text) {
  return text.normalize("NFKD").replace(/[\u{1D400}-\u{1D7FF}]/gu, (char) => {
    const offset = char.codePointAt(0) - 0x1D400;
    return offset >= 0 && offset < 26 ? String.fromCharCode(65 + offset) : char;
  });
}

// Bold kategori utama
function boldKategoriUtama(text) {
  const kategoriList = ["RESIT PERBELANJAAN", "BAYAR KOMISEN", "BAYAR TRANSPORT"];
  const boldMap = {
    A: "𝐀", B: "𝐁", C: "𝐂", D: "𝐃", E: "𝐄", F: "𝐅", G: "𝐆",
    H: "𝐇", I: "𝐈", J: "𝐉", K: "𝐊", L: "𝐋", M: "𝐌", N: "𝐍",
    O: "𝐎", P: "𝐏", Q: "𝐐", R: "𝐑", S: "𝐒", T: "𝐓", U: "𝐔",
    V: "𝐕", W: "𝐖", X: "𝐗", Y: "𝐘", Z: "𝐙", " ": " "
  };
  const toBold = (word) => word.split("").map(c => boldMap[c.toUpperCase()] || c).join("");
  for (const kategori of kategoriList) {
    if (text.toUpperCase().startsWith(kategori)) {
      const bolded = toBold(kategori);
      return text.replace(new RegExp(kategori, "i"), bolded);
    }
  }
  return text;
}

// Bila terima mesej teks
bot.on("message", async (msg) => {
  console.log("📥 Mesej diterima:", msg.text);

  const chatId = msg.chat.id;
  if (typeof msg.text !== "string") return;

  const originalText = msg.text.trim();
  const upperText = originalText.toUpperCase();
  const originalMsgId = msg.message_id;

  const namaSah = ["RESIT PERBELANJAAN", "BAYAR KOMISEN", "BAYAR TRANSPORT"];
  const isKategoriSah = namaSah.some((nama) => upperText.startsWith(nama));
  if (!isKategoriSah) return;

  if (originalText.length < 20) {
    await bot.sendMessage(chatId, "⚠️ Sila tambah maklumat seperti tarikh, lokasi dan jumlah dalam mesej.");
    return;
  }

  try {
    await bot.deleteMessage(chatId, originalMsgId);
    console.log("🗑 Mesej asal dipadam");
  } catch (e) {
    console.error("❌ Gagal padam mesej asal:", e.message);
  }

  const cleanText = boldKategoriUtama(normalizeFont(originalText));

  try {
    const sent = await bot.sendMessage(chatId, cleanText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📸 Upload Resit", callback_data: `upload_${originalMsgId}` }]
        ]
      }
    });
    console.log("✅ Mesej balasan dihantar");

    pendingUploads[sent.message_id] = {
      detail: cleanText,
      chatId: chatId,
      detailMsgId: sent.message_id
    };
  } catch (err) {
    console.error("❌ Gagal hantar mesej balasan:", err.message);
  }
});

// Bila user tekan butang Upload Resit
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const detailMsgId = pendingUploads[msgId]?.detailMsgId || msgId;

  if (pendingUploads[msgId]) {
    try {
      const trigger = await bot.sendMessage(chatId, '❗️𝐒𝐢𝐥𝐚 𝐔𝐩𝐥𝐨𝐚𝐝 𝐑𝐞𝐬𝐢𝐭 𝐒𝐞𝐠𝐞𝐫𝐚 ❗️', {
        reply_to_message_id: detailMsgId,
        reply_markup: { force_reply: true }
      });

      pendingUploads[trigger.message_id] = {
        ...pendingUploads[msgId],
        triggerMsgId: trigger.message_id
      };

      setTimeout(async () => {
        if (pendingUploads[trigger.message_id]) {
          try {
            await bot.deleteMessage(chatId, trigger.message_id);
          } catch (e) {
            console.error("❌ Gagal auto delete reminder:", e.message);
          }
          delete pendingUploads[trigger.message_id];
        }
      }, 40000);

    } catch (err) {
      console.error("❌ Gagal hantar reminder upload:", err.message);
    }
  }
});

// Bila gambar dihantar sebagai reply kepada Upload Resit
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const replyTo = msg.reply_to_message?.message_id;

  if (!replyTo || !pendingUploads[replyTo]) {
    await bot.sendMessage(chatId, "⚠️ Gambar ini tidak dikaitkan dengan mana-mana resit. Sila tekan Upload Resit semula.");
    return;
  }

  const fileId = msg.photo[msg.photo.length - 1].file_id;
  const resitData = pendingUploads[replyTo];

  try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) { }
  try { await bot.deleteMessage(chatId, resitData.triggerMsgId); } catch (e) { }
  try { await bot.deleteMessage(chatId, resitData.detailMsgId); } catch (e) { }

  const captionGabung = boldKategoriUtama(normalizeFont(resitData.detail));

  try {
    const sentPhoto = await bot.sendPhoto(chatId, fileId, { caption: captionGabung });
    console.log("📤 Gambar dihantar semula");

    await bot.forwardMessage(process.env.CHANNEL_ID, chatId, sentPhoto.message_id);
    console.log("📨 Gambar berjaya di-forward ke channel");
  } catch (err) {
    console.error("❌ Gagal forward ke channel:", err.message);
  }

  delete pendingUploads[replyTo];
});
