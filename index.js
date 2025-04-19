// ===================== DETECT TARIKH + SEMUA TAPISAN PENUH =====================
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF - TAPISAN: TARIKH, LOKASI, KOSMETIK, PAKAIAN, GAJET, KEDAI, ELEKTRIK");

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
  if (match1) {
    const d = match1[1].padStart(2, '0');
    const m = bulanMap[match1[2].toLowerCase()] || '??';
    const y = match1[3];
    return `${d}-${m}-${y}`;
  }

  let match2 = clean.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match2) {
    const d = match2[3].padStart(2, '0');
    const m = match2[2].padStart(2, '0');
    const y = match2[1];
    return `${d}-${m}-${y}`;
  }

  let match3 = clean.match(/(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{2,4})/);
  if (match3) {
    const d = match3[1].padStart(2, '0');
    const m = match3[2].padStart(2, '0');
    const y = match3[3].length === 2 ? '20' + match3[3] : match3[3];
    return `${d}-${m}-${y}`;
  }

  return text;
}

function isKosmetikDetected(text) {
  const keyword = ["LIP", "MATTE", "MASCARA", "EYELINER", "BROW", "SHADOW", "BLUSH", "FOUNDATION", "POWDER"];
  const upper = text.toUpperCase();
  return keyword.some(k => upper.includes(k));
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
  return keyword.some(k => upper.includes(k));
}

function isGajetDetected(text) {
  const keyword = [
    "PHONE", "SMARTPHONE", "HANDPHONE", "MOBILE", "IPHONE", "SAMSUNG", "OPPO", "VIVO", "REALME", "XIAOMI",
    "LAPTOP", "MACBOOK", "TABLET", "PC", "MONITOR", "SSD", "HDD", "CPU", "RAM", "PRINTER", "ROUTER", "MODEM",
    "CHARGER", "USB", "TYPE-C", "POWERBANK", "ADAPTER", "DOCK", "HDMI", "VGA", "MOUSE", "KEYBOARD",
    "SPEAKER", "HEADPHONE", "EARPHONE", "EARBUD", "TWS", "MIC", "MICROPHONE", "CAMERA", "CCTV", "DASHCAM",
    "DRONE", "STYLUS", "HOLDER", "STAND", "TRIPOD", "TEMPERED", "CASING", "CASE", "SCREEN PROTECTOR", "SMARTWATCH"
  ];
  const upper = text.toUpperCase();
  return keyword.some(k => upper.includes(k));
}

function isNamaKedaiKosmetik(text) {
  const kedai = [
    "WATSONS", "GUARDIAN", "SEPHORA", "AEON", "MYDIN", "FARMASI",
    "CARING", "ALPRO", "BIG PHARMACY", "VITAHEALTH",
    "HERMO", "SASA", "PLAYUP", "INNISFREE", "THE FACE SHOP",
    "BODY SHOP", "YES2HEALTH", "SUNWAY PHARMACY", "NASKEN",
    "KFC", "MCDONALD", "MCD", "PIZZA HUT", "DOMINO", "TEXAS", "AYAM PENYET",
    "BURGER KING", "SUBWAY", "MARRYBROWN", "STARBUCKS", "COFFEE BEAN", "TEALIVE",
    "SECRET RECIPE", "DUNKIN", "SUSHI KING", "BBQ PLAZA", "OLD TOWN", "PAPA JOHN",
    "NANDOS", "A&W", "CHATIME", "BOOST JUICE", "FAMILYMART", "DAISO", "BLACK CANYON",
    "GONG CHA", "LLAOLLAO", "COOLBLOG", "ZUS COFFEE", "HAIDILAO", "SHIH LIN",
    "HOT & ROLL", "MYKORI", "EMART", "E-MART", "E MART"
  ];
  const upper = text.toUpperCase();
  return kedai.some(nama => upper.includes(nama));
}

function isElektrikRumahDetected(text) {
  const keyword = [
    "RICE COOKER", "COOKER", "PERIUK", "BLENDER", "MIXER", "JUICER", "CHOPPER",
    "TOASTER", "OVEN", "MICROWAVE", "STEAMER", "AIR FRYER", "FRYER", "KETTLE", "HOTPOT",
    "WATER HEATER", "HEATER", "AIR COOLER", "FAN", "KIPAS", "AIRCOND", "AIR CONDITIONER",
    "IRON", "SETTERIKA", "STEAM IRON", "DRYER", "VACUUM", "CLOTH DRYER", "WASHING MACHINE",
    "SOCKET", "SWITCH", "LAMP", "LIGHT", "LED", "DOOR BELL"
  ];
  const upper = text.toUpperCase();
  return keyword.some(k => upper.includes(k));
}

function isTempatLulus(text) {
  const lokasi = ["kok lanas", "ketereh", "melor"];
  const lowerText = text.toLowerCase();
  return lokasi.some(nama => lowerText.includes(nama));
}

