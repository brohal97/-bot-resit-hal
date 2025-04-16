require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 BOT AKTIF & MENUNGGU GAMBAR + TEKS...");

function isTarikhValid(line) {
  const lower = line.toLowerCase();
  const patterns = [
    /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
    /\d{1,2}\s+\d{1,2}\s+\d{2,4}/,
    /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,
    /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/i
  ];
  return patterns.some(p => p.test(lower));
}

function detectJenisDokumen(text) {
  const lower = text.toLowerCase();
  const slipKeywords = ['transfer', 'transaction', 'reference', 'duitnow', 'bank', 'account', 'to', 'from'];
  const resitKeywords = ['item', 'qty', 'unit price', 'receipt', 'cashier', 'tax', 'total'];
  const invoiceKeywords = ['invoice', 'item code', 'description', 'discount', 'amount'];
  const notAllowedKeywords = ['kerajaan', 'negara', 'berita', 'headline', 'pm', 'menteri', 'parlimen', 'sidang', 'politik', 'rakyat', 'akbar'];

  const slipMatch = slipKeywords.filter(k => lower.includes(k)).length;
  const resitMatch = resitKeywords.filter(k => lower.includes(k)).length;
  const invoiceMatch = invoiceKeywords.filter(k => lower.includes(k)).length;
  const blockMatch = notAllowedKeywords.filter(k => lower.includes(k)).length;

  if (blockMatch >= 2) return 'lain';
  if (slipMatch >= 2 && resitMatch === 0 && invoiceMatch === 0) return 'slip_bank';
  if ((resitMatch + invoiceMatch) >= 3 && slipMatch === 0) return 'resit_pembelian';
  return 'lain';
}

// ... (fungsi lain kekal seperti sedia ada)

