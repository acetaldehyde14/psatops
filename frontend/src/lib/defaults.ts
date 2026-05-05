import type { Constraints, PalletSpec } from "./types";

export const DEFAULT_PALLET: PalletSpec = {
  length_mm: 1200,
  width_mm: 1100,
  max_height_mm: 1150,
  max_weight_kg: 1500,
};

export const DEFAULT_CONSTRAINTS: Constraints = {
  allow_rotation: true,
  do_not_allow_stability_issues: true,
  prefer_larger_base: false,
  stack_by: "weight",
  mix_products: true,
  respect_fefo: true,
  respect_delivery_date: false,
  prefer_partial_pallets: true,
  prefer_location_cluster: true,
};
