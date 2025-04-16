require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF & MENUNGGU GAMBAR + TEKS...");

// Init Google Document AI Client
const client = new DocumentProcessorServiceClient({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
  projectId: process.env.PROJECT_ID,
});

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const caption = msg.caption || '';

  try {
    // Ambil gambar resolusi paling tinggi
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    // Muat turun gambar dan ubah ke base64
    const imageRes = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(imageRes.data).toString('base64');

    // Setup permintaan ke Document AI
    const name = `projects/${process.env.PROJECT_ID}/locations/${process.env.LOCATION}/processors/${process.env.PROCESSOR_ID}`;

    const request = {
      name,
      rawDocument: {
        content: base64Image,
        mimeType: 'image/png',
      },
    };

    // Proses dengan Document AI
    const [result] = await client.processDocument(request);
    const doc = result.document;

    // Cari info utama dari document.entities
    const entities = doc.entities || [];
    const getField = (type) => {
      const found = entities.find((e) => e.type.toLowerCase() === type.toLowerCase());
      return found?.mentionText || '-';
    };

    const tarikh = getField('date');
    const jumlah = getField('total_amount');
    const alamat = getField('address');
    const kedai = getField('merchant_name');
    const noPhone = getField('phone_number');

    // Hantar hasil ke group
    const mesej = `
📄 *Maklumat Resit/Slip:*
🏪 Nama: ${kedai}
📍 Alamat: ${alamat}
📞 Telefon: ${noPhone}
📆 Tarikh: ${tarikh}
💰 Jumlah: RM ${jumlah}
`.trim();

    bot.sendMessage(chatId, mesej, { parse_mode: 'Markdown' });

  } catch (err) {
    console.error("❌ Ralat:", err.message || err);
    bot.sendMessage(chatId, "⚠️ Ralat semasa proses gambar. Pastikan format resit/slip betul.");
  }
});
