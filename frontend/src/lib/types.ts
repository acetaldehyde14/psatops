export type AlgorithmType =
  | "FIRST_FIT"
  | "BEST_FIT"
  | "EXTREME_POINT"
  | "GENETIC"
  | "AUTO";

export interface PalletSpec {
  length_mm: number;
  width_mm: number;
  max_height_mm: number;
  max_weight_kg: number;
}

export interface Constraints {
  allow_rotation: boolean;
  stack_by: "weight" | "volume" | "height";
  mix_products: boolean;
  respect_fefo: boolean;
  respect_delivery_date: boolean;
  prefer_partial_pallets: boolean;
  prefer_location_cluster: boolean;
}

export interface ItemRequest {
  sku: string;
  quantity: number;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  weight_kg: number;
  lot_no?: string;
  expiry_date?: string;
  location?: string;
  store_no?: string;
  dc_no?: string;
  requested_delivery_date?: string;
}

export interface PalletiseRequest {
  order_id: string;
  algorithm: AlgorithmType;
  pallet: PalletSpec;
  constraints: Constraints;
  items: ItemRequest[];
}

export interface BoxResult {
  box_id: string;
  sku: string;
  lot_no?: string;
  x_mm: number;
  y_mm: number;
  z_mm: number;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  weight_kg: number;
  rotation: string;
  layer: number;
  pick_sequence: number;
  location?: string;
  expiry_date?: string;
}

export interface PalletResult {
  pallet_no: number;
  volume_utilisation_pct: number;
  area_utilisation_pct: number;
  weight_kg: number;
  box_count: number;
  boxes: BoxResult[];
}

export interface SummaryResult {
  pallets_used: number;
  total_boxes: number;
  average_volume_utilisation_pct: number;
  average_area_utilisation_pct: number;
  total_weight_kg: number;
  floating_boxes: number;
  unstable_boxes: number;
  warnings: string[];
}

export interface PalletiseResponse {
  job_id: string;
  order_id: string;
  status: string;
  algorithm_used: string;
  summary: SummaryResult;
  pallets: PalletResult[];
}

export interface AlgorithmCompareEntry {
  algorithm: string;
  pallets_used: number;
  average_volume_utilisation_pct: number;
  average_area_utilisation_pct: number;
  total_weight_kg: number;
  floating_boxes: number;
  unstable_boxes: number;
  warnings: string[];
  job_id: string;
}

export interface CompareResponse {
  order_id: string;
  results: AlgorithmCompareEntry[];
}

export interface UploadResponse {
  filename: string;
  rows_parsed: number;
  items: Record<string, unknown>[];
  warnings: string[];
}
