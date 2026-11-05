'use strict';

// Demo catalog based on the Coca-Cola HBC portfolio sold in Greece.
// SKU codes, pack sizes and case prices are ILLUSTRATIVE demo data (EUR, excl. VAT).
// Each line is sold by the case. `keywords` help match what callers say, in English and Greek.

const PRODUCTS = [
  // Sparkling soft drinks
  { sku: 'CC-ORIG-330C', brand: 'Coca-Cola', name: 'Coca-Cola Original Taste', pack: '24 x 330ml can', category: 'Sparkling', price: 14.9, keywords: 'coke classic regular κόκα κόλα κοκα κολα κουτάκι' },
  { sku: 'CC-ORIG-500P', brand: 'Coca-Cola', name: 'Coca-Cola Original Taste', pack: '24 x 500ml bottle', category: 'Sparkling', price: 19.9, keywords: 'coke classic regular κόκα κόλα μπουκάλι μισόλιτρο' },
  { sku: 'CC-ORIG-1500P', brand: 'Coca-Cola', name: 'Coca-Cola Original Taste', pack: '6 x 1.5L bottle', category: 'Sparkling', price: 9.6, keywords: 'coke classic big family κόκα κόλα ενάμισι λίτρο' },
  { sku: 'CC-ORIG-250G', brand: 'Coca-Cola', name: 'Coca-Cola Original Taste', pack: '24 x 250ml glass', category: 'Sparkling', price: 16.8, keywords: 'coke glass bottle horeca γυάλινο κόκα κόλα' },
  { sku: 'CC-ZERO-330C', brand: 'Coca-Cola', name: 'Coca-Cola Zero Sugar', pack: '24 x 330ml can', category: 'Sparkling', price: 14.9, keywords: 'coke zero no sugar κόκα κόλα ζίρο χωρίς ζάχαρη κουτάκι' },
  { sku: 'CC-ZERO-500P', brand: 'Coca-Cola', name: 'Coca-Cola Zero Sugar', pack: '24 x 500ml bottle', category: 'Sparkling', price: 19.9, keywords: 'coke zero no sugar κόκα κόλα ζίρο χωρίς ζάχαρη μπουκάλι μισόλιτρο' },
  { sku: 'CC-LIGHT-330C', brand: 'Coca-Cola', name: 'Coca-Cola Light', pack: '24 x 330ml can', category: 'Sparkling', price: 14.9, keywords: 'coke light diet κόκα κόλα λάιτ κουτάκι' },
  { sku: 'FANTA-ORA-330C', brand: 'Fanta', name: 'Fanta Orange', pack: '24 x 330ml can', category: 'Sparkling', price: 13.9, keywords: 'orange φάντα πορτοκαλάδα' },
  { sku: 'FANTA-LEM-330C', brand: 'Fanta', name: 'Fanta Lemon', pack: '24 x 330ml can', category: 'Sparkling', price: 13.9, keywords: 'lemon φάντα λεμονάδα' },
  { sku: 'SPRITE-330C', brand: 'Sprite', name: 'Sprite', pack: '24 x 330ml can', category: 'Sparkling', price: 13.9, keywords: 'lemon lime σπράιτ' },

  // Adult sparkling and mixers
  { sku: 'SCH-TONIC-250G', brand: 'Schweppes', name: 'Schweppes Indian Tonic Water', pack: '24 x 250ml glass', category: 'Adult sparkling', price: 15.6, keywords: 'tonic σουέπς τόνικ' },
  { sku: 'SCH-SODA-250G', brand: 'Schweppes', name: 'Schweppes Soda Water', pack: '24 x 250ml glass', category: 'Adult sparkling', price: 14.4, keywords: 'soda club σουέπς σόδα' },
  { sku: 'SCH-PINK-330C', brand: 'Schweppes', name: 'Schweppes Pink Grapefruit', pack: '24 x 330ml can', category: 'Adult sparkling', price: 14.9, keywords: 'grapefruit pink σουέπς γκρέιπφρουτ' },
  { sku: '3C-TONIC-200G', brand: 'Three Cents', name: 'Three Cents Tonic Water', pack: '24 x 200ml glass', category: 'Adult sparkling', price: 21.6, keywords: 'three cents 3 cents tonic premium mixer θρι σεντς τόνικ' },
  { sku: '3C-PINK-200G', brand: 'Three Cents', name: 'Three Cents Pink Grapefruit Soda', pack: '24 x 200ml glass', category: 'Adult sparkling', price: 21.6, keywords: 'three cents 3 cents grapefruit premium mixer θρι σεντς' },
  { sku: '3C-GINGER-200G', brand: 'Three Cents', name: 'Three Cents Ginger Beer', pack: '24 x 200ml glass', category: 'Adult sparkling', price: 21.6, keywords: 'three cents 3 cents ginger beer τζίντζερ μπίρα' },

  // Hydration
  { sku: 'AVRA-500P', brand: 'AVRA', name: 'AVRA Natural Mineral Water', pack: '24 x 500ml bottle', category: 'Water', price: 6.9, keywords: 'water still mineral άβρα αύρα νερό μισόλιτρο' },
  { sku: 'AVRA-1500P', brand: 'AVRA', name: 'AVRA Natural Mineral Water', pack: '6 x 1.5L bottle', category: 'Water', price: 3.3, keywords: 'water still mineral big άβρα αύρα νερό ενάμισι' },
  { sku: 'POWERADE-500P', brand: 'Powerade', name: 'Powerade Mountain Blast', pack: '12 x 500ml bottle', category: 'Sport & energy', price: 13.2, keywords: 'sports drink isotonic πάουερεϊντ' },

  // Juice
  { sku: 'AMITA-ORA-1L', brand: 'Amita', name: 'Amita Orange', pack: '12 x 1L carton', category: 'Juice', price: 18.0, keywords: 'juice orange αμίτα χυμός πορτοκάλι' },
  { sku: 'AMITA-4F-1L', brand: 'Amita', name: 'Amita 4 Fruits', pack: '12 x 1L carton', category: 'Juice', price: 18.0, keywords: 'juice mixed four fruits αμίτα χυμός 4 φρούτα τέσσερα' },
  { sku: 'AMITA-MOT-1L', brand: 'Amita Motion', name: 'Amita Motion', pack: '12 x 1L carton', category: 'Juice', price: 21.6, keywords: 'juice motion αμίτα μόσιον χυμός' },
  { sku: 'FRULITE-1L', brand: 'Frulite', name: 'Frulite Orange', pack: '12 x 1L carton', category: 'Juice', price: 15.6, keywords: 'fruit drink φρουλάιτ' },

  // Energy
  { sku: 'MONSTER-500C', brand: 'Monster', name: 'Monster Energy', pack: '24 x 500ml can', category: 'Sport & energy', price: 33.6, keywords: 'energy drink green μόνστερ ενεργειακό' },
  { sku: 'MONSTER-ULTRA-500C', brand: 'Monster', name: 'Monster Energy Ultra', pack: '24 x 500ml can', category: 'Sport & energy', price: 33.6, keywords: 'energy zero sugar white ultra μόνστερ άλτρα' },

  // Ready-to-drink tea
  { sku: 'FUZE-LEMON-500P', brand: 'FUZETEA', name: 'FUZETEA Lemon', pack: '12 x 500ml bottle', category: 'Ready-to-drink tea', price: 11.4, keywords: 'iced tea lemon φιουζ τι τσάι λεμόνι' },
  { sku: 'FUZE-PEACH-500P', brand: 'FUZETEA', name: 'FUZETEA Peach Hibiscus', pack: '12 x 500ml bottle', category: 'Ready-to-drink tea', price: 11.4, keywords: 'iced tea peach φιουζ τι τσάι ροδάκινο' },

  // Coffee
  { sku: 'COSTA-BEANS-1K', brand: 'Costa Coffee', name: 'Costa Coffee Signature Blend Beans', pack: '6 x 1kg bag', category: 'Coffee', price: 96.0, keywords: 'coffee beans espresso κόστα καφές' },

  // Snacks
  { sku: 'TSAKIRIS-SALT-90', brand: 'Tsakiris', name: 'Tsakiris Chips Salted', pack: '20 x 90g bag', category: 'Snacks', price: 24.0, keywords: 'chips crisps τσακίρης πατατάκια' },

  // Premium spirits
  { sku: 'FINLANDIA-700', brand: 'Finlandia', name: 'Finlandia Vodka', pack: '6 x 700ml bottle', category: 'Premium spirits', price: 75.0, keywords: 'vodka φινλάντια βότκα' },
  { sku: 'APEROL-700', brand: 'Aperol', name: 'Aperol', pack: '6 x 700ml bottle', category: 'Premium spirits', price: 72.0, keywords: 'aperitif spritz απερόλ' },
  { sku: 'JD-700', brand: "Jack Daniel's", name: "Jack Daniel's Old No. 7", pack: '6 x 700ml bottle', category: 'Premium spirits', price: 120.0, keywords: 'whiskey whisky jack daniels τζακ ντάνιελς ουίσκι' },
  { sku: 'PLOMARI-700', brand: 'Plomari', name: 'Ouzo Plomari', pack: '6 x 700ml bottle', category: 'Premium spirits', price: 54.0, keywords: 'ouzo πλωμάρι ούζο' },
];

