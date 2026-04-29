"""Export palletisation results to CSV."""
import csv
import io
from app.core.schemas import PalletiseResponse


def to_csv(result: PalletiseResponse) -> str:
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "job_id", "order_id", "algorithm", "pallet_no",
        "box_id", "sku", "lot_no",
        "x_mm", "y_mm", "z_mm",
        "length_mm", "width_mm", "height_mm",
        "weight_kg", "rotation", "layer", "pick_sequence", "location",
    ])

    for pallet in result.pallets:
        for box in pallet.boxes:
            writer.writerow([
                result.job_id,
                result.order_id,
                result.algorithm_used,
                pallet.pallet_no,
                box.box_id,
                box.sku,
                box.lot_no or "",
                box.x_mm,
                box.y_mm,
                box.z_mm,
                box.length_mm,
                box.width_mm,
                box.height_mm,
                box.weight_kg,
                box.rotation,
                box.layer,
                box.pick_sequence,
                box.location or "",
            ])

    return output.getvalue()
