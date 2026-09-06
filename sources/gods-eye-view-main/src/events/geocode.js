/**
 * Offline geocoder: city table (50 major cities) + country centroid table.
 * No network dependency. If no match, returns confidence 0.
 */

const CITIES_TABLE = Object.freeze([
  { name: 'Delhi', lat: 28.6139, lon: 77.2090, countryIso2: 'IN', admin1: 'Delhi', countryName: 'India' },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777, countryIso2: 'IN', admin1: 'Maharashtra', countryName: 'India' },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708, countryIso2: 'AE', admin1: 'Dubai', countryName: 'United Arab Emirates' },
  { name: 'London', lat: 51.5074, lon: -0.1278, countryIso2: 'GB', admin1: 'England', countryName: 'United Kingdom' },
  { name: 'Paris', lat: 48.8566, lon: 2.3522, countryIso2: 'FR', admin1: 'Ile-de-France', countryName: 'France' },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503, countryIso2: 'JP', admin1: 'Tokyo', countryName: 'Japan' },
  { name: 'Beijing', lat: 39.9042, lon: 116.4074, countryIso2: 'CN', admin1: 'Beijing', countryName: 'China' },
  { name: 'Moscow', lat: 55.7558, lon: 37.6173, countryIso2: 'RU', admin1: 'Moscow', countryName: 'Russia' },
  { name: 'Washington', lat: 38.9072, lon: -77.0369, countryIso2: 'US', admin1: 'District of Columbia', countryName: 'United States' },
  { name: 'Washington DC', lat: 38.9072, lon: -77.0369, countryIso2: 'US', admin1: 'District of Columbia', countryName: 'United States' },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093, countryIso2: 'AU', admin1: 'New South Wales', countryName: 'Australia' },
  { name: 'Cairo', lat: 30.0444, lon: 31.2357, countryIso2: 'EG', admin1: 'Cairo', countryName: 'Egypt' },
  { name: 'Istanbul', lat: 41.0082, lon: 28.9784, countryIso2: 'TR', admin1: 'Istanbul', countryName: 'Turkey' },
  { name: 'Seoul', lat: 37.5665, lon: 126.9780, countryIso2: 'KR', admin1: 'Seoul', countryName: 'South Korea' },
  { name: 'Riyadh', lat: 24.7136, lon: 46.6753, countryIso2: 'SA', admin1: 'Riyadh', countryName: 'Saudi Arabia' },
  { name: 'Berlin', lat: 52.5200, lon: 13.4050, countryIso2: 'DE', admin1: 'Berlin', countryName: 'Germany' },
  { name: 'Rome', lat: 41.9028, lon: 12.4964, countryIso2: 'IT', admin1: 'Lazio', countryName: 'Italy' },
  { name: 'Madrid', lat: 40.4168, lon: -3.7038, countryIso2: 'ES', admin1: 'Madrid', countryName: 'Spain' },
  { name: 'Toronto', lat: 43.6532, lon: -79.3832, countryIso2: 'CA', admin1: 'Ontario', countryName: 'Canada' },
  { name: 'Lagos', lat: 6.5244, lon: 3.3792, countryIso2: 'NG', admin1: 'Lagos', countryName: 'Nigeria' },
  { name: 'Jakarta', lat: -6.2088, lon: 106.8456, countryIso2: 'ID', admin1: 'Jakarta', countryName: 'Indonesia' },
  { name: 'Mexico City', lat: 19.4326, lon: -99.1332, countryIso2: 'MX', admin1: 'Mexico City', countryName: 'Mexico' },
  { name: 'Bangkok', lat: 13.7563, lon: 100.5018, countryIso2: 'TH', admin1: 'Bangkok', countryName: 'Thailand' },
  { name: 'Tehran', lat: 35.6892, lon: 51.3890, countryIso2: 'IR', admin1: 'Tehran', countryName: 'Iran' },
  { name: 'Tel Aviv', lat: 32.0853, lon: 34.7818, countryIso2: 'IL', admin1: 'Tel Aviv', countryName: 'Israel' },
  { name: 'Kyiv', lat: 50.4501, lon: 30.5234, countryIso2: 'UA', admin1: 'Kyiv', countryName: 'Ukraine' },
  { name: 'Kiev', lat: 50.4501, lon: 30.5234, countryIso2: 'UA', admin1: 'Kyiv', countryName: 'Ukraine' },
  { name: 'Damascus', lat: 33.5138, lon: 36.2765, countryIso2: 'SY', admin1: 'Damascus', countryName: 'Syria' },
  { name: 'Taipei', lat: 25.0330, lon: 121.5654, countryIso2: 'TW', admin1: 'Taipei', countryName: 'Taiwan' },
  { name: 'Singapore', lat: 1.3521, lon: 103.8198, countryIso2: 'SG', admin1: 'Singapore', countryName: 'Singapore' },
  { name: 'Hong Kong', lat: 22.3193, lon: 114.1694, countryIso2: 'HK', admin1: 'Hong Kong', countryName: 'Hong Kong' },
  { name: 'Amsterdam', lat: 52.3676, lon: 4.9041, countryIso2: 'NL', admin1: 'North Holland', countryName: 'Netherlands' },
  { name: 'Warsaw', lat: 52.2297, lon: 21.0122, countryIso2: 'PL', admin1: 'Masovia', countryName: 'Poland' },
  { name: 'Karachi', lat: 24.8607, lon: 67.0011, countryIso2: 'PK', admin1: 'Sindh', countryName: 'Pakistan' },
  { name: 'Dhaka', lat: 23.8103, lon: 90.4125, countryIso2: 'BD', admin1: 'Dhaka', countryName: 'Bangladesh' },
  { name: 'Kinshasa', lat: -4.4419, lon: 15.2663, countryIso2: 'CD', admin1: 'Kinshasa', countryName: 'Democratic Republic of the Congo' },
  { name: 'Shanghai', lat: 31.2304, lon: 121.4737, countryIso2: 'CN', admin1: 'Shanghai', countryName: 'China' },
  { name: 'Guangzhou', lat: 23.1291, lon: 113.2644, countryIso2: 'CN', admin1: 'Guangdong', countryName: 'China' },
  { name: 'Shenzhen', lat: 22.5431, lon: 114.0579, countryIso2: 'CN', admin1: 'Guangdong', countryName: 'China' },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777, countryIso2: 'IN', admin1: 'Maharashtra', countryName: 'India' },
  { name: 'Bangalore', lat: 12.9716, lon: 77.5946, countryIso2: 'IN', admin1: 'Karnataka', countryName: 'India' },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, countryIso2: 'IN', admin1: 'Karnataka', countryName: 'India' },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707, countryIso2: 'IN', admin1: 'Tamil Nadu', countryName: 'India' },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639, countryIso2: 'IN', admin1: 'West Bengal', countryName: 'India' },
  { name: 'New York', lat: 40.7128, lon: -74.0060, countryIso2: 'US', admin1: 'New York', countryName: 'United States' },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, countryIso2: 'US', admin1: 'California', countryName: 'United States' },
  { name: 'Chicago', lat: 41.8781, lon: -87.6298, countryIso2: 'US', admin1: 'Illinois', countryName: 'United States' },
  { name: 'Houston', lat: 29.7604, lon: -95.3698, countryIso2: 'US', admin1: 'Texas', countryName: 'United States' },
  { name: 'Sao Paulo', lat: -23.5505, lon: -46.6333, countryIso2: 'BR', admin1: 'Sao Paulo', countryName: 'Brazil' },
  { name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729, countryIso2: 'BR', admin1: 'Rio de Janeiro', countryName: 'Brazil' },
  { name: 'Buenos Aires', lat: -34.6037, lon: -58.3816, countryIso2: 'AR', admin1: 'Buenos Aires', countryName: 'Argentina' },
]);

