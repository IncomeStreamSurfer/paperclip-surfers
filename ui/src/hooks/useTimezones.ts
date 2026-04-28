import { useState, useCallback, useEffect, useMemo } from "react";

export interface TimezoneEntry {
  id: string;        // unique key
  tz: string;        // IANA timezone string e.g. "America/New_York"
  label: string;     // short display label e.g. "NYC"
}

// ---------------------------------------------------------------------------
// City → IANA timezone map
// ---------------------------------------------------------------------------

export interface CityEntry {
  city: string;
  country: string;
  countryCode: string;
  tz: string;
}

/**
 * Curated list of world cities mapped to their IANA timezone.
 * Allows users to search "Milan", "NYC", "Karachi" etc. without knowing
 * the underlying IANA zone. Sorted roughly by population / recognition.
 */
export const CITY_TZ_MAP: CityEntry[] = [
  // United States
  { city: "New York",       country: "United States", countryCode: "US", tz: "America/New_York" },
  { city: "NYC",            country: "United States", countryCode: "US", tz: "America/New_York" },
  { city: "Brooklyn",       country: "United States", countryCode: "US", tz: "America/New_York" },
  { city: "Philadelphia",   country: "United States", countryCode: "US", tz: "America/New_York" },
  { city: "Boston",         country: "United States", countryCode: "US", tz: "America/New_York" },
  { city: "Washington DC",  country: "United States", countryCode: "US", tz: "America/New_York" },
  { city: "Atlanta",        country: "United States", countryCode: "US", tz: "America/New_York" },
  { city: "Miami",          country: "United States", countryCode: "US", tz: "America/New_York" },
  { city: "Orlando",        country: "United States", countryCode: "US", tz: "America/New_York" },
  { city: "Charlotte",      country: "United States", countryCode: "US", tz: "America/New_York" },
  { city: "Detroit",        country: "United States", countryCode: "US", tz: "America/New_York" },
  { city: "Columbus",       country: "United States", countryCode: "US", tz: "America/New_York" },
  { city: "Chicago",        country: "United States", countryCode: "US", tz: "America/Chicago" },
  { city: "Houston",        country: "United States", countryCode: "US", tz: "America/Chicago" },
  { city: "Dallas",         country: "United States", countryCode: "US", tz: "America/Chicago" },
  { city: "Austin",         country: "United States", countryCode: "US", tz: "America/Chicago" },
  { city: "San Antonio",    country: "United States", countryCode: "US", tz: "America/Chicago" },
  { city: "Minneapolis",    country: "United States", countryCode: "US", tz: "America/Chicago" },
  { city: "New Orleans",    country: "United States", countryCode: "US", tz: "America/Chicago" },
  { city: "Kansas City",    country: "United States", countryCode: "US", tz: "America/Chicago" },
  { city: "Denver",         country: "United States", countryCode: "US", tz: "America/Denver" },
  { city: "Salt Lake City", country: "United States", countryCode: "US", tz: "America/Denver" },
  { city: "Phoenix",        country: "United States", countryCode: "US", tz: "America/Phoenix" },
  { city: "Tucson",         country: "United States", countryCode: "US", tz: "America/Phoenix" },
  { city: "Los Angeles",    country: "United States", countryCode: "US", tz: "America/Los_Angeles" },
  { city: "LA",             country: "United States", countryCode: "US", tz: "America/Los_Angeles" },
  { city: "San Francisco",  country: "United States", countryCode: "US", tz: "America/Los_Angeles" },
  { city: "Seattle",        country: "United States", countryCode: "US", tz: "America/Los_Angeles" },
  { city: "Portland",       country: "United States", countryCode: "US", tz: "America/Los_Angeles" },
  { city: "San Diego",      country: "United States", countryCode: "US", tz: "America/Los_Angeles" },
  { city: "Las Vegas",      country: "United States", countryCode: "US", tz: "America/Los_Angeles" },
  { city: "Sacramento",     country: "United States", countryCode: "US", tz: "America/Los_Angeles" },
  { city: "Anchorage",      country: "United States", countryCode: "US", tz: "America/Anchorage" },
  { city: "Honolulu",       country: "United States", countryCode: "US", tz: "Pacific/Honolulu" },
  { city: "Juneau",         country: "United States", countryCode: "US", tz: "America/Juneau" },

  // Canada
  { city: "Toronto",        country: "Canada", countryCode: "CA", tz: "America/Toronto" },
  { city: "Ottawa",         country: "Canada", countryCode: "CA", tz: "America/Toronto" },
  { city: "Montreal",       country: "Canada", countryCode: "CA", tz: "America/Toronto" },
  { city: "Halifax",        country: "Canada", countryCode: "CA", tz: "America/Halifax" },
  { city: "Winnipeg",       country: "Canada", countryCode: "CA", tz: "America/Winnipeg" },
  { city: "Calgary",        country: "Canada", countryCode: "CA", tz: "America/Edmonton" },
  { city: "Edmonton",       country: "Canada", countryCode: "CA", tz: "America/Edmonton" },
  { city: "Vancouver",      country: "Canada", countryCode: "CA", tz: "America/Vancouver" },
  { city: "Quebec City",    country: "Canada", countryCode: "CA", tz: "America/Toronto" },
  { city: "St. John's",     country: "Canada", countryCode: "CA", tz: "America/St_Johns" },

  // Mexico & Central America
  { city: "Mexico City",    country: "Mexico",     countryCode: "MX", tz: "America/Mexico_City" },
  { city: "Guadalajara",    country: "Mexico",     countryCode: "MX", tz: "America/Mexico_City" },
  { city: "Monterrey",      country: "Mexico",     countryCode: "MX", tz: "America/Monterrey" },
  { city: "Tijuana",        country: "Mexico",     countryCode: "MX", tz: "America/Tijuana" },
  { city: "Cancun",         country: "Mexico",     countryCode: "MX", tz: "America/Cancun" },
  { city: "Guatemala City", country: "Guatemala",  countryCode: "GT", tz: "America/Guatemala" },
  { city: "San Jose",       country: "Costa Rica", countryCode: "CR", tz: "America/Costa_Rica" },
  { city: "Panama City",    country: "Panama",     countryCode: "PA", tz: "America/Panama" },

  // Caribbean
  { city: "Havana",         country: "Cuba",            countryCode: "CU", tz: "America/Havana" },
  { city: "Santo Domingo",  country: "Dominican Rep.",   countryCode: "DO", tz: "America/Santo_Domingo" },
  { city: "San Juan",       country: "Puerto Rico",      countryCode: "PR", tz: "America/Puerto_Rico" },

  // South America
  { city: "Bogota",         country: "Colombia",  countryCode: "CO", tz: "America/Bogota" },
  { city: "Lima",           country: "Peru",      countryCode: "PE", tz: "America/Lima" },
  { city: "Caracas",        country: "Venezuela", countryCode: "VE", tz: "America/Caracas" },
  { city: "Quito",          country: "Ecuador",   countryCode: "EC", tz: "America/Guayaquil" },
  { city: "La Paz",         country: "Bolivia",   countryCode: "BO", tz: "America/La_Paz" },
  { city: "Santiago",       country: "Chile",     countryCode: "CL", tz: "America/Santiago" },
  { city: "Buenos Aires",   country: "Argentina", countryCode: "AR", tz: "America/Argentina/Buenos_Aires" },
  { city: "Sao Paulo",      country: "Brazil",    countryCode: "BR", tz: "America/Sao_Paulo" },
  { city: "São Paulo",      country: "Brazil",    countryCode: "BR", tz: "America/Sao_Paulo" },
  { city: "Rio de Janeiro", country: "Brazil",    countryCode: "BR", tz: "America/Sao_Paulo" },
  { city: "Brasilia",       country: "Brazil",    countryCode: "BR", tz: "America/Sao_Paulo" },
  { city: "Manaus",         country: "Brazil",    countryCode: "BR", tz: "America/Manaus" },
  { city: "Montevideo",     country: "Uruguay",   countryCode: "UY", tz: "America/Montevideo" },
  { city: "Asuncion",       country: "Paraguay",  countryCode: "PY", tz: "America/Asuncion" },

  // Western Europe
  { city: "London",         country: "United Kingdom", countryCode: "GB", tz: "Europe/London" },
  { city: "Dublin",         country: "Ireland",        countryCode: "IE", tz: "Europe/Dublin" },
  { city: "Edinburgh",      country: "United Kingdom", countryCode: "GB", tz: "Europe/London" },
  { city: "Manchester",     country: "United Kingdom", countryCode: "GB", tz: "Europe/London" },
  { city: "Birmingham",     country: "United Kingdom", countryCode: "GB", tz: "Europe/London" },
  { city: "Paris",          country: "France",         countryCode: "FR", tz: "Europe/Paris" },
  { city: "Lyon",           country: "France",         countryCode: "FR", tz: "Europe/Paris" },
  { city: "Marseille",      country: "France",         countryCode: "FR", tz: "Europe/Paris" },
  { city: "Berlin",         country: "Germany",        countryCode: "DE", tz: "Europe/Berlin" },
  { city: "Munich",         country: "Germany",        countryCode: "DE", tz: "Europe/Berlin" },
  { city: "Hamburg",        country: "Germany",        countryCode: "DE", tz: "Europe/Berlin" },
  { city: "Frankfurt",      country: "Germany",        countryCode: "DE", tz: "Europe/Berlin" },
  { city: "Cologne",        country: "Germany",        countryCode: "DE", tz: "Europe/Berlin" },
  { city: "Dusseldorf",     country: "Germany",        countryCode: "DE", tz: "Europe/Berlin" },
  { city: "Amsterdam",      country: "Netherlands",    countryCode: "NL", tz: "Europe/Amsterdam" },
  { city: "Brussels",       country: "Belgium",        countryCode: "BE", tz: "Europe/Brussels" },
  { city: "Antwerp",        country: "Belgium",        countryCode: "BE", tz: "Europe/Brussels" },
  { city: "Luxembourg",     country: "Luxembourg",     countryCode: "LU", tz: "Europe/Luxembourg" },
  { city: "Zurich",         country: "Switzerland",    countryCode: "CH", tz: "Europe/Zurich" },
  { city: "Geneva",         country: "Switzerland",    countryCode: "CH", tz: "Europe/Zurich" },
  { city: "Bern",           country: "Switzerland",    countryCode: "CH", tz: "Europe/Zurich" },
  { city: "Vienna",         country: "Austria",        countryCode: "AT", tz: "Europe/Vienna" },
  { city: "Madrid",         country: "Spain",          countryCode: "ES", tz: "Europe/Madrid" },
  { city: "Barcelona",      country: "Spain",          countryCode: "ES", tz: "Europe/Madrid" },
  { city: "Valencia",       country: "Spain",          countryCode: "ES", tz: "Europe/Madrid" },
  { city: "Seville",        country: "Spain",          countryCode: "ES", tz: "Europe/Madrid" },
  { city: "Lisbon",         country: "Portugal",       countryCode: "PT", tz: "Europe/Lisbon" },
  { city: "Porto",          country: "Portugal",       countryCode: "PT", tz: "Europe/Lisbon" },
  { city: "Rome",           country: "Italy",          countryCode: "IT", tz: "Europe/Rome" },
  { city: "Milan",          country: "Italy",          countryCode: "IT", tz: "Europe/Rome" },
  { city: "Naples",         country: "Italy",          countryCode: "IT", tz: "Europe/Rome" },
  { city: "Turin",          country: "Italy",          countryCode: "IT", tz: "Europe/Rome" },
  { city: "Florence",       country: "Italy",          countryCode: "IT", tz: "Europe/Rome" },
  { city: "Venice",         country: "Italy",          countryCode: "IT", tz: "Europe/Rome" },
  { city: "Stockholm",      country: "Sweden",         countryCode: "SE", tz: "Europe/Stockholm" },
  { city: "Gothenburg",     country: "Sweden",         countryCode: "SE", tz: "Europe/Stockholm" },
  { city: "Oslo",           country: "Norway",         countryCode: "NO", tz: "Europe/Oslo" },
  { city: "Bergen",         country: "Norway",         countryCode: "NO", tz: "Europe/Oslo" },
  { city: "Copenhagen",     country: "Denmark",        countryCode: "DK", tz: "Europe/Copenhagen" },
  { city: "Helsinki",       country: "Finland",        countryCode: "FI", tz: "Europe/Helsinki" },
  { city: "Reykjavik",      country: "Iceland",        countryCode: "IS", tz: "Atlantic/Reykjavik" },

  // Central & Eastern Europe
  { city: "Warsaw",         country: "Poland",         countryCode: "PL", tz: "Europe/Warsaw" },
  { city: "Krakow",         country: "Poland",         countryCode: "PL", tz: "Europe/Warsaw" },
  { city: "Prague",         country: "Czech Republic", countryCode: "CZ", tz: "Europe/Prague" },
  { city: "Budapest",       country: "Hungary",        countryCode: "HU", tz: "Europe/Budapest" },
  { city: "Bratislava",     country: "Slovakia",       countryCode: "SK", tz: "Europe/Bratislava" },
  { city: "Vienna",         country: "Austria",        countryCode: "AT", tz: "Europe/Vienna" },
  { city: "Bucharest",      country: "Romania",        countryCode: "RO", tz: "Europe/Bucharest" },
  { city: "Sofia",          country: "Bulgaria",       countryCode: "BG", tz: "Europe/Sofia" },
  { city: "Zagreb",         country: "Croatia",        countryCode: "HR", tz: "Europe/Zagreb" },
  { city: "Belgrade",       country: "Serbia",         countryCode: "RS", tz: "Europe/Belgrade" },
  { city: "Sarajevo",       country: "Bosnia",         countryCode: "BA", tz: "Europe/Sarajevo" },
  { city: "Athens",         country: "Greece",         countryCode: "GR", tz: "Europe/Athens" },
  { city: "Thessaloniki",   country: "Greece",         countryCode: "GR", tz: "Europe/Athens" },
  { city: "Nicosia",        country: "Cyprus",         countryCode: "CY", tz: "Asia/Nicosia" },
  { city: "Vilnius",        country: "Lithuania",      countryCode: "LT", tz: "Europe/Vilnius" },
  { city: "Riga",           country: "Latvia",         countryCode: "LV", tz: "Europe/Riga" },
  { city: "Tallinn",        country: "Estonia",        countryCode: "EE", tz: "Europe/Tallinn" },
  { city: "Kiev",           country: "Ukraine",        countryCode: "UA", tz: "Europe/Kiev" },
  { city: "Kyiv",           country: "Ukraine",        countryCode: "UA", tz: "Europe/Kiev" },
  { city: "Minsk",          country: "Belarus",        countryCode: "BY", tz: "Europe/Minsk" },
  { city: "Moscow",         country: "Russia",         countryCode: "RU", tz: "Europe/Moscow" },
  { city: "St. Petersburg", country: "Russia",         countryCode: "RU", tz: "Europe/Moscow" },
  { city: "Istanbul",       country: "Turkey",         countryCode: "TR", tz: "Europe/Istanbul" },
  { city: "Ankara",         country: "Turkey",         countryCode: "TR", tz: "Europe/Istanbul" },
  { city: "Izmir",          country: "Turkey",         countryCode: "TR", tz: "Europe/Istanbul" },

  // Middle East
  { city: "Dubai",          country: "UAE",           countryCode: "AE", tz: "Asia/Dubai" },
  { city: "Abu Dhabi",      country: "UAE",           countryCode: "AE", tz: "Asia/Dubai" },
  { city: "Sharjah",        country: "UAE",           countryCode: "AE", tz: "Asia/Dubai" },
  { city: "Riyadh",         country: "Saudi Arabia",  countryCode: "SA", tz: "Asia/Riyadh" },
  { city: "Jeddah",         country: "Saudi Arabia",  countryCode: "SA", tz: "Asia/Riyadh" },
  { city: "Mecca",          country: "Saudi Arabia",  countryCode: "SA", tz: "Asia/Riyadh" },
  { city: "Medina",         country: "Saudi Arabia",  countryCode: "SA", tz: "Asia/Riyadh" },
  { city: "Kuwait City",    country: "Kuwait",        countryCode: "KW", tz: "Asia/Kuwait" },
  { city: "Doha",           country: "Qatar",         countryCode: "QA", tz: "Asia/Qatar" },
  { city: "Manama",         country: "Bahrain",       countryCode: "BH", tz: "Asia/Bahrain" },
  { city: "Muscat",         country: "Oman",          countryCode: "OM", tz: "Asia/Muscat" },
  { city: "Amman",          country: "Jordan",        countryCode: "JO", tz: "Asia/Amman" },
  { city: "Beirut",         country: "Lebanon",       countryCode: "LB", tz: "Asia/Beirut" },
  { city: "Damascus",       country: "Syria",         countryCode: "SY", tz: "Asia/Damascus" },
  { city: "Baghdad",        country: "Iraq",          countryCode: "IQ", tz: "Asia/Baghdad" },
  { city: "Basra",          country: "Iraq",          countryCode: "IQ", tz: "Asia/Baghdad" },
  { city: "Tehran",         country: "Iran",          countryCode: "IR", tz: "Asia/Tehran" },
  { city: "Jerusalem",      country: "Israel",        countryCode: "IL", tz: "Asia/Jerusalem" },
  { city: "Tel Aviv",       country: "Israel",        countryCode: "IL", tz: "Asia/Jerusalem" },
  { city: "Sanaa",          country: "Yemen",         countryCode: "YE", tz: "Asia/Aden" },

  // South & Central Asia
  { city: "Karachi",        country: "Pakistan",      countryCode: "PK", tz: "Asia/Karachi" },
  { city: "Lahore",         country: "Pakistan",      countryCode: "PK", tz: "Asia/Karachi" },
  { city: "Islamabad",      country: "Pakistan",      countryCode: "PK", tz: "Asia/Karachi" },
  { city: "Kabul",          country: "Afghanistan",   countryCode: "AF", tz: "Asia/Kabul" },
  { city: "Mumbai",         country: "India",         countryCode: "IN", tz: "Asia/Kolkata" },
  { city: "Delhi",          country: "India",         countryCode: "IN", tz: "Asia/Kolkata" },
  { city: "New Delhi",      country: "India",         countryCode: "IN", tz: "Asia/Kolkata" },
  { city: "Bangalore",      country: "India",         countryCode: "IN", tz: "Asia/Kolkata" },
  { city: "Bengaluru",      country: "India",         countryCode: "IN", tz: "Asia/Kolkata" },
  { city: "Chennai",        country: "India",         countryCode: "IN", tz: "Asia/Kolkata" },
  { city: "Kolkata",        country: "India",         countryCode: "IN", tz: "Asia/Kolkata" },
  { city: "Hyderabad",      country: "India",         countryCode: "IN", tz: "Asia/Kolkata" },
  { city: "Ahmedabad",      country: "India",         countryCode: "IN", tz: "Asia/Kolkata" },
  { city: "Pune",           country: "India",         countryCode: "IN", tz: "Asia/Kolkata" },
  { city: "Colombo",        country: "Sri Lanka",     countryCode: "LK", tz: "Asia/Colombo" },
  { city: "Kathmandu",      country: "Nepal",         countryCode: "NP", tz: "Asia/Kathmandu" },
  { city: "Dhaka",          country: "Bangladesh",    countryCode: "BD", tz: "Asia/Dhaka" },
  { city: "Chittagong",     country: "Bangladesh",    countryCode: "BD", tz: "Asia/Dhaka" },
  { city: "Almaty",         country: "Kazakhstan",    countryCode: "KZ", tz: "Asia/Almaty" },
  { city: "Tashkent",       country: "Uzbekistan",    countryCode: "UZ", tz: "Asia/Tashkent" },
  { city: "Bishkek",        country: "Kyrgyzstan",    countryCode: "KG", tz: "Asia/Bishkek" },

  // Southeast Asia
  { city: "Bangkok",        country: "Thailand",      countryCode: "TH", tz: "Asia/Bangkok" },
  { city: "Chiang Mai",     country: "Thailand",      countryCode: "TH", tz: "Asia/Bangkok" },
  { city: "Phuket",         country: "Thailand",      countryCode: "TH", tz: "Asia/Bangkok" },
  { city: "Hanoi",          country: "Vietnam",       countryCode: "VN", tz: "Asia/Ho_Chi_Minh" },
  { city: "Ho Chi Minh",    country: "Vietnam",       countryCode: "VN", tz: "Asia/Ho_Chi_Minh" },
  { city: "Saigon",         country: "Vietnam",       countryCode: "VN", tz: "Asia/Ho_Chi_Minh" },
  { city: "Da Nang",        country: "Vietnam",       countryCode: "VN", tz: "Asia/Ho_Chi_Minh" },
  { city: "Phnom Penh",     country: "Cambodia",      countryCode: "KH", tz: "Asia/Phnom_Penh" },
  { city: "Vientiane",      country: "Laos",          countryCode: "LA", tz: "Asia/Vientiane" },
  { city: "Rangoon",        country: "Myanmar",       countryCode: "MM", tz: "Asia/Rangoon" },
  { city: "Yangon",         country: "Myanmar",       countryCode: "MM", tz: "Asia/Rangoon" },
  { city: "Singapore",      country: "Singapore",     countryCode: "SG", tz: "Asia/Singapore" },
  { city: "Kuala Lumpur",   country: "Malaysia",      countryCode: "MY", tz: "Asia/Kuala_Lumpur" },
  { city: "KL",             country: "Malaysia",      countryCode: "MY", tz: "Asia/Kuala_Lumpur" },
  { city: "Penang",         country: "Malaysia",      countryCode: "MY", tz: "Asia/Kuala_Lumpur" },
  { city: "Jakarta",        country: "Indonesia",     countryCode: "ID", tz: "Asia/Jakarta" },
  { city: "Bali",           country: "Indonesia",     countryCode: "ID", tz: "Asia/Makassar" },
  { city: "Surabaya",       country: "Indonesia",     countryCode: "ID", tz: "Asia/Jakarta" },
  { city: "Makassar",       country: "Indonesia",     countryCode: "ID", tz: "Asia/Makassar" },
  { city: "Manila",         country: "Philippines",   countryCode: "PH", tz: "Asia/Manila" },
  { city: "Cebu",           country: "Philippines",   countryCode: "PH", tz: "Asia/Manila" },
  { city: "Davao",          country: "Philippines",   countryCode: "PH", tz: "Asia/Manila" },

  // East Asia
  { city: "Shanghai",       country: "China",         countryCode: "CN", tz: "Asia/Shanghai" },
  { city: "Beijing",        country: "China",         countryCode: "CN", tz: "Asia/Shanghai" },
  { city: "Guangzhou",      country: "China",         countryCode: "CN", tz: "Asia/Shanghai" },
  { city: "Shenzhen",       country: "China",         countryCode: "CN", tz: "Asia/Shanghai" },
  { city: "Chengdu",        country: "China",         countryCode: "CN", tz: "Asia/Shanghai" },
  { city: "Wuhan",          country: "China",         countryCode: "CN", tz: "Asia/Shanghai" },
  { city: "Hong Kong",      country: "Hong Kong",     countryCode: "HK", tz: "Asia/Hong_Kong" },
  { city: "Macau",          country: "Macau",         countryCode: "MO", tz: "Asia/Macau" },
  { city: "Taipei",         country: "Taiwan",        countryCode: "TW", tz: "Asia/Taipei" },
  { city: "Tokyo",          country: "Japan",         countryCode: "JP", tz: "Asia/Tokyo" },
  { city: "Osaka",          country: "Japan",         countryCode: "JP", tz: "Asia/Tokyo" },
  { city: "Kyoto",          country: "Japan",         countryCode: "JP", tz: "Asia/Tokyo" },
  { city: "Sapporo",        country: "Japan",         countryCode: "JP", tz: "Asia/Tokyo" },
  { city: "Fukuoka",        country: "Japan",         countryCode: "JP", tz: "Asia/Tokyo" },
  { city: "Seoul",          country: "South Korea",   countryCode: "KR", tz: "Asia/Seoul" },
  { city: "Busan",          country: "South Korea",   countryCode: "KR", tz: "Asia/Seoul" },
  { city: "Incheon",        country: "South Korea",   countryCode: "KR", tz: "Asia/Seoul" },
  { city: "Ulaanbaatar",    country: "Mongolia",      countryCode: "MN", tz: "Asia/Ulaanbaatar" },

  // Africa
  { city: "Cairo",          country: "Egypt",         countryCode: "EG", tz: "Africa/Cairo" },
  { city: "Alexandria",     country: "Egypt",         countryCode: "EG", tz: "Africa/Cairo" },
  { city: "Casablanca",     country: "Morocco",       countryCode: "MA", tz: "Africa/Casablanca" },
  { city: "Marrakech",      country: "Morocco",       countryCode: "MA", tz: "Africa/Casablanca" },
  { city: "Tunis",          country: "Tunisia",       countryCode: "TN", tz: "Africa/Tunis" },
  { city: "Algiers",        country: "Algeria",       countryCode: "DZ", tz: "Africa/Algiers" },
  { city: "Tripoli",        country: "Libya",         countryCode: "LY", tz: "Africa/Tripoli" },
  { city: "Khartoum",       country: "Sudan",         countryCode: "SD", tz: "Africa/Khartoum" },
  { city: "Addis Ababa",    country: "Ethiopia",      countryCode: "ET", tz: "Africa/Addis_Ababa" },
  { city: "Nairobi",        country: "Kenya",         countryCode: "KE", tz: "Africa/Nairobi" },
  { city: "Dar es Salaam",  country: "Tanzania",      countryCode: "TZ", tz: "Africa/Dar_es_Salaam" },
  { city: "Kampala",        country: "Uganda",        countryCode: "UG", tz: "Africa/Kampala" },
  { city: "Lagos",          country: "Nigeria",       countryCode: "NG", tz: "Africa/Lagos" },
  { city: "Abuja",          country: "Nigeria",       countryCode: "NG", tz: "Africa/Lagos" },
  { city: "Accra",          country: "Ghana",         countryCode: "GH", tz: "Africa/Accra" },
  { city: "Dakar",          country: "Senegal",       countryCode: "SN", tz: "Africa/Dakar" },
  { city: "Abidjan",        country: "Ivory Coast",   countryCode: "CI", tz: "Africa/Abidjan" },
  { city: "Kinshasa",       country: "DR Congo",      countryCode: "CD", tz: "Africa/Kinshasa" },
  { city: "Luanda",         country: "Angola",        countryCode: "AO", tz: "Africa/Luanda" },
  { city: "Lusaka",         country: "Zambia",        countryCode: "ZM", tz: "Africa/Lusaka" },
  { city: "Harare",         country: "Zimbabwe",      countryCode: "ZW", tz: "Africa/Harare" },
  { city: "Johannesburg",   country: "South Africa",  countryCode: "ZA", tz: "Africa/Johannesburg" },
  { city: "Cape Town",      country: "South Africa",  countryCode: "ZA", tz: "Africa/Johannesburg" },
  { city: "Durban",         country: "South Africa",  countryCode: "ZA", tz: "Africa/Johannesburg" },
  { city: "Pretoria",       country: "South Africa",  countryCode: "ZA", tz: "Africa/Johannesburg" },
  { city: "Antananarivo",   country: "Madagascar",    countryCode: "MG", tz: "Indian/Antananarivo" },

  // Oceania
  { city: "Sydney",         country: "Australia",     countryCode: "AU", tz: "Australia/Sydney" },
  { city: "Melbourne",      country: "Australia",     countryCode: "AU", tz: "Australia/Melbourne" },
  { city: "Brisbane",       country: "Australia",     countryCode: "AU", tz: "Australia/Brisbane" },
  { city: "Perth",          country: "Australia",     countryCode: "AU", tz: "Australia/Perth" },
  { city: "Adelaide",       country: "Australia",     countryCode: "AU", tz: "Australia/Adelaide" },
  { city: "Gold Coast",     country: "Australia",     countryCode: "AU", tz: "Australia/Brisbane" },
  { city: "Canberra",       country: "Australia",     countryCode: "AU", tz: "Australia/Sydney" },
  { city: "Darwin",         country: "Australia",     countryCode: "AU", tz: "Australia/Darwin" },
  { city: "Hobart",         country: "Australia",     countryCode: "AU", tz: "Australia/Hobart" },
  { city: "Auckland",       country: "New Zealand",   countryCode: "NZ", tz: "Pacific/Auckland" },
  { city: "Wellington",     country: "New Zealand",   countryCode: "NZ", tz: "Pacific/Auckland" },
  { city: "Christchurch",   country: "New Zealand",   countryCode: "NZ", tz: "Pacific/Auckland" },
  { city: "Suva",           country: "Fiji",          countryCode: "FJ", tz: "Pacific/Fiji" },
  { city: "Port Moresby",   country: "Papua New Guinea", countryCode: "PG", tz: "Pacific/Port_Moresby" },

  // Russia beyond Moscow
  { city: "Novosibirsk",    country: "Russia",        countryCode: "RU", tz: "Asia/Novosibirsk" },
  { city: "Yekaterinburg",  country: "Russia",        countryCode: "RU", tz: "Asia/Yekaterinburg" },
  { city: "Omsk",           country: "Russia",        countryCode: "RU", tz: "Asia/Omsk" },
  { city: "Vladivostok",    country: "Russia",        countryCode: "RU", tz: "Asia/Vladivostok" },
  { city: "Krasnoyarsk",    country: "Russia",        countryCode: "RU", tz: "Asia/Krasnoyarsk" },
  { city: "Irkutsk",        country: "Russia",        countryCode: "RU", tz: "Asia/Irkutsk" },
];

