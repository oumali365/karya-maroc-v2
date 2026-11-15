import { createClient } from '@supabase/supabase-js';
import type { CityOption } from '../types/karya';

const FALLBACK_SUPABASE_URL = 'https://fvadhrdyxykromonpnoo.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2YWRocmR5eHlrcm9tb25wbm9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3MzE2NjgsImV4cCI6MjExMDMwNzY2OH0.Snu4HAl3pgxuHcaNMJCSzdKMbe4y6brSWo07hWDFozY';

const rawEnvUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const rawEnvAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const isUsableSupabaseUrl = (val?: string): val is string =>
  Boolean(
    val &&
      /^https?:\/\//i.test(val) &&
      !val.includes('your-project') &&
      !val.includes('example.com'),
  );

const isUsableSupabaseKey = (val?: string): val is string =>
  Boolean(val && val.length > 30 && !val.includes('your-supabase-anon-key'));

export const SUPABASE_URL = isUsableSupabaseUrl(rawEnvUrl) ? rawEnvUrl : FALLBACK_SUPABASE_URL;
export const SUPABASE_ANON_KEY = isUsableSupabaseKey(rawEnvAnonKey)
  ? rawEnvAnonKey
  : FALLBACK_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const MOROCCAN_CITIES: CityOption[] = [
  { slug: 'casablanca', nameAr: 'الدار البيضاء', nameFr: 'Casablanca', latitude: 33.5731, longitude: -7.5898 },
  { slug: 'marrakech', nameAr: 'مراكش', nameFr: 'Marrakech', latitude: 31.6295, longitude: -7.9811 },
  { slug: 'agadir', nameAr: 'أكادير', nameFr: 'Agadir', latitude: 30.4278, longitude: -9.5981 },
  { slug: 'rabat', nameAr: 'الرباط', nameFr: 'Rabat', latitude: 34.0209, longitude: -6.8416 },
  { slug: 'tangier', nameAr: 'طنجة', nameFr: 'Tangier', latitude: 35.7595, longitude: -5.8340 },
  { slug: 'fes', nameAr: 'فاس', nameFr: 'Fès', latitude: 34.0181, longitude: -5.0078 },
  { slug: 'meknes', nameAr: 'مكناس', nameFr: 'Meknès', latitude: 33.8935, longitude: -5.5473 },
  { slug: 'oujda', nameAr: 'وجدة', nameFr: 'Oujda', latitude: 34.6814, longitude: -1.9086 },
  { slug: 'kenitra', nameAr: 'القنيطرة', nameFr: 'Kénitra', latitude: 34.2610, longitude: -6.5802 },
  { slug: 'tetouan', nameAr: 'تطوان', nameFr: 'Tétouan', latitude: 35.5889, longitude: -5.3626 },
  { slug: 'essaouira', nameAr: 'الصويرة', nameFr: 'Essaouira', latitude: 31.5085, longitude: -9.7595 },
  { slug: 'nador', nameAr: 'الناظور', nameFr: 'Nador', latitude: 35.1681, longitude: -2.9335 },
];

export interface PickupLocationOption {
  id: string;
  label: string;
  category: 'airport' | 'city';
  cityFr: string;
}

export const MOROCCAN_PICKUP_LOCATIONS: PickupLocationOption[] = [
  { id: 'cmn-airport', label: 'مطار محمد الخامس الدولي — الدار البيضاء', category: 'airport', cityFr: 'Casablanca' },
  { id: 'rak-airport', label: 'مطار مراكش المنارة الدولي — مراكش', category: 'airport', cityFr: 'Marrakech' },
  { id: 'aga-airport', label: 'مطار أكادير المسيرة الدولي — أكادير', category: 'airport', cityFr: 'Agadir' },
  { id: 'tng-airport', label: 'مطار طنجة ابن بطوطة الدولي — طنجة', category: 'airport', cityFr: 'Tangier' },
  { id: 'fez-airport', label: 'مطار فاس سايس الدولي — فاس', category: 'airport', cityFr: 'Fès' },
  { id: 'rba-airport', label: 'مطار الرباط سلا الدولي — الرباط', category: 'airport', cityFr: 'Rabat' },
  { id: 'oud-airport', label: 'مطار وجدة أنجاد الدولي — وجدة', category: 'airport', cityFr: 'Oujda' },
  { id: 'casablanca-city', label: 'وسط مدينة الدار البيضاء / محطة الدار البيضاء المسافرين', category: 'city', cityFr: 'Casablanca' },
  { id: 'marrakech-city', label: 'وسط مدينة مراكش (جليز / محطة القطار)', category: 'city', cityFr: 'Marrakech' },
  { id: 'rabat-city', label: 'وسط مدينة الرباط (أكدال / محطة القطار)', category: 'city', cityFr: 'Rabat' },
  { id: 'tangier-city', label: 'وسط مدينة طنجة (ميناء طنجة / محطة البراق)', category: 'city', cityFr: 'Tangier' },
  { id: 'fes-city', label: 'وسط مدينة فاس (المدينة الجديدة)', category: 'city', cityFr: 'Fès' },
  { id: 'agadir-city', label: 'وسط مدينة أكادير (الكورنيش / المركز)', category: 'city', cityFr: 'Agadir' },
  { id: 'meknes-city', label: 'وسط مدينة مكناس', category: 'city', cityFr: 'Meknès' },
  { id: 'kenitra-city', label: 'وسط مدينة القنيطرة (محطة القطار)', category: 'city', cityFr: 'Kénitra' },
  { id: 'tetouan-city', label: 'وسط مدينة تطوان', category: 'city', cityFr: 'Tétouan' },
  { id: 'essaouira-city', label: 'وسط مدينة الصويرة', category: 'city', cityFr: 'Essaouira' },
  { id: 'oujda-city', label: 'وسط مدينة وجدة', category: 'city', cityFr: 'Oujda' },
  { id: 'nador-city', label: 'وسط مدينة الناظور', category: 'city', cityFr: 'Nador' },
];

export function formatDH(amount: number): string {
  return `${amount.toFixed(2)} DH`;
}

export function formatMAD(amount: number): string {
  return `${Math.round(amount)} درهم`;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function findNearestMoroccanCity(lat: number, lng: number): {
  city: CityOption;
  distanceKm: number;
} {
  let nearest = MOROCCAN_CITIES[0];
  let bestDistance = Infinity;

  for (const city of MOROCCAN_CITIES) {
    const dist = haversineKm(lat, lng, city.latitude, city.longitude);
    if (dist < bestDistance) {
      bestDistance = dist;
      nearest = city;
    }
  }

  return { city: nearest, distanceKm: bestDistance };
}

export function getCityLabelAr(cityValue: string): string {
  const found = MOROCCAN_CITIES.find(
    (c) =>
      c.nameFr.toLowerCase() === cityValue.toLowerCase() ||
      c.slug.toLowerCase() === cityValue.toLowerCase() ||
      c.nameAr === cityValue,
  );
  return found ? found.nameAr : cityValue;
}
