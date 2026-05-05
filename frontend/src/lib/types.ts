export type AlgorithmType =
  | "FIRST_FIT"
  | "BEST_FIT"
  | "EXTREME_POINT"
  | "GENETIC"
  | "AUTO";

export type RotationAxis = "x" | "y" | "z";

export interface PalletSpec {
  length_mm: number;
  width_mm: number;
  max_height_mm: number;
  max_weight_kg: number;
}

export interface Constraints {
  allow_rotation: boolean;
  fractional_quantity_mode?: "ceil" | "floor" | "exact_error" | "ignore_fractional_zero";
  do_not_allow_stability_issues: boolean;
  prefer_larger_base: boolean;
  stack_by: "weight" | "volume" | "height";
  mix_products: boolean;
  respect_fefo: boolean;
  respect_delivery_date: boolean;
  prefer_partial_pallets: boolean;
  prefer_location_cluster: boolean;
}

export interface ItemRequest {
  sku: string;
  nia_item_code?: string;
  description_of_goods?: string;
  quantity: number;
  total_qty_pcs?: number;
  qty_per_ctn?: number;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  weight_kg: number;
  lot_no?: string;
  expiry_date?: string;
  location?: string;
  line_id?: string;
  source_row?: number;
  store?: string;
  dc?: string;
  store_no?: string;
  dc_no?: string;
  center_label?: string;
  center_expected_cartons?: number;
  partial_carton?: boolean;
  original_quantity?: number;
  requested_delivery_date?: string;
  stand_upright_only?: boolean;
  no_load_on_top?: boolean;
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
  nia_item_code?: string;
  description_of_goods?: string;
  lot_no?: string;
  line_id?: string;
  source_row?: number;
  store_no?: string;
  dc_no?: string;
  center_label?: string;
  center_expected_cartons?: number;
  original_quantity?: number;
  partial_carton?: boolean;
  carton_index?: number;
  x_mm: number;
  y_mm: number;
  z_mm: number;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  weight_kg: number;
  rotation: string;
  base_area_mm2?: number;
  is_larger_base_orientation?: boolean;
  layer: number;
  pick_sequence: number;
  location?: string;
  expiry_date?: string;
  stand_upright_only?: boolean;
  no_load_on_top?: boolean;
  original_height_mm?: number;
}

export interface PalletResult {
  pallet_no: number;
  volume_utilisation_pct: number;
  area_utilisation_pct: number;
  weight_kg: number;
  box_count: number;
  sku_totals?: Record<string, number>;
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
  stability_issues?: StabilityIssue[];
  sku_totals?: Record<string, number>;
  request_total_boxes?: number;
  request_sku_totals?: Record<string, number>;
  center_totals?: Record<string, {
    input_lines: number;
    expected_cartons?: number | null;
    expanded_cartons: number;
    quantity_sum_raw: number;
  }>;
  warnings: Array<string | WarningItem>;
}

export interface PalletiseResponse {
  job_id: string;
  order_id: string;
  status: string;
  algorithm_used: string;
  summary: SummaryResult;
  pallets: PalletResult[];
  constraints_used?: {
    do_not_allow_stability_issues?: boolean;
    prefer_larger_base?: boolean;
  };
  stability?: {
    is_stable: boolean;
    issues: StabilityIssue[];
  };
  unplaced_boxes?: Array<{
    box_id: string;
    sku: string;
    reason: string;
  }>;
  manually_adjusted?: boolean;
  layout_source?: string;
}

export interface AlgorithmCompareEntry {
  algorithm: string;
  pallets_used: number;
  average_volume_utilisation_pct: number;
  average_area_utilisation_pct: number;
  total_weight_kg: number;
  floating_boxes: number;
  unstable_boxes: number;
  warnings: Array<string | WarningItem>;
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

// ── Manual Adjustment ──────────────────────────────────────────────────────────

export interface ManualAdjustmentSettings {
  edge_threshold_length_mm: number;
  edge_threshold_width_mm: number;
  snap_grid_mm: number;
  drag_sensitivity: number;
  autoFitSearchRadiusMm: number;
  do_not_allow_stability_issues: boolean;
  prefer_larger_base: boolean;
}

export interface BoxPatch {
  box_id: string;
  x_mm: number;
  y_mm: number;
  z_mm: number;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  rotation: string;
  layer: number;
  stand_upright_only?: boolean;
  no_load_on_top?: boolean;
  manual_locked?: boolean;
}

export interface PalletPatch {
  pallet_no: number;
  boxes: BoxPatch[];
}

export interface LayoutPatchRequest {
  pallets: PalletPatch[];
  settings: ManualAdjustmentSettings;
}

export interface AdjustmentValidation {
  is_valid: boolean;
  invalidBoxIds?: string[];
  issues?: StabilityIssue[];
  errors: string[];
  warnings: string[];
}

export interface LayoutPatchResponse {
  job_id: string;
  status: string;
  manually_adjusted: boolean;
  adjusted_at: string;
  layout_source: string;
  validation: AdjustmentValidation;
}

export interface LayoutValidationResult {
  isValid: boolean;
  mode?: "strict" | "soft";
  invalidBoxIds: string[];
  issues: StabilityIssue[];
  errors: string[];
  warnings: string[];
}

export interface StabilityIssue {
  id?: string;
  type: string;
  severity: "error" | "warning" | "info";
  box_id?: string;
  pallet_no?: number;
  sku?: string;
  message: string;
}

export interface WarningItem {
  id: string;
  type?: string;
  sku?: string;
  message: string;
  dismissible?: boolean;
}
