// ===================== DETECT TARIKH + SEMUA TAPISAN PENUH (VERSI DEBUG) =====================
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF - VERSI DEBUG DENGAN TAPISAN LENGKAP");

function isTarikhValid(line) {
  const lower = line.toLowerCase();
  const patterns = [
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
    /\b\d{1,2}\s+\d{1,2}\s+\d{2,4}\b/,
    /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/,
    /\b\d{1,2}\s+(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}\b/i,
    /\b(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}\b/i
  ];
  return patterns.some(p => p.test(lower));
}

function formatTarikhStandard(text) {
  const bulanMap = {
    jan: '01', feb: '02', mac: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  const clean = text.trim();

  let match1 = clean.match(/(\d{1,2})\s+(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})/i);
  if (match1) return `${match1[1].padStart(2, '0')}-${bulanMap[match1[2].toLowerCase()] || '??'}-${match1[3]}`;

  let match2 = clean.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match2) return `${match2[3].padStart(2, '0')}-${match2[2].padStart(2, '0')}-${match2[1]}`;

  let match3 = clean.match(/(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{2,4})/);
  if (match3) return `${match3[1].padStart(2, '0')}-${match3[2].padStart(2, '0')}-${match3[3].length === 2 ? '20' + match3[3] : match3[3]}`;

  return text;
}

function isKosmetikDetected(text) {
  const keyword = ["LIP", "MATTE", "MASCARA", "EYELINER", "BROW", "SHADOW", "BLUSH", "FOUNDATION", "POWDER"];
  const upper = text.toUpperCase();
  const matched = keyword.filter(k => upper.includes(k));
  if (matched.length) console.log("❌ Kosmetik match:", matched);
  return matched.length > 0;
}

function isPakaianDetected(text) {
  const keyword = [
    "TOP", "TEE", "T-SHIRT", "SHIRT", "BLOUSE", "DRESS", "SKIRT",
    "PANTS", "JEANS", "SHORTS", "KURUNG", "BAJU", "SELUAR",
    "JACKET", "HOODIE", "SWEATER", "UNIFORM",
    "MEN", "WOMEN", "LADIES", "BOY", "GIRL", "KIDS", "BABY",
    "APPAREL", "CLOTHING", "FASHION"
  ];
  const upper = text.toUpperCase();
  const matched = keyword.filter(k => upper.includes(k));
  if (matched.length) console.log("❌ Pakaian match:", matched);
  return matched.length > 0;
}

function isGajetDetected(text) {
  const keyword = ["PHONE", "SMARTPHONE", "HANDPHONE", "MOBILE", "IPHONE", "SAMSUNG", "OPPO", "VIVO", "REALME", "XIAOMI",
    "LAPTOP", "MACBOOK", "TABLET", "PC", "MONITOR", "SSD", "HDD", "CPU", "RAM", "PRINTER", "ROUTER", "MODEM",
    "CHARGER", "USB", "TYPE-C", "POWERBANK", "ADAPTER", "DOCK", "HDMI", "VGA", "MOUSE", "KEYBOARD",
    "SPEAKER", "HEADPHONE", "EARPHONE", "EARBUD", "TWS", "MIC", "MICROPHONE", "CAMERA", "CCTV", "DASHCAM",
    "DRONE", "STYLUS", "HOLDER", "STAND", "TRIPOD", "TEMPERED", "CASING", "CASE", "SCREEN PROTECTOR", "SMARTWATCH"];
  const upper = text.toUpperCase();
  const matched = keyword.filter(k => upper.includes(k));
  if (matched.length) console.log("❌ Gajet match:", matched);
  return matched.length > 0;
}

