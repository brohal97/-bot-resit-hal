require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { v1: uuidv1 } = require("uuid");

// ✅ Setup Google Vision
const vision = require("@google-cloud/vision");
const client = new vision.ImageAnnotatorClient({
  keyFilename: path.join(__dirname, "secrets/google-vision-key.json"),
});

if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN tidak dijumpai dalam .env!");
  process.exit(1);
}

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("🤖 BOT AKTIF - SEMAK TARIKH GAMBAR");

bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();
  const hasPhoto = msg.photo && msg.photo.length > 0;
  const caption = msg.caption || "";

  if (chatId !== process.env.GROUP_ID) return;
  if (!hasPhoto) {
    bot.sendMessage(chatId, "❌ Sila hantar gambar resit.");
    return;
  }

  try {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const filePath = path.join(__dirname, `resit-${uuidv1()}.jpg`);

    const response = await axios({ url: fileUrl, method: "GET", responseType: "stream" });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    await new Promise((resolve) => writer.on("finish", resolve));

    // 📤 Hantar ke Google Vision
    const [result] = await client.textDetection(filePath);
    const detections = result.textAnnotations;
    const ocrText = detections.length > 0 ? detections[0].description.toLowerCase() : "";

    fs.unlinkSync(filePath); // padam fail

    // 🔍 Cari tarikh dalam OCR
    const dateRegex = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/;
    const match = ocrText.match(dateRegex);

    if (match) {
      bot.sendMessage(chatId, `✅ Tarikh dikesan: *${match[0]}*`, { parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, "❌ Gagal kesan tarikh dalam gambar.");
    }
  } catch (err) {
    console.error("❌ Error semasa proses OCR:", err.message);
    bot.sendMessage(chatId, "❌ Berlaku ralat semasa semak gambar.");
  }
});

