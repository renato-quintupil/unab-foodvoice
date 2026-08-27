-- AlterTable
ALTER TABLE "order" ADD COLUMN     "delivery_user_id" UUID,
ADD COLUMN     "assigned_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "order_status_delivery_user_id_idx" ON "order"("status", "delivery_user_id");

-- E5 · Reparto (D-069, FR-004): un repartidor no puede tener dos pedidos en
-- asignado_repartidor a la vez. Mismo mecanismo que
-- address_one_active_default_per_user_key (E2).
CREATE UNIQUE INDEX "order_one_active_delivery_per_user_key" ON "order"("delivery_user_id")
WHERE "status" = 'asignado_repartidor';

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_delivery_user_id_fkey" FOREIGN KEY ("delivery_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