const COUNTRIES_TABLE = Object.freeze([
  { iso2: 'IN', name: 'India', lat: 20.5937, lon: 78.9629 },
  { iso2: 'US', name: 'United States', lat: 37.0902, lon: -95.7129 },
  { iso2: 'CN', name: 'China', lat: 35.8617, lon: 104.1954 },
  { iso2: 'RU', name: 'Russia', lat: 61.5240, lon: 105.3188 },
  { iso2: 'GB', name: 'United Kingdom', lat: 55.3781, lon: -3.4360 },
  { iso2: 'FR', name: 'France', lat: 46.2276, lon: 2.2137 },
  { iso2: 'DE', name: 'Germany', lat: 51.1657, lon: 10.4515 },
  { iso2: 'BR', name: 'Brazil', lat: -14.2350, lon: -51.9253 },
  { iso2: 'JP', name: 'Japan', lat: 36.2048, lon: 138.2529 },
  { iso2: 'KR', name: 'South Korea', lat: 35.9078, lon: 127.7669 },
  { iso2: 'AU', name: 'Australia', lat: -25.2744, lon: 133.7751 },
  { iso2: 'CA', name: 'Canada', lat: 56.1304, lon: -106.3468 },
  { iso2: 'IT', name: 'Italy', lat: 41.8719, lon: 12.5674 },
  { iso2: 'ES', name: 'Spain', lat: 40.4637, lon: -3.7492 },
  { iso2: 'MX', name: 'Mexico', lat: 23.6345, lon: -102.5528 },
  { iso2: 'ID', name: 'Indonesia', lat: -0.7893, lon: 113.9213 },
  { iso2: 'TR', name: 'Turkey', lat: 38.9637, lon: 35.2433 },
  { iso2: 'IR', name: 'Iran', lat: 32.4279, lon: 53.6880 },
  { iso2: 'IL', name: 'Israel', lat: 31.0461, lon: 34.8516 },
  { iso2: 'SY', name: 'Syria', lat: 34.8021, lon: 38.9968 },
  { iso2: 'UA', name: 'Ukraine', lat: 48.3794, lon: 31.1656 },
  { iso2: 'EG', name: 'Egypt', lat: 26.8206, lon: 30.8025 },
  { iso2: 'NG', name: 'Nigeria', lat: 9.0820, lon: 8.6753 },
  { iso2: 'SA', name: 'Saudi Arabia', lat: 23.8859, lon: 45.0792 },
  { iso2: 'PK', name: 'Pakistan', lat: 30.3753, lon: 69.3451 },
  { iso2: 'AR', name: 'Argentina', lat: -38.4161, lon: -63.6167 },
  { iso2: 'PL', name: 'Poland', lat: 51.9194, lon: 19.1451 },
  { iso2: 'NL', name: 'Netherlands', lat: 52.1326, lon: 5.2913 },
  { iso2: 'SE', name: 'Sweden', lat: 60.1282, lon: 18.6435 },
  { iso2: 'NO', name: 'Norway', lat: 60.4720, lon: 8.4689 },
  { iso2: 'AE', name: 'United Arab Emirates', lat: 23.4241, lon: 53.8478 },
  { iso2: 'TH', name: 'Thailand', lat: 15.8700, lon: 100.9925 },
  { iso2: 'TW', name: 'Taiwan', lat: 23.6978, lon: 120.9605 },
  { iso2: 'SG', name: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { iso2: 'HK', name: 'Hong Kong', lat: 22.3193, lon: 114.1694 },
  { iso2: 'BD', name: 'Bangladesh', lat: 23.6850, lon: 90.3563 },
  { iso2: 'CD', name: 'Democratic Republic of the Congo', lat: -4.0383, lon: 21.7587 },
  { iso2: 'EG', name: 'Egypt', lat: 26.8206, lon: 30.8025 },
]);

const buildNameIndex = (table) => {
  const idx = new Map();
  for (const row of table) {
    const key = row.name.toLowerCase();
    if (!idx.has(key)) idx.set(key, row);
  }
  return idx;
};

const CITY_NAME_INDEX = buildNameIndex(CITIES_TABLE);

const buildCountryNameIndex = () => {
  const idx = new Map();
  for (const row of COUNTRIES_TABLE) {
    const key = row.name.toLowerCase();
    if (!idx.has(key)) idx.set(key, row);
    const short = key.replace(/\s*(republic|democratic|federation|kingdom|states|arab|emirates|union)\s*/g, '').trim();
    if (short && !idx.has(short)) idx.set(short, row);
  }
  return idx;
};

const COUNTRY_NAME_INDEX = buildCountryNameIndex();

const findCityMatch = (text) => {
  const lower = String(text || '').toLowerCase();
  if (!lower) return null;
  for (const [name, city] of CITY_NAME_INDEX) {
    if (name.length < 3) continue;
    if (lower.includes(name)) {
      return city;
    }
  }
  const tokens = lower.split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
  for (let i = 0; i < tokens.length; i++) {
    for (let j = Math.min(i + 3, tokens.length); j > i; j--) {
      const candidate = tokens.slice(i, j).join(' ');
      if (CITY_NAME_INDEX.has(candidate)) return CITY_NAME_INDEX.get(candidate);
    }
  }
  return null;
};

const findCountryMatch = (text) => {
  const lower = String(text || '').toLowerCase();
  if (!lower) return null;
  for (const [nameKey, country] of COUNTRY_NAME_INDEX) {
    if (nameKey.length < 3) continue;
    if (lower.includes(nameKey)) return country;
  }
  return null;
};

const geocodeText = (locationText) => {
  const base = {
    lat: null,
    lon: null,
    placeName: null,
    countryIso2: null,
    admin1: null,
    confidence: 0,
  };
  if (!locationText || typeof locationText !== 'string') return Object.freeze(base);
  const text = locationText.trim();
  if (!text) return Object.freeze(base);
  const city = findCityMatch(text);
  if (city) {
    return Object.freeze({
      lat: city.lat,
      lon: city.lon,
      placeName: city.name,
      countryIso2: city.countryIso2,
      admin1: city.admin1,
      confidence: 90,
    });
  }
  const country = findCountryMatch(text);
  if (country) {
    return Object.freeze({
      lat: country.lat,
      lon: country.lon,
      placeName: country.name,
      countryIso2: country.iso2,
      admin1: null,
      confidence: 60,
    });
  }
  return Object.freeze(base);
};

export default geocodeText;
export { geocodeText, CITIES_TABLE, COUNTRIES_TABLE };
