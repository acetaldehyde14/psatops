# Palletisation Optimiser

A full-stack web application for 3D warehouse palletisation optimisation, supporting multiple algorithms, Excel/CSV upload, 3D visualisation, and exportable results.

---

## Stack

| Layer     | Technology                                 |
|-----------|--------------------------------------------|
| Frontend  | Next.js 14, React, TypeScript, TailwindCSS |
| 3D        | React Three Fiber / Three.js               |
| Backend   | Python FastAPI                             |
| Storage   | In-memory (SQLite/Postgres-ready)          |
| Parsing   | pandas + openpyxl                          |

---

## Quick Start (Local Dev)

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
nvm use
npm install
npm run dev
```

App: http://localhost:3000

### Clean Frontend Install

Use Node 20 LTS for local development and builds.

```bash
cd frontend
nvm use
rm -rf node_modules .next package-lock.json
npm install
npm run build
npm run dev
```

---

## Docker Compose

```bash
docker-compose up --build
```

- Backend: http://localhost:8000
- Frontend: http://localhost:3000

---

## Render Deployment

Frontend Render environment variable:

```text
NODE_VERSION=20.11.1
```

Frontend build command:

```bash
npm install && npm run build
```

Frontend start command:

```bash
npm start
```

---

## Sample CSV Format

```csv
sku,quantity,length_mm,width_mm,height_mm,weight_kg,lot_no,expiry_date,location,store_no,dc_no,description
C-BTA073V650G3ECE,10,430,216,250,0.165,LOT001,2026-12-31,R01-L02-C03-D04,TPH,SG,Battery Pack
C-WIDGET-SMALL,20,100,80,60,0.050,LOT003,2027-01-01,R02-L01-C01-D01,TPH,SG,Small Widget
```

Required columns: `sku`, `quantity`, `length_mm`, `width_mm`, `height_mm`, `weight_kg`

---

## API Documentation

### GET /health

```bash
curl http://localhost:8000/health
```

### POST /api/v1/palletise

```bash
curl -X POST http://localhost:8000/api/v1/palletise \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ORD-001",
    "algorithm": "EXTREME_POINT",
    "pallet": {
      "length_mm": 1200,
      "width_mm": 1000,
      "max_height_mm": 1150,
      "max_weight_kg": 1500
    },
    "constraints": {
      "allow_rotation": true,
      "stack_by": "weight",
      "mix_products": true,
      "respect_fefo": true,
      "respect_delivery_date": false,
      "prefer_partial_pallets": true,
      "prefer_location_cluster": true
    },
    "items": [
      {
        "sku": "C-BTA073V650G3ECE",
        "quantity": 10,
        "length_mm": 430,
        "width_mm": 216,
        "height_mm": 250,
        "weight_kg": 0.165,
        "lot_no": "LOT001",
        "expiry_date": "2026-12-31",
        "location": "R01-L02-C03-D04"
      }
    ]
  }'
```

### POST /api/v1/palletise/compare

```bash
curl -X POST http://localhost:8000/api/v1/palletise/compare \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "CMP-001",
    "algorithms": ["FIRST_FIT", "BEST_FIT", "EXTREME_POINT", "GENETIC"],
    "pallet": {"length_mm": 1200, "width_mm": 1000, "max_height_mm": 1150, "max_weight_kg": 1500},
    "constraints": {"allow_rotation": true, "stack_by": "weight", "mix_products": true, "respect_fefo": true, "respect_delivery_date": false, "prefer_partial_pallets": true, "prefer_location_cluster": true},
    "items": [{"sku": "BOX-A", "quantity": 5, "length_mm": 300, "width_mm": 200, "height_mm": 150, "weight_kg": 1.5}]
  }'
```

### POST /api/v1/upload

```bash
curl -X POST http://localhost:8000/api/v1/upload \
  -F "file=@backend/app/sample_data/sample_order.csv"
```

### GET /api/v1/jobs/{job_id}

```bash
curl http://localhost:8000/api/v1/jobs/job_abc123def456
```

### GET /api/v1/jobs/{job_id}/export/csv

```bash
curl -o result.csv http://localhost:8000/api/v1/jobs/job_abc123def456/export/csv
```

---

## Algorithms

| Algorithm      | Description                                                  |
|----------------|--------------------------------------------------------------|
| FIRST_FIT      | First Fit Decreasing. Fast baseline.                         |
| BEST_FIT       | Best Fit - minimises residual space per pallet.              |
| EXTREME_POINT  | 3D Extreme Point packing. Best default algorithm.            |
| GENETIC        | Genetic algorithm evolving box ordering over 5 generations.  |
| AUTO           | Runs EXTREME_POINT + GENETIC, returns better result.         |

---

## Warehouse Business Rules (Constraints)

| Field                      | Description                                           |
|----------------------------|-------------------------------------------------------|
| `respect_fefo`             | Sort by earliest expiry date first                    |
| `respect_delivery_date`    | Group boxes by requested delivery date                |
| `prefer_partial_pallets`   | Fill partial pallets before opening new ones          |
| `prefer_location_cluster`  | Group by warehouse location Row→Level→Column→Dept     |
| `allow_rotation`           | Try all 6 box rotations                               |
| `mix_products`             | Allow different SKUs on the same pallet               |

---

## Running Tests

```bash
cd backend
source .venv/bin/activate
pytest app/tests/ -v
```

---

## Known Limitations

1. **Job persistence**: Jobs are stored in-memory. Restarting the server clears all jobs. Switch `job_store.py` to SQLite/Postgres for persistence.
2. **Algorithm performance**: The grid-based placement search (FFD, Best Fit, EP) uses a simple sweep — can be slow for very large orders (500+ items). Extreme Point has O(n²) placement search per box.
3. **Genetic algorithm**: Uses 5 generations × 10 population. Increase `GENERATIONS` and `POPULATION_SIZE` in `genetic.py` for better solutions at the cost of runtime.
4. **Stability validation**: Support fraction check is approximate (axis-aligned overlap). Does not model centre-of-mass tipping.
5. **PDF export**: Placeholder button only. Implement with `reportlab` or `weasyprint` on the backend.
6. **3D viewer performance**: The Three.js viewer renders all boxes as individual meshes. For 1000+ boxes, consider instanced meshes.
7. **Upload parsing**: Column name normalisation handles common variations but may miss unusual formats.
8. **CORS**: Currently allows `localhost:3000` only. Update `CORS_ORIGINS` in `config.py` for production.
