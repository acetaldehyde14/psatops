# CargoClique Database Usage

This project uses MySQL when the backend is started with the `cargoclique` Spring profile.

```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=cargoclique --spring.datasource.password=password'
```

The profile is defined in:

```text
backend/src/main/resources/application-cargoclique.properties
```

Default connection:

```text
jdbc:mysql://localhost:3306/cargoclique?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
```

## Existing CargoClique Tables Reviewed

The `cargoclique` schema already contains operational CargoClique tables. The relevant order/staging tables inspected were:

| Table | Purpose |
| --- | --- |
| `smartpick_upload_batch` | Smartpick upload batch metadata. |
| `smartpick_order_line` | Smartpick order line staging data. Indexed by `order_ref`, `prod_code`, and `upload_id`. |
| `cust_order` | Existing customer order line table. |
| `cust_order_trans` | Existing customer order upload/transaction table. |
| `cust_order_prod_code_mapping` | Existing external-to-internal product mapping table. |
| `cargo_owner` | Existing cargo owner metadata. |
| `cargo_warehouse` | Existing warehouse metadata. |

The optimiser does not modify these existing CargoClique tables.

## Optimiser Tables Added

Hibernate creates/updates these project-owned tables in `cargoclique` when the backend starts with `spring.jpa.hibernate.ddl-auto=update`.

| Table | Used For |
| --- | --- |
| `sku_master` | SKU master data used by the integration API. Stores dimensions, weight, rotation rules, stacking rules, location, family, and labels. |
| `integration_order` | Optimisation order requests received through the integration API. Stores order status, selected pallet spec JSON, constraints JSON, job id, and error details. |
| `integration_job` | Optimisation job tracking by `job_id` and `order_id`, including status, algorithm used, start/completion times, and errors. |
| `integration_result` | One summary row per optimised order. Stores pallet count, cube/floor utilisation, total weight, status, and error details. |
| `integration_result_box` | Box-level placement output for each optimised order. Stores pallet number, SKU, sequence, coordinates, rotation, quantity, and utilisation metadata. |

## Create Table SQL

These are the exact table definitions produced in local MySQL by Hibernate for the optimiser-owned tables.

