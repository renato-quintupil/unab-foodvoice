-- CreateEnum
CREATE TYPE "Dimension" AS ENUM ('TIPO_COMIDA', 'PERFIL_SALUD');

-- CreateTable
CREATE TABLE "category" (
    "id" UUID NOT NULL,
    "dimension" "Dimension" NOT NULL,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ingredients" TEXT,
    "price" INTEGER NOT NULL,
    "food_type_category_id" UUID NOT NULL,
    "health_profile_category_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_dimension_active_idx" ON "category"("dimension", "active");

-- CreateIndex
CREATE UNIQUE INDEX "category_dimension_name_normalized_key" ON "category"("dimension", "name_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "product_name_normalized_key" ON "product"("name_normalized");

-- CreateIndex
CREATE INDEX "product_active_available_idx" ON "product"("active", "available");

-- CreateIndex
CREATE INDEX "product_price_idx" ON "product"("price");

-- CreateIndex
CREATE INDEX "product_created_at_id_idx" ON "product"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "product_food_type_category_id_idx" ON "product"("food_type_category_id");

-- CreateIndex
CREATE INDEX "product_health_profile_category_id_idx" ON "product"("health_profile_category_id");

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_food_type_category_id_fkey" FOREIGN KEY ("food_type_category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_health_profile_category_id_fkey" FOREIGN KEY ("health_profile_category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Restricción de rango del precio (D-026, FR-015, RN-006).
--
-- Se añade a mano porque el esquema de Prisma no expresa un CHECK. Es la
-- **segunda línea de defensa** tras el esquema Zod: garantiza que ninguna vía de
-- escritura —una migración, la semilla, una consulta a mano— pueda dejar un
-- precio inválido, y no solo las que pasan por la API.
-- ---------------------------------------------------------------------------
ALTER TABLE "product"
  ADD CONSTRAINT "product_price_range_check"
  CHECK ("price" >= 1 AND "price" <= 10000000);