// ---------------------------------------------------------------------------
// Storage + module-level shared store
// ---------------------------------------------------------------------------
//
// Using a module-level singleton so every mounted instance of `useTimezones`
// (e.g. HeaderClock + WorldClockWidget on the same page) shares the same
// list and all instances update immediately when any one of them mutates it.

const STORAGE_KEY = "paperclip.timezones";

function load(): TimezoneEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TimezoneEntry[];
  } catch { /* ignore */ }
  return [];
}

function save(entries: TimezoneEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch { /* ignore */ }
}

// Shared module state ---------------------------------------------------
let _store: TimezoneEntry[] = load();
const _listeners = new Set<(entries: TimezoneEntry[]) => void>();

function _set(next: TimezoneEntry[]) {
  _store = next;
  save(_store);
  _listeners.forEach((fn) => fn(_store));
}

/** Returns a human-friendly short label from an IANA timezone id. */
export function tzAutoLabel(tz: string): string {
  const city = tz.split("/").pop() ?? tz;
  return city.replace(/_/g, " ");
}

/** Format the current time in a given IANA timezone (HH:MM 24h). */
export function formatTzTime(tz: string, date: Date = new Date()): string {
  try {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
      hour12: false,
    });
  } catch {
    return "--:--";
  }
}

/** Format date + time for the world-clock dashboard widget. */
export function formatTzDateTime(tz: string, date: Date = new Date()): {
  time: string;
  ampm: string;
  day: string;
  offset: string;
} {
  try {
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: tz, hour12: true });
    const parts = time.match(/^(\d+:\d+)\s*(AM|PM)$/i);
    const day = date.toLocaleDateString([], { weekday: "short", timeZone: tz });
    const offset = new Intl.DateTimeFormat([], { timeZone: tz, timeZoneName: "short" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
    return { time: parts?.[1] ?? time, ampm: parts?.[2] ?? "", day, offset };
  } catch {
    return { time: "--:--", ampm: "", day: "", offset: "" };
  }
}

