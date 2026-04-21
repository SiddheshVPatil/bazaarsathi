/* ================================================
   GST Invoice Generator — data.js
   All static reference data: states, HSN, rates
   ================================================ */

const STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' },
  { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh (New)' },
  { code: '38', name: 'Ladakh' },
];

/* Valid GST tax rates in India */
const GST_RATES = [0, 5, 12, 18, 28];

/* Units of measurement */
const UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'm', 'sqft', 'hr', 'day', 'month', 'nos', 'box', 'set', 'pair'];

/* Top 100 HSN / SAC codes — most commonly used */
const HSN_DATA = [
  /* --- IT & Software Services (SAC) --- */
  { code: '998311', desc: 'IT Software Development' },
  { code: '998312', desc: 'IT Software Consulting' },
  { code: '998313', desc: 'IT Software Testing' },
  { code: '998314', desc: 'IT Infrastructure Services' },
  { code: '998315', desc: 'IT Support / Helpdesk Services' },
  { code: '998316', desc: 'IT System Maintenance' },

  /* --- Professional Services (SAC) --- */
  { code: '997211', desc: 'Accounting Services' },
  { code: '997212', desc: 'Bookkeeping Services' },
  { code: '997213', desc: 'Tax Consulting / Filing' },
  { code: '997221', desc: 'Financial Auditing' },
  { code: '997151', desc: 'Legal Advisory Services' },
  { code: '997152', desc: 'Legal Documentation Services' },
  { code: '997331', desc: 'Trademark / IP Services' },
  { code: '998391', desc: 'Photography Services' },
  { code: '998392', desc: 'Graphic Design Services' },
  { code: '998393', desc: 'Video Production Services' },
  { code: '998399', desc: 'Other Professional Services' },

  /* --- Business Support (SAC) --- */
  { code: '998211', desc: 'HR / Recruitment Services' },
  { code: '998519', desc: 'Digital Marketing Services' },
  { code: '998411', desc: 'Management Consulting' },

  /* --- Real Estate & Construction (SAC) --- */
  { code: '997111', desc: 'Real Estate (Sale, Owned)' },
  { code: '997112', desc: 'Real Estate (Leased / Rented)' },
  { code: '998821', desc: 'Building Construction Services' },
  { code: '998822', desc: 'Civil Engineering Services' },

  /* --- Transport & Hospitality (SAC) --- */
  { code: '996311', desc: 'Hotel / Accommodation Services' },
  { code: '996321', desc: 'Restaurant / Catering Services' },
  { code: '996411', desc: 'Road Transport of Goods' },
  { code: '996511', desc: 'Air Transport of Passengers' },

  /* --- Education & Health (SAC) --- */
  { code: '999211', desc: 'Primary Education Services' },
  { code: '999299', desc: 'Other Education / Training' },
  { code: '999311', desc: 'Hospital / Inpatient Services' },
  { code: '999399', desc: 'Other Healthcare Services' },

  /* --- Electronics & IT Goods (HSN) --- */
  { code: '8471',   desc: 'Computers / Laptops / Desktops' },
  { code: '8473',   desc: 'Computer Parts & Accessories' },
  { code: '8517',   desc: 'Mobile Phones / Smartphones' },
  { code: '8528',   desc: 'TVs / Monitors / Displays' },
  { code: '8443',   desc: 'Printers / Scanners' },
  { code: '8415',   desc: 'Air Conditioners' },
  { code: '8418',   desc: 'Refrigerators / Freezers' },
  { code: '8450',   desc: 'Washing Machines' },
  { code: '8507',   desc: 'Batteries / Accumulators' },
  { code: '8523',   desc: 'USB Drives / Storage Media' },
  { code: '8544',   desc: 'Cables / Wires / Optical Fibre' },
  { code: '8525',   desc: 'Cameras / Broadcasting Equipment' },
  { code: '8504',   desc: 'Transformers / Power Supplies' },
  { code: '8537',   desc: 'Electrical Panels / Switchboards' },
  { code: '8518',   desc: 'Speakers / Microphones / Headphones' },

  /* --- Garments & Footwear (HSN) --- */
  { code: '6101',   desc: "Men's Garments / Jackets" },
  { code: '6102',   desc: "Women's Garments / Jackets" },
  { code: '6109',   desc: "T-Shirts / Vests" },
  { code: '6201',   desc: "Overcoats / Windcheaters" },
  { code: '6301',   desc: "Blankets / Shawls" },
  { code: '6401',   desc: 'Waterproof Footwear' },
  { code: '6402',   desc: 'Other Footwear (Non-leather)' },
  { code: '6403',   desc: 'Leather Footwear' },

  /* --- Pharma & Health (HSN) --- */
  { code: '3004',   desc: 'Medicines / Pharmaceutical Products' },
  { code: '3006',   desc: 'Pharmaceutical Preparations' },
  { code: '9021',   desc: 'Medical / Orthopaedic Instruments' },
  { code: '9001',   desc: 'Spectacle Lenses' },
  { code: '9003',   desc: 'Spectacle Frames' },
  { code: '9619',   desc: 'Sanitary Napkins / Diapers' },

  /* --- FMCG & Food (HSN) --- */
  { code: '3304',   desc: 'Cosmetics / Beauty Products' },
  { code: '3305',   desc: 'Hair Care Products' },
  { code: '3401',   desc: 'Soap / Handwash' },
  { code: '3402',   desc: 'Detergents / Cleaning Agents' },
  { code: '3301',   desc: 'Essential Oils / Perfumes' },
  { code: '3808',   desc: 'Pesticides / Insecticides' },
  { code: '1001',   desc: 'Wheat / Meslin' },
  { code: '1006',   desc: 'Rice' },
  { code: '1701',   desc: 'Sugar (Cane / Beet)' },
  { code: '1901',   desc: 'Food Preparations (Malt, Flour)' },
  { code: '2101',   desc: 'Tea (Extracts, Essences)' },
  { code: '2102',   desc: 'Coffee (Roasted, Extracts)' },
  { code: '2201',   desc: 'Drinking Water / Mineral Water' },
  { code: '2202',   desc: 'Packaged Beverages / Soft Drinks' },

  /* --- Stationery & Print (HSN) --- */
  { code: '4901',   desc: 'Printed Books / Brochures' },
  { code: '4902',   desc: 'Newspapers / Journals' },
  { code: '4907',   desc: 'Stamps / Securities / Documents' },
  { code: '4820',   desc: 'Registers / Notebooks / Diaries' },

  /* --- Furniture & Home (HSN) --- */
  { code: '9403',   desc: 'Furniture (Wood, Metal, Plastic)' },
  { code: '9404',   desc: 'Mattresses / Pillows / Cushions' },
  { code: '9405',   desc: 'Lamps / Lighting Fixtures' },
  { code: '7323',   desc: 'Steel Utensils / Cookware' },
  { code: '7615',   desc: 'Aluminium Utensils' },
  { code: '3923',   desc: 'Plastic Containers / Packaging' },

  /* --- Automotive & Industrial (HSN) --- */
  { code: '4011',   desc: 'Rubber Tyres (New)' },
  { code: '8414',   desc: 'Air Compressors / Pumps / Fans' },
  { code: '2710',   desc: 'Petroleum Products / Lubricants' },
  { code: '2711',   desc: 'LPG / Natural Gas' },
  { code: '2701',   desc: 'Coal / Coke / Briquettes' },

  /* --- Jewellery & Precious Metals (HSN) --- */
  { code: '7108',   desc: 'Gold (Unwrought / Semi-manufactured)' },
  { code: '7113',   desc: 'Jewellery (Gold, Silver, Platinum)' },
  { code: '7114',   desc: 'Articles of Goldsmiths / Silversmiths' },

  /* --- Sports & Leisure (HSN) --- */
  { code: '9503',   desc: 'Toys / Games (Non-electronic)' },
  { code: '9504',   desc: 'Video Games / Playing Cards' },
  { code: '9506',   desc: 'Sports Equipment / Gym Equipment' },
  { code: '9030',   desc: 'Electronic Meters / Instruments' },
];
