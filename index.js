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
