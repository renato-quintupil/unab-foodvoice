-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminAction" ADD VALUE 'PAUSAR_SERVICIO';
ALTER TYPE "AdminAction" ADD VALUE 'REANUDAR_SERVICIO';

-- AlterTable
ALTER TABLE "admin_audit_log" ADD COLUMN     "reason" TEXT,
ALTER COLUMN "target_user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "order_status_event" ADD COLUMN     "reason" TEXT;

-- CreateTable
CREATE TABLE "service_status" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "pause_reason" TEXT,
    "paused_at" TIMESTAMPTZ(3),
    "paused_by_user_id" UUID,

    CONSTRAINT "service_status_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "service_status" ADD CONSTRAINT "service_status_paused_by_user_id_fkey" FOREIGN KEY ("paused_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Siembra la fila única del servicio (D-085): v1 es mono-local, un único
-- interruptor activo/pausado. `OrdersService` y `ServiceStatusService`
-- siempre leen y escriben por este `id` fijo.
INSERT INTO "service_status" ("id", "paused") VALUES ('singleton', false);