// ---------------------------------------------------------------------------
// Search helpers
// ---------------------------------------------------------------------------

export interface SearchResult {
  kind: "city" | "zone";
  tz: string;
  /** Display name – city name for "city" results, IANA id for "zone" results. */
  label: string;
  /** Country name (city results only) */
  country?: string;
  /** Flag emoji derived from country code */
  flag?: string;
}

function countryFlag(code: string): string {
  // ISO 3166-1 alpha-2 → regional indicator sequence
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join("");
}

/**
 * Search across the city map AND raw IANA timezone list.
 * Returns up to `limit` results with city matches first.
 */
export function searchTimezones(query: string, limit = 60): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();

  // 1. City matches
  const cityMatches: SearchResult[] = CITY_TZ_MAP.filter(
    (c) =>
      c.city.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      c.countryCode.toLowerCase() === q,
  )
    .filter((c) => {
      try { new Intl.DateTimeFormat([], { timeZone: c.tz }); return true; }
      catch { return false; }
    })
    .map((c) => ({
      kind: "city" as const,
      tz: c.tz,
      label: c.city,
      country: c.country,
      flag: countryFlag(c.countryCode),
    }));

  // Deduplicate city results by tz+city combo (some cities share a tz)
  const seenCityKeys = new Set<string>();
  const uniqueCityMatches = cityMatches.filter((r) => {
    const key = `${r.label}|${r.tz}`;
    if (seenCityKeys.has(key)) return false;
    seenCityKeys.add(key);
    return true;
  });

  // 2. Raw IANA zone matches (fallback / advanced users)
  const cityTzSet = new Set(uniqueCityMatches.map((r) => r.tz));
  const allTz = getAllTimezones();
  const zoneMatches: SearchResult[] = allTz
    .filter((tz) => {
      if (cityTzSet.has(tz)) return false; // already covered by city results
      return tz.toLowerCase().includes(q) || tzAutoLabel(tz).toLowerCase().includes(q);
    })
    .slice(0, Math.max(0, limit - uniqueCityMatches.length))
    .map((tz) => ({ kind: "zone" as const, tz, label: tz.replace(/_/g, " ") }));

  return [...uniqueCityMatches, ...zoneMatches].slice(0, limit);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTimezones() {
  const [timezones, setTimezones] = useState<TimezoneEntry[]>(() => _store);

  // Subscribe to shared store so all mounted instances stay in sync.
  useEffect(() => {
    const fn = (entries: TimezoneEntry[]) => setTimezones([...entries]);
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  }, []);

  const addTimezone = useCallback((tz: string, label?: string) => {
    if (_store.some((e) => e.tz === tz)) return;
    _set([..._store, { id: `${tz}-${Date.now()}`, tz, label: label ?? tzAutoLabel(tz) }]);
  }, []);

  const removeTimezone = useCallback((id: string) => {
    _set(_store.filter((e) => e.id !== id));
  }, []);

  const updateLabel = useCallback((id: string, label: string) => {
    _set(_store.map((e) => (e.id === id ? { ...e, label } : e)));
  }, []);

  const moveTimezone = useCallback((id: string, direction: "up" | "down") => {
    const idx = _store.findIndex((e) => e.id === id);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= _store.length) return;
    const next = [..._store];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    _set(next);
  }, []);

  return { timezones, addTimezone, removeTimezone, updateLabel, moveTimezone };
}

