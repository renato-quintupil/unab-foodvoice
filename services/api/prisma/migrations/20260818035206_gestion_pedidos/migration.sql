-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('creado', 'en_preparacion', 'asignado_repartidor', 'entregado', 'cerrado', 'rechazado');

-- CreateTable
CREATE TABLE "cart" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_line" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "cart_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "label_normalized" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "used_in_order" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'creado',
    "address_text" TEXT NOT NULL,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_line" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_event" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "previous_status" "OrderStatus",
    "resulting_status" "OrderStatus" NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "actor_role" "Role" NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cart_user_id_key" ON "cart"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_line_cart_id_product_id_key" ON "cart_line"("cart_id", "product_id");

-- CreateIndex
CREATE INDEX "address_user_id_active_idx" ON "address"("user_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "address_user_id_label_normalized_key" ON "address"("user_id", "label_normalized");

-- CreateIndex
CREATE INDEX "order_status_created_at_id_idx" ON "order"("status", "created_at", "id");

-- CreateIndex
CREATE INDEX "order_user_id_created_at_idx" ON "order"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "order_line_order_id_idx" ON "order_line"("order_id");

-- CreateIndex
CREATE INDEX "order_status_event_order_id_occurred_at_id_idx" ON "order_status_event"("order_id", "occurred_at", "id");

-- AddForeignKey
ALTER TABLE "cart" ADD CONSTRAINT "cart_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_line" ADD CONSTRAINT "cart_line_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_line" ADD CONSTRAINT "cart_line_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "address_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_event" ADD CONSTRAINT "order_status_event_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_event" ADD CONSTRAINT "order_status_event_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Restricciones que Prisma no expresa en schema.prisma (data-model.md § SQL
-- añadido en la migración, mismo patrón que E3 con el rango de precio, D-026).
-- ---------------------------------------------------------------------------

-- CheckConstraint: cantidades mínimas (FR-003, FR-027).
ALTER TABLE "cart_line" ADD CONSTRAINT "cart_line_quantity_check" CHECK (quantity >= 1);
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_quantity_check" CHECK (quantity >= 1);

-- CheckConstraint: una dirección inactiva no puede seguir predeterminada (D-049).
ALTER TABLE "address"
  ADD CONSTRAINT "address_default_must_be_active_check"
  CHECK (NOT is_default OR active);

-- Índice único parcial: a lo sumo una dirección predeterminada activa por
-- cliente, incluso bajo escrituras concurrentes (FR-015, D-049).
CREATE UNIQUE INDEX "address_one_active_default_per_user_key"
  ON "address" (user_id)
  WHERE active AND is_default;

-- CheckConstraint: la forma de un evento de historial (FR-042, FR-043, D-047).
-- El evento inicial no tiene estado anterior y resulta en 'creado'; cualquier
-- otro evento tiene estado anterior distinto del resultante y nunca resulta
-- en 'creado' (crear el pedido es la única forma de llegar a ese estado).
ALTER TABLE "order_status_event"
  ADD CONSTRAINT "order_status_event_shape_check"
  CHECK (
    (previous_status IS NULL AND resulting_status = 'creado')
    OR
    (
      previous_status IS NOT NULL
      AND previous_status <> resulting_status
      AND resulting_status <> 'creado'
    )
  );

-- Índice único parcial: como mucho un evento inicial por pedido (FR-042).
CREATE UNIQUE INDEX "order_status_event_one_initial_per_order_key"
  ON "order_status_event" (order_id)
  WHERE previous_status IS NULL;

-- Trigger append-only: ningún UPDATE ni DELETE sobre el historial, ni
-- siquiera fuera del servicio (FR-044, Principio XII). Mismo patrón que
-- `admin_audit_log` de E1.
CREATE FUNCTION prevent_order_status_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'order_status_event is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_status_event_append_only
BEFORE UPDATE OR DELETE ON "order_status_event"
FOR EACH ROW EXECUTE FUNCTION prevent_order_status_event_mutation();