// Fictitious demo customers.
const CUSTOMERS = [
  { account: '100245', name: 'To Steki Café', type: 'Café', area: 'Plaka, Athens', contact: 'Maria Papadopoulou', delivery_days: ['Mon', 'Thu'], keywords: 'steki στέκι καφέ καφετέρια' },
  { account: '100318', name: 'Galini Mini Market', type: 'Mini market', area: 'Glyfada', contact: 'Nikos Georgiou', delivery_days: ['Tue', 'Fri'], keywords: 'galini γαλήνη μίνι μάρκετ' },
  { account: '100422', name: 'Taverna Thalassa', type: 'Taverna', area: 'Piraeus', contact: 'Giorgos Antoniou', delivery_days: ['Mon', 'Wed', 'Fri'], keywords: 'thalassa θάλασσα ταβέρνα' },
  { account: '100587', name: 'Syntagma Kiosk', type: 'Kiosk', area: 'Syntagma, Athens', contact: 'Eleni Dimitriou', delivery_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], keywords: 'syntagma σύνταγμα περίπτερο kiosk' },
  { account: '100733', name: 'Blue Lagoon Beach Bar', type: 'Bar', area: 'Vouliagmeni', contact: 'Kostas Ioannou', delivery_days: ['Wed', 'Sat'], keywords: 'blue lagoon μπλε λιμνοθάλασσα beach bar μπαρ' },
];

module.exports = { PRODUCTS, CUSTOMERS };