/** All available IANA timezone strings from the browser. */
export function getAllTimezones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.("timeZone") ?? FALLBACK_TZ;
  } catch {
    return FALLBACK_TZ;
  }
}

/** Hook: memoized full timezone list (stable across renders). */
export function useAllTimezones() {
  return useMemo(() => getAllTimezones(), []);
}

const FALLBACK_TZ = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "America/Honolulu", "America/Toronto", "America/Vancouver",
  "America/Mexico_City", "America/Bogota", "America/Lima", "America/Santiago",
  "America/Sao_Paulo", "America/Argentina/Buenos_Aires", "America/Caracas",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Madrid",
  "Europe/Amsterdam", "Europe/Brussels", "Europe/Vienna", "Europe/Zurich",
  "Europe/Stockholm", "Europe/Oslo", "Europe/Copenhagen", "Europe/Helsinki",
  "Europe/Warsaw", "Europe/Prague", "Europe/Budapest", "Europe/Bucharest",
  "Europe/Athens", "Europe/Istanbul", "Europe/Moscow", "Europe/Kiev",
  "Africa/Cairo", "Africa/Lagos", "Africa/Johannesburg", "Africa/Nairobi",
  "Asia/Dubai", "Asia/Riyadh", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka",
  "Asia/Bangkok", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Shanghai",
  "Asia/Tokyo", "Asia/Seoul", "Asia/Jakarta", "Asia/Taipei",
  "Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Perth",
  "Pacific/Auckland", "Pacific/Fiji", "Pacific/Honolulu",
];
