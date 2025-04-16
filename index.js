require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF & MENUNGGU GAMBAR + TEKS...");

// Setup client Google Document AI
const client = new DocumentProcessorServiceClient({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
  projectId: process.env.PROJECT_ID,
});

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const caption = msg.caption || '';

  try {
    // Ambil gambar resolusi tertinggi
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    const image = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(image.data).toString('base64');

    // Setup permintaan ke Document AI
    const name = `projects/${process.env.PROJECT_ID}/locations/${process.env.LOCATION}/processors/${process.env.PROCESSOR_ID}`;
    const request = {
      name,
      rawDocument: {
        content: base64Image,
        mimeType: 'image/png', // atau jpeg jika sesuai
      },
    };

    // Hantar ke Document AI
    const [result] = await client.processDocument(request);
    const doc = result.document;
    const entities = doc.entities || [];

    // Bantu cari nilai tertentu
    const getField = (type) => {
      const item = entities.find(e => e.type?.toLowerCase() === type.toLowerCase());
      return item?.mentionText || '-';
    };

    const tarikh = getField('date');
    const jumlah = getField('total_amount');
    const alamat = getField('address');
    const kedai = getField('merchant_name');
    const noPhone = getField('phone_number');

    // Hantar ke Telegram
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
    console.error("❌ Ralat semasa proses:", err.message || err);
    bot.sendMessage(chatId, "⚠️ Ralat semasa proses gambar. Pastikan format resit/slip betul.");
  }
});
