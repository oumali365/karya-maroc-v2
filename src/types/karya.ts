export type FuelType = 'diesel' | 'essence' | 'hybrid' | 'electric';
export type TransmissionType = 'manual' | 'automatic';
export type CarAvailability = 'available' | 'unavailable';

export type BookingStatus =
  | 'pending_payment'
  | 'payment_uploaded'
  | 'payment_verified'
  | 'car_delivered'
  | 'completed'
  | 'refund_requested'
  | 'refunded'
  | 'cancelled';

export interface CityOption {
  slug: string;
  nameAr: string;
  nameFr: string;
  latitude: number;
  longitude: number;
}

export interface PlatformBank {
  id: string;
  code: string;
  short_name: string;
  display_name_ar: string;
  account_holder_name: string;
  rib: string;
  sort_order: number;
  is_active: boolean;
}

export interface CarOffer {
  id: string;
  agency_id: string;
  agency_name: string;
  agency_phone?: string;
  agency_rating: number;
  agency_rating_count: number;
  brand: string;
  model: string;
  model_year: number | null;
  fuel_type: FuelType;
  transmission: TransmissionType;
  seats: number;
  primary_image_url: string;
  gallery_images: string[];
  daily_price: number;
  deposit_amount: number;
  city: string;
  status: CarAvailability;
  distance_km: number | null;
  is_demo?: boolean;
}

export interface BookingFormPayload {
  customerName: string;
  customerCin: string;
  customerPhone: string;
  customerLicenseNumber: string;
  customerLicenseIssueDate: string;
  pickupLocation: string;
  customerEmail?: string;
  days: number;
  deliveryAt: string;
  deliveryNotes?: string;
}

export interface CreatedBooking {
  booking_id: string;
  booking_code: string;
  car_label: string;
  car_image: string;
  agency_name: string;
  city: string;
  pickup_location?: string;
  customer_license_number?: string;
  customer_license_issue_date?: string;
  days: number;
  daily_price: number;
  total_amount: number;
  commission_amount: number;
  agency_payout_amount: number;
  delivery_at: string;
  status: BookingStatus;
  selected_bank_code?: string;
  receipt_url?: string;
  is_demo?: boolean;
}

export interface AgencyProfile {
  id: string;
  owner_id: string;
  name: string;
  phone: string;
  whatsapp_phone?: string | null;
  city: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  bank_name: string;
  bank_account_holder?: string | null;
  bank_rib: string;
  commercial_register?: string | null;
  verification_status: 'pending' | 'verified' | 'suspended';
  rating_avg: number;
  rating_count: number;
}

export interface AgencyBookingRecord {
  id: string;
  booking_code: string;
  customer_name: string;
  customer_cin: string;
  customer_phone: string;
  customer_license_number?: string | null;
  customer_license_issue_date?: string | null;
  pickup_location?: string | null;
  days: number;
  daily_price: number;
  total_amount: number;
  commission_amount: number;
  agency_payout_amount: number;
  delivery_at: string;
  status: BookingStatus;
  selected_bank_code?: string | null;
  receipt_url?: string | null;
  created_at: string;
  agency_name?: string;
  car_brand?: string;
  car_model?: string;
  car_image?: string;
}

export interface PayoutRecord {
  id: string;
  booking_id: string;
  transfer_type: 'agency_payout' | 'customer_refund';
  agency_id: string | null;
  amount: number;
  recipient_name: string;
  recipient_bank: string;
  recipient_rib: string;
  bank_transfer_reference: string | null;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  notes: string | null;
  sent_at: string | null;
  created_at: string;
}
