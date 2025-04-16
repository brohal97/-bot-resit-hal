require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF & MENUNGGU GAMBAR + TEKS...");

// Sambung ke Document AI
async function getDocumentAIText(base64Image) {
  const auth = new GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });

  const client = await auth.getClient();
  const projectId = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON).project_id;
  const location = 'us';
  const processorId = '44b32b2f62126377'; // Gantikan dengan Processor ID kau

  const endpoint = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;

  const requestBody = {
    rawDocument: {
      content: base64Image,
      mimeType: 'image/png', // atau 'image/jpeg' ikut fail
    }
  };

  const result = await client.request({
    url: endpoint,
    method: 'POST',
    data: requestBody
  });

  const text = result.data.document.text || '';
  return text;
}

// Fungsi sedia ada kekal — termasuk isTarikhValid, detectJenisDokumen, validateResitPerbelanjaanFlexible, validateBayarTransportFormat, validateBayarKomisenFormat

// Gantikan bahagian visionRes dalam 'photo' event dengan sambungan Document AI
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const caption = msg.caption || '';
  if (!caption.trim()) {
    bot.sendMessage(chatId, `❌ Tidak sah.\nWajib hantar SEKALI gambar & teks (dalam satu mesej).`);
    return;
  }

  const lower = caption.toLowerCase();
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  try {
    const file = await bot.getFile(fileId);
    const imageUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const res = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(res.data, 'binary').toString('base64');

    const text = await getDocumentAIText(base64Image);
    if (!text) {
      bot.sendMessage(chatId, `⚠️ Ralat semasa semakan gambar. Sila cuba semula.`);
      return;
    }

    const jenisDokumen = detectJenisDokumen(text);
    if (jenisDokumen === 'lain') {
      bot.sendMessage(chatId, `❌ Gambar tidak sah.\nHanya gambar RESIT atau SLIP BANK dibenarkan.`);
      return;
    }

    if (lower.startsWith('resit perbelanjaan')) {
      if (!validateResitPerbelanjaanFlexible(caption)) {
        bot.sendMessage(chatId, `❌ Format tidak lengkap.\nRESIT PERBELANJAAN mesti ada:\n📆 Tarikh\n🎯 Tujuan (min 3 perkataan)\n💰 Harga`);
        return;
      }
      bot.sendMessage(chatId, `✅ Resit diterima. Format lengkap & sah.`);
      return;
    }

    if (lower.startsWith('bayar transport')) {
      if (!validateBayarTransportFormat(caption)) {
        bot.sendMessage(chatId, `❌ Format BAYAR TRANSPORT tidak sah atau jumlah tidak padan.\nSemak semula harga produk dan jumlah total.`);
        return;
      }
      bot.sendMessage(chatId, `✅ Bayar Transport diterima. Jumlah padan & format lengkap.`);
      return;
    }

    if (caption.startsWith('BAYAR KOMISEN')) {
      if (!validateBayarKomisenFormat(caption)) {
        bot.sendMessage(chatId, `❌ Format BAYAR KOMISEN tidak lengkap atau tidak sah.\nWajib ada:\n📆 Tarikh\n👤 Nama Salesperson\n🏦 Nama Bank\n💰 Harga RM`);
        return;
      }
      bot.sendMessage(chatId, `✅ Bayar Komisen diterima. Format lengkap & sah.`);
      return;
    }

    bot.sendMessage(chatId, `❌ Format tidak dikenali.\nBot hanya terima 'RESIT PERBELANJAAN', 'BAYAR TRANSPORT', dan 'BAYAR KOMISEN' yang sah.`);
  } catch (err) {
    console.error("❌ Ralat Document AI:", err.response?.data || err.message);
    bot.sendMessage(chatId, `⚠️ Ralat semasa semakan gambar. Sila cuba semula.`);
  }
});

