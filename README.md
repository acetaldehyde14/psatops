# Palletisation Optimiser

A full-stack web application for 3D warehouse palletisation optimisation, supporting multiple packing algorithms, Excel/CSV/JSON upload, interactive 3D visualisation, manual layout adjustment, and exportable results.

---

## Stack

| Layer     | Technology                                   |
|-----------|----------------------------------------------|
| Frontend  | Next.js 14, React, TypeScript, TailwindCSS   |
| 3D        | React Three Fiber / Three.js                 |
| Backend   | Java 21, Spring Boot 3.3, Gradle             |
| Storage   | In-memory (no database required)             |
| Parsing   | Apache POI (Excel), Apache Commons CSV       |

---

## Project Structure

```
.
├── backend/          # Java Spring Boot backend (port 8000)
├── frontend/         # Next.js frontend (port 3000)
└── docker-compose.yml
```

### Backend package layout (`backend/src/main/java/com/psap/palletisation/`)

```
algorithm/       # FirstFit, BestFit, ExtremePoint, Genetic, OptimiserService
algorithm/util/  # PlacementUtils, RotationUtils, ScoringUtils, StabilityUtils
controller/      # PalletiseController, JobController, UploadController, HealthController
dto/request/     # PalletiseRequest, ItemRequest, Constraints, PalletSpec, LayoutPatchRequest
dto/response/    # PalletiseResponse, BoxResult, PalletResult, SummaryResult, ...
enums/           # AlgorithmType, StackBy, FractionalQuantityMode
model/           # Box, Pallet (internal domain models)
service/         # JobStoreService, ValidationService, LayoutValidationService, ExportService, ParserService
exception/       # GlobalExceptionHandler
config/          # WebConfig (CORS)
```

---

## Quick Start (Local Dev)

### Backend

Requires Java 21. Gradle wrapper is included — no global Gradle install needed.

```bash
cd backend
./gradlew bootRun
```

Or build and run the JAR directly:

```bash
cd backend
./gradlew bootJar -x test
java -jar build/libs/palletisation-0.1.0-SNAPSHOT.jar
```

API available at: http://localhost:8000

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

## Running Tests

```bash
cd backend
./gradlew test
```

28 unit and integration tests covering all four algorithms, validation service, layout validation, and controller endpoints.

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

Accepted file types: `.csv`, `.xlsx`, `.xls`, `.json`

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
      "width_mm": 1100,
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
    "pallet": {"length_mm": 1200, "width_mm": 1100, "max_height_mm": 1150, "max_weight_kg": 1500},
    "constraints": {"allow_rotation": true, "stack_by": "weight", "mix_products": true, "respect_fefo": true},
    "items": [{"sku": "BOX-A", "quantity": 5, "length_mm": 300, "width_mm": 200, "height_mm": 150, "weight_kg": 1.5}]
  }'
```

### POST /api/v1/upload

```bash
curl -X POST http://localhost:8000/api/v1/upload \
  -F "file=@sample_order.csv"
```

### GET /api/v1/jobs/{job_id}

```bash
curl http://localhost:8000/api/v1/jobs/job_abc123def456
```

### PATCH /api/v1/jobs/{job_id}/layout

Submit a manually adjusted layout for validation and persistence.

```bash
curl -X PATCH http://localhost:8000/api/v1/jobs/job_abc123def456/layout \
  -H "Content-Type: application/json" \
  -d '{"pallets": [...], "settings": {}}'
```

### GET /api/v1/jobs/{job_id}/export/csv

```bash
curl -o result.csv http://localhost:8000/api/v1/jobs/job_abc123def456/export/csv
```

---

## Algorithms

| Algorithm      | Description                                                        |
|----------------|--------------------------------------------------------------------|
| `FIRST_FIT`    | First Fit Decreasing. Fast baseline, good for large orders.        |
| `BEST_FIT`     | Best Fit — minimises residual space per pallet.                    |
| `EXTREME_POINT`| 3D Extreme Point packing. Best default for most orders.            |
| `GENETIC`      | Genetic algorithm evolving box ordering over 5 generations.        |
| `AUTO`         | Runs `EXTREME_POINT` + `GENETIC`, returns the better result.       |

Auto-selection thresholds (when `algorithm` is `AUTO`):
- ≤ 10 items → Extreme Point only
- 11–50 items → Extreme Point vs Genetic, pick lower score
- > 50 items → First Fit

---

## Warehouse Business Rules (Constraints)

| Field                       | Default | Description                                            |
|-----------------------------|---------|--------------------------------------------------------|
| `allow_rotation`            | `true`  | Try all 6 box orientations                             |
| `fractional_quantity_mode`  | `ceil`  | How to handle fractional carton quantities             |
| `do_not_allow_stability_issues` | `true` | Reject placements with floating/unstable boxes     |
| `prefer_larger_base`        | `false` | Prioritise orientations with the largest base area     |
| `enforce_no_load_on_top`    | `true`  | Respect `no_load_on_top` box flags                     |
| `stack_by`                  | `weight`| Primary sort key: `weight`, `volume`, or `height`      |
| `mix_products`              | `true`  | Allow different SKUs on the same pallet                |
| `respect_fefo`              | `true`  | Sort by earliest expiry date first                     |
| `respect_delivery_date`     | `false` | Group boxes by requested delivery date                 |
| `prefer_partial_pallets`    | `true`  | Fill partial pallets before opening new ones           |
| `prefer_location_cluster`   | `true`  | Group by warehouse location Row→Level→Column→Dept      |

---

## Known Limitations

1. **Job persistence** — Jobs are stored in-memory. Restarting the server clears all jobs. To add persistence, implement a `JobRepository` with Spring Data JPA backed by SQLite or PostgreSQL.
2. **Algorithm performance** — Extreme Point has O(n²) placement search per box. For very large orders (500+ items), `FIRST_FIT` is faster.
3. **Genetic algorithm** — Uses 5 generations × 10 population. Increase `GENERATIONS` and `POPULATION_SIZE` in `GeneticAlgorithm.java` for better solutions at the cost of runtime.
4. **Stability validation** — Support fraction check is approximate (axis-aligned overlap). Does not model centre-of-mass tipping.
5. **3D viewer performance** — The Three.js viewer renders all boxes as individual meshes. For 1000+ boxes, consider instanced meshes.
6. **CORS** — Currently allows all origins (`*`). Restrict in `WebConfig.java` for production.
