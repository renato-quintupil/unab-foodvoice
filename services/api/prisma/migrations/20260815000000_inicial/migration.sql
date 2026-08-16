-- Migración inicial de E1 · Acceso y usuarios (data-model.md)
--
-- Dos cosas de este archivo no proceden del esquema Prisma y se escriben a mano:
--
--   1. La población de `search_normalized` en **tres pasos** —nullable, UPDATE,
--      NOT NULL— según D-011. En E1 la tabla nace vacía y el UPDATE no afecta a
--      ninguna fila, pero el procedimiento queda declarado para cuando una
--      migración posterior cambie la definición sobre datos existentes.
--   2. El disparador `admin_audit_log_inmutable`. Prisma no expresa disparadores
--      en su esquema, así que la migración es el **único** lugar donde puede
--      vivir la garantía de inmutabilidad que FR-034 exige y que una convención
--      de código no da (data CHK008).

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENTE', 'NEGOCIO', 'REPARTIDOR', 'ADMINISTRADOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVO', 'DESACTIVADO');

-- CreateEnum
-- Seis valores, uno por cada acción de FR-034 y ninguno más: la ausencia de
-- valores para los eventos de autenticación hace estructural su exclusión.
CREATE TYPE "AdminAction" AS ENUM ('CREAR', 'EDITAR', 'CAMBIAR_ROL', 'DESACTIVAR', 'REACTIVAR', 'RESTABLECER_PASSWORD');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- `search_normalized` en tres pasos (D-011).
ALTER TABLE "user" ADD COLUMN "search_normalized" TEXT;
UPDATE "user" SET "search_normalized" = lower("full_name" || ' ' || "email") WHERE "search_normalized" IS NULL;
ALTER TABLE "user" ALTER COLUMN "search_normalized" SET NOT NULL;

-- CreateTable
-- Sin restricción de unicidad sobre `user_id`: un usuario puede tener varias
-- sesiones vivas a la vez, en distintos navegadores (security CHK004).
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Sin clave foránea hacia `user`, deliberadamente: si la tuviera sería
-- imposible contar intentos sobre correos no registrados y el sistema
-- respondería distinto para una cuenta existente que para una inexistente,
-- filtrando lo que FR-008 prohíbe filtrar.
CREATE TABLE "login_attempt_control" (
    "email" TEXT NOT NULL,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "login_attempt_control_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "action" "AdminAction" NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_search_normalized_idx" ON "user"("search_normalized");

-- CreateIndex
CREATE INDEX "user_role_status_idx" ON "user"("role", "status");

-- CreateIndex
-- Orden por defecto del listado (D-016). El desempate por `id` hace el orden
-- total: sin él, dos altas con la misma marca de tiempo pueden intercambiarse
-- entre consultas y hacer que un usuario aparezca dos veces o ninguna.
CREATE INDEX "user_created_at_id_idx" ON "user"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- AddForeignKey
-- `RESTRICT` y no `CASCADE`: el diseño no contempla borrado físico (RN-002), y
-- si alguien lo intentara la operación debe **fallar** en el motor en lugar de
-- llevarse por delante la bitácora que FR-034 exige conservar.
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Disparador de inmutabilidad de la bitácora (FR-034, data CHK008).
--
-- La convención de código no bastaba: FR-034 exige que el registro «nunca se
-- edita ni se borra», y una regla que solo vive en la disciplina de quien
-- programa se rompe con un `deleteMany()` escrito de buena fe en un test o en un
-- script de mantenimiento. Con el disparador, esa llamada falla.
--
-- Dos consecuencias asumidas, ambas deseables: una migración futura que necesite
-- reescribir esta tabla tendrá que desactivarlo de forma deliberada y visible; y
-- el aislamiento entre tests de integración no puede usar `DELETE`, así que el
-- arranque compartido usa `TRUNCATE ... CASCADE`, que no dispara disparadores de
-- fila (T049).
CREATE FUNCTION admin_audit_log_solo_insercion() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log es de solo inserción (FR-034)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_audit_log_inmutable
  BEFORE UPDATE OR DELETE ON "admin_audit_log"
  FOR EACH ROW EXECUTE FUNCTION admin_audit_log_solo_insercion();