```sql
CREATE TABLE `sku_master` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `allow_rotation` bit(1) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `family` varchar(255) DEFAULT NULL,
  `height_mm` double DEFAULT NULL,
  `label` varchar(255) DEFAULT NULL,
  `length_mm` double DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `max_stack_height_mm` double DEFAULT NULL,
  `max_stack_weight_kg` double DEFAULT NULL,
  `no_load_on_top` bit(1) DEFAULT NULL,
  `org_id` varchar(255) NOT NULL,
  `sku_id` varchar(255) NOT NULL,
  `stack_rule` varchar(255) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `weight_kg` double DEFAULT NULL,
  `width_mm` double DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKndnqtu9040i4lv2rx1gi9owpo` (`org_id`,`sku_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `integration_order` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `constraints_json` text,
  `created_at` datetime(6) DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `delivery_date` varchar(255) DEFAULT NULL,
  `error_code` int DEFAULT NULL,
  `error_description` text,
  `job_id` varchar(255) DEFAULT NULL,
  `load_type` varchar(255) DEFAULT NULL,
  `order_id` varchar(255) NOT NULL,
  `org_id` varchar(255) NOT NULL,
  `pallet_spec_json` text,
  `status` varchar(255) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK3b1hqyoixtln1y3nwa9aa5xf1` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `integration_job` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `algorithm_used` varchar(255) DEFAULT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `error_message` text,
  `job_id` varchar(255) NOT NULL,
  `order_id` varchar(255) NOT NULL,
  `started_at` datetime(6) DEFAULT NULL,
  `status` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK77k4tmli440fxeox5ub3dug0k` (`job_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `integration_result` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `cube_percent` double DEFAULT NULL,
  `cut_count` int DEFAULT NULL,
  `error_code` int DEFAULT NULL,
  `error_description` text,
  `floor_percent` double DEFAULT NULL,
  `job_id` varchar(255) DEFAULT NULL,
  `load_count` int DEFAULT NULL,
  `order_id` varchar(255) NOT NULL,
  `pallet_count` int DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `total_weight_kg` double DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKofpoy99syxc8c610rnacumn5w` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `integration_result_box` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `cube_percent` double DEFAULT NULL,
  `dim_vert` double DEFAULT NULL,
  `floor_percent` double DEFAULT NULL,
  `order_id` varchar(255) NOT NULL,
  `order_num` varchar(255) DEFAULT NULL,
  `org_id` varchar(255) DEFAULT NULL,
  `pallet_no` int DEFAULT NULL,
  `pallet_type` varchar(255) DEFAULT NULL,
  `priority` varchar(255) DEFAULT NULL,
  `quantity` double DEFAULT NULL,
  `rotation` varchar(255) DEFAULT NULL,
  `seq_num` int DEFAULT NULL,
  `sku_id` varchar(255) DEFAULT NULL,
  `stop` varchar(255) DEFAULT NULL,
  `total_weight_kg` double DEFAULT NULL,
  `unitized` bit(1) DEFAULT NULL,
  `x1` double DEFAULT NULL,
  `x2` double DEFAULT NULL,
  `y1` double DEFAULT NULL,
  `y2` double DEFAULT NULL,
  `z1` double DEFAULT NULL,
  `z2` double DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## Insert SQL Examples

In normal use, the app inserts these rows through the integration API and optimisation service. These SQL examples show the shape of the data written to MySQL.

```sql
INSERT INTO sku_master (
  org_id,
  sku_id,
  description,
  length_mm,
  width_mm,
  height_mm,
  weight_kg,
  allow_rotation,
  no_load_on_top,
  stack_rule,
  location,
  family,
  label,
  max_stack_weight_kg,
  max_stack_height_mm,
  created_at,
  updated_at
) VALUES (
  'ORG1',
  'SKU-A',
  'Test SKU A',
  300,
  200,
  150,
  2.5,
  b'1',
  b'0',
  'weight',
  'R01-L02-C03-D04',
  'GENERAL',
  'A',
  50,
  1150,
  CURRENT_TIMESTAMP(6),
  CURRENT_TIMESTAMP(6)
);

INSERT INTO integration_order (
  order_id,
  org_id,
  customer_name,
  delivery_date,
  load_type,
  pallet_spec_json,
  constraints_json,
  status,
  job_id,
  created_at,
  updated_at
) VALUES (
  'ORDER-001',
  'ORG1',
  'Test Customer',
  '2026-05-19',
  'MIXED_PALLET',
  '{"length_mm":1200,"width_mm":1100,"max_height_mm":1150,"max_weight_kg":1500}',
  '{"constraints":{"allow_rotation":true,"stack_by":"weight","mix_products":true},"skuList":[{"skuId":"SKU-A","quantity":2,"orderNum":"ORD-001"}]}',
  'RECEIVED',
  NULL,
  CURRENT_TIMESTAMP(6),
  CURRENT_TIMESTAMP(6)
);

INSERT INTO integration_job (
  order_id,
  job_id,
  status,
  algorithm_used,
  started_at,
  completed_at,
  error_message
) VALUES (
  'ORDER-001',
  'job_example001',
  'COMPLETED',
  'EXTREME_POINT',
  CURRENT_TIMESTAMP(6),
  CURRENT_TIMESTAMP(6),
  NULL
);

UPDATE integration_order
SET
  status = 'COMPLETED',
  job_id = 'job_example001',
  updated_at = CURRENT_TIMESTAMP(6)
WHERE order_id = 'ORDER-001';

INSERT INTO integration_result (
  order_id,
  job_id,
  load_count,
  cut_count,
  cube_percent,
  floor_percent,
  pallet_count,
  total_weight_kg,
  status,
  error_code,
  error_description,
  created_at
) VALUES (
  'ORDER-001',
  'job_example001',
  1,
  0,
  1.36,
  4.55,
  1,
  5.0,
  'COMPLETED',
  NULL,
  NULL,
  CURRENT_TIMESTAMP(6)
);

INSERT INTO integration_result_box (
  order_id,
  pallet_no,
  pallet_type,
  order_num,
  sku_id,
  quantity,
  seq_num,
  x1,
  y1,
  z1,
  x2,
  y2,
  z2,
  rotation,
  dim_vert,
  stop,
  priority,
  unitized,
  org_id,
  cube_percent,
  floor_percent,
  total_weight_kg
) VALUES
  (
    'ORDER-001',
    1,
    'STANDARD',
    'ORD-001',
    'SKU-A',
    1,
    1,
    0,
    0,
    0,
    300,
    200,
    150,
    'LWH',
    150,
    NULL,
    NULL,
    b'0',
    'ORG1',
    1.36,
    4.55,
    2.5
  ),
  (
    'ORDER-001',
    1,
    'STANDARD',
    'ORD-001',
    'SKU-A',
    1,
    2,
    300,
    0,
    0,
    600,
    200,
    150,
    'LWH',
    150,
    NULL,
    NULL,
    b'0',
    'ORG1',
    1.36,
    4.55,
    2.5
  );
```

Useful lookup queries:

```sql
SELECT *
FROM integration_order
WHERE order_id = 'ORDER-001';

SELECT *
FROM integration_result
WHERE order_id = 'ORDER-001';

SELECT *
FROM integration_result_box
WHERE order_id = 'ORDER-001'
ORDER BY pallet_no, seq_num;
```

## Lookup Flow

The dashboard order search calls:

```text
GET /api/v1/orders/{orderId}/optimisation
```

Lookup order:

1. Check the in-memory job store for a currently running or recently generated result.
2. Fall back to `integration_result` and `integration_result_box` in MySQL.
3. Rebuild a `PalletiseResponse` so the existing results page can render the persisted optimisation.

The results page also has a database fallback through:

```text
GET /api/v1/jobs/{jobId}
```

That endpoint checks `integration_result.job_id` if the result is no longer present in memory.

## Required Runtime Notes

- The default profile still uses H2 in-memory storage.
- Use the `cargoclique` profile to persist integration orders and optimisation results in MySQL.
- Keep MySQL credentials outside committed config where possible by passing `SPRING_DATASOURCE_PASSWORD` or `--spring.datasource.password=...` at runtime.
