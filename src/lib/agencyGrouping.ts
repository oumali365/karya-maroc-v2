import type { CarOffer, TransmissionType } from '../types/karya';

export interface AgencyGroup {
  groupKey: string;
  agencyId: string;
  agencyName: string;
  city: string;
  isVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  cars: CarOffer[];
  totalCount: number;
  availableNowCount: number;
}

export interface CarFilterCriteria {
  brandFilter?: string;
  transmissionFilter?: 'all' | TransmissionType;
}

export function formatAgenciesCountAr(count: number): string {
  if (count === 1) return 'وكالة واحدة';
  if (count === 2) return 'وكالتان';
  if (count >= 3 && count <= 10) return `${count} وكالات`;
  return `${count} وكالة`;
}

export function formatCarsCountAr(count: number): string {
  if (count === 1) return 'سيارة واحدة';
  if (count === 2) return 'سيارتان';
  if (count >= 3 && count <= 10) return `${count} سيارات`;
  return `${count} سيارة`;
}

/**
 * Applies active filters (brand, transmission) BEFORE grouping so agency
 * counts reflect strictly matching offers and non-matching agencies are excluded.
 */
export function filterCarOffers(
  cars: CarOffer[],
  { brandFilter = 'all', transmissionFilter = 'all' }: CarFilterCriteria,
): CarOffer[] {
  const cleanBrand = brandFilter.trim().toLowerCase();

  const matched = cars.filter((car) => {
    const brandOk =
      cleanBrand === 'all' ||
      cleanBrand === '' ||
      car.brand.trim().toLowerCase() === cleanBrand;
    if (!brandOk) return false;

    const transmissionOk =
      transmissionFilter === 'all' || car.transmission === transmissionFilter;
    if (!transmissionOk) return false;

    return true;
  });

  return [...matched].sort((a, b) => {
    const aBooked = a.is_booked ? 1 : 0;
    const bBooked = b.is_booked ? 1 : 0;
    if (aBooked !== bBooked) return aBooked - bBooked;
    if (a.daily_price !== b.daily_price) return a.daily_price - b.daily_price;
    return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, 'en');
  });
}

/**
 * Groups already-filtered cars strictly by agency and applies deterministic,
 * fair sorting without paid priority or unverified boosts.
 */
export function groupCarsByAgency(filteredCars: CarOffer[]): AgencyGroup[] {
  const buckets = new Map<string, AgencyGroup>();

  for (const car of filteredCars) {
    const cleanName = car.agency_name.trim() || 'وكالة معتمدة';
    const groupKey = `${car.agency_id}::${cleanName}`;

    const carVerified = car.agency_verified === true;
    const carRatingCount = Number(car.agency_rating_count ?? 0);
    const carRatingAvg = Number(car.agency_rating ?? 0);

    let existing = buckets.get(groupKey);
    if (!existing) {
      existing = {
        groupKey,
        agencyId: car.agency_id,
        agencyName: cleanName,
        city: car.city,
        isVerified: carVerified,
        ratingAvg: carRatingCount > 0 && carRatingAvg > 0 ? carRatingAvg : 0,
        ratingCount: carRatingCount > 0 && carRatingAvg > 0 ? carRatingCount : 0,
        cars: [],
        totalCount: 0,
        availableNowCount: 0,
      };
      buckets.set(groupKey, existing);
    }

    existing.cars.push(car);
    existing.totalCount += 1;
    if (!car.is_booked) {
      existing.availableNowCount += 1;
    }
    if (carVerified) {
      existing.isVerified = true;
    }
    if (carRatingCount > existing.ratingCount && carRatingAvg > 0) {
      existing.ratingCount = carRatingCount;
      existing.ratingAvg = carRatingAvg;
    }
  }

  const groups = Array.from(buckets.values());

  for (const group of groups) {
    group.cars.sort((a, b) => {
      const aBooked = a.is_booked ? 1 : 0;
      const bBooked = b.is_booked ? 1 : 0;
      if (aBooked !== bBooked) return aBooked - bBooked;
      if (a.daily_price !== b.daily_price) return a.daily_price - b.daily_price;
      return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, 'en');
    });
  }

  groups.sort((a, b) => {
    const aHasAvailable = a.availableNowCount > 0 ? 1 : 0;
    const bHasAvailable = b.availableNowCount > 0 ? 1 : 0;
    if (bHasAvailable !== aHasAvailable) return bHasAvailable - aHasAvailable;

    if (b.availableNowCount !== a.availableNowCount) {
      return b.availableNowCount - a.availableNowCount;
    }

    if (b.totalCount !== a.totalCount) {
      return b.totalCount - a.totalCount;
    }

    const aHasRealRating = a.ratingCount > 0 && a.ratingAvg > 0 ? 1 : 0;
    const bHasRealRating = b.ratingCount > 0 && b.ratingAvg > 0 ? 1 : 0;
    if (bHasRealRating !== aHasRealRating) return bHasRealRating - aHasRealRating;

    if (aHasRealRating && bHasRealRating) {
      if (b.ratingAvg !== a.ratingAvg) return b.ratingAvg - a.ratingAvg;
      if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
    }

    return a.agencyName.localeCompare(b.agencyName, 'ar');
  });

  return groups;
}
