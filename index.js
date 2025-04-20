require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
let pendingUploads = {}; // Simpan pairing ikut message_id

console.log("🤖 BOT AKTIF – RESIT PERBELANJAAN | KOMISEN | TRANSPORT");

// Step 1: Bila terima mesej jenis rasmi
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  if (typeof msg.text !== "string") return;

  const text = msg.text.trim();
  const originalMsgId = msg.message_id;

  const barisPertama = text.split("\n")[0].toUpperCase();

  // ✅ Semak jika mesej bermula dengan salah satu kategori
  const namaSah = ["RESIT PERBELANJAAN", "BAYAR KOMISEN", "BAYAR TRANSPORT"];
  if (!namaSah.includes(barisPertama)) return;

  // ❌ Tolak kalau mesej terlalu pendek
  if (text.length < 20) {
    await bot.sendMessage(chatId, "⚠️ Sila tambah maklumat seperti tarikh, lokasi dan jumlah dalam mesej.");
    return;
  }

  try {
    await bot.deleteMessage(chatId, originalMsgId);
  } catch (e) {
    console.error("❌ Gagal padam mesej asal:", e.message);
  }

  // ✅ Tambah emoji tajuk atas
  let header = barisPertama;
  if (barisPertama === "RESIT PERBELANJAAN") header = "RESIT PERBELANJAAN";
  if (barisPertama === "BAYAR KOMISEN") header = "BAYAR KOMISEN";
  if (barisPertama === "BAYAR TRANSPORT") header = "BAYAR TRANSPORT";

  const body = text.split("\n").slice(1).join("\n");
  const finalText = `${header}\n${body}`;

  const sent = await bot.sendMessage(chatId, finalText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📸 Upload Resit", callback_data: `upload_${originalMsgId}` }]
      ]
    }
  });

  pendingUploads[sent.message_id] = {
    detail: finalText,
    chatId: chatId,
    detailMsgId: sent.message_id
  };
});