function isNamaKedaiKosmetik(text) {
  const kedai = [
    "WATSONS", "GUARDIAN", "SEPHORA", "AEON", "MYDIN", "FARMASI",
    "CARING", "ALPRO", "BIG PHARMACY", "VITAHEALTH", "HERMO", "SASA", "PLAYUP", "INNISFREE",
    "THE FACE SHOP", "BODY SHOP", "YES2HEALTH", "SUNWAY PHARMACY", "NASKEN",
    "KFC", "MCDONALD", "MCD", "PIZZA HUT", "DOMINO", "TEXAS", "AYAM PENYET",
    "BURGER KING", "SUBWAY", "MARRYBROWN", "STARBUCKS", "COFFEE BEAN", "TEALIVE",
    "SECRET RECIPE", "DUNKIN", "SUSHI KING", "BBQ PLAZA", "OLD TOWN", "PAPA JOHN",
    "NANDOS", "A&W", "CHATIME", "BOOST JUICE", "FAMILYMART", "DAISO", "BLACK CANYON",
    "GONG CHA", "LLAOLLAO", "COOLBLOG", "ZUS COFFEE", "HAIDILAO", "SHIH LIN",
    "HOT & ROLL", "MYKORI", "EMART", "E-MART", "E MART"
  ];
  const upper = text.toUpperCase();
  const matched = kedai.filter(k => upper.includes(k));
  if (matched.length) console.log("❌ Nama Kedai match:", matched);
  return matched.length > 0;
}

function isElektrikRumahDetected(text) {
  const keyword = ["RICE COOKER", "COOKER", "PERIUK", "BLENDER", "MIXER", "JUICER", "CHOPPER",
    "TOASTER", "OVEN", "MICROWAVE", "STEAMER", "AIR FRYER", "FRYER", "KETTLE", "HOTPOT",
    "WATER HEATER", "HEATER", "AIR COOLER", "FAN", "KIPAS", "AIRCOND", "AIR CONDITIONER",
    "IRON", "SETTERIKA", "STEAM IRON", "DRYER", "VACUUM", "CLOTH DRYER", "WASHING MACHINE",
    "SOCKET", "SWITCH", "LAMP", "LIGHT", "LED", "DOOR BELL"];
  const upper = text.toUpperCase();
  const matched = keyword.filter(k => upper.includes(k));
  if (matched.length) console.log("❌ Elektrik match:", matched);
  return matched.length > 0;
}

function isTempatLulus(text) {
  const lokasi = ["kok lanas", "ketereh", "melor"];
  const lower = text.toLowerCase();
  return lokasi.some(l => lower.includes(l));
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!msg.photo) {
    bot.sendMessage(chatId, "❌ Sila hantar gambar resit sahaja.");
    return;
  }

  try {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const fileUrl = await bot.getFileLink(fileId);
    const imageBuffer = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(imageBuffer.data, 'binary').toString('base64');

    const ocrRes = await axios.post(`https://vision.googleapis.com/v1/images:annotate?key=${process.env.VISION_API_KEY}`, {
      requests: [{
        image: { content: base64Image },
        features: [{ type: "TEXT_DETECTION" }]
      }]
    });

    const text = ocrRes.data.responses[0].fullTextAnnotation?.text || "";
    console.log("📄 OCR TEXT:", text);
    const lines = text.split('\n').map(x => x.trim());
    const tarikhJumpa = lines.find(line => isTarikhValid(line));

    if (tarikhJumpa) {
      const match = tarikhJumpa.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}\s+(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}|(jan|feb|mac|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}/i);
      const hanyaTarikh = match ? formatTarikhStandard(match[0]) : tarikhJumpa;

      if (
        isKosmetikDetected(text) ||
        isPakaianDetected(text) ||
        isGajetDetected(text) ||
        isNamaKedaiKosmetik(text) ||
        isElektrikRumahDetected(text)
      ) {
        bot.sendMessage(chatId, "❌ Resit tidak dibenarkan. Dikesan pembelian kosmetik, pakaian, gajet, barangan elektrik, atau dari kedai tidak sah.");
        return;
      }

      if (isTempatLulus(text)) {
        bot.sendMessage(chatId, `✅ Tarikh dijumpai: ${hanyaTarikh}\n✅ Lokasi sah: Kok Lanas / Ketereh / Melor`);
      } else {
        bot.sendMessage(chatId, `✅ Tarikh dijumpai: ${hanyaTarikh}\n❌ Lokasi tidak sah. Resit bukan dari kawasan yang dibenarkan.`);
      }
    } else {
      bot.sendMessage(chatId, "❌ Tiada tarikh dijumpai dalam gambar.");
    }
  } catch (err) {
    console.error("OCR Error:", err.message);
    bot.sendMessage(chatId, "❌ Gagal membaca gambar. Sila pastikan gambar jelas.");
  }
});
