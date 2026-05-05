import type { PalletiseResponse, PalletiseRequest } from "./types";
export { SKU_COLORS, getSkuColor } from "./skuColors";

export const defaultPalletiseRequest: PalletiseRequest = {
  order_id: "ORD-001",
  algorithm: "EXTREME_POINT",
  pallet: {
    length_mm: 1200,
    width_mm: 1100,
    max_height_mm: 1150,
    max_weight_kg: 1500,
  },
  constraints: {
    allow_rotation: true,
    do_not_allow_stability_issues: true,
    prefer_larger_base: false,
    stack_by: "weight",
    mix_products: true,
    respect_fefo: true,
    respect_delivery_date: false,
    prefer_partial_pallets: true,
    prefer_location_cluster: true,
  },
  items: [
    {
      sku: "C-BTA073V650G3ECE",
      quantity: 10,
      length_mm: 430,
      width_mm: 216,
      height_mm: 250,
      weight_kg: 0.165,
      lot_no: "LOT001",
      expiry_date: "2026-12-31",
      location: "R01-L02-C03-D04",
    },
    {
      sku: "C-WIDGET-SMALL",
      quantity: 20,
      length_mm: 100,
      width_mm: 80,
      height_mm: 60,
      weight_kg: 0.05,
      lot_no: "LOT003",
      expiry_date: "2027-01-01",
      location: "R02-L01-C01-D01",
    },
  ],
};
