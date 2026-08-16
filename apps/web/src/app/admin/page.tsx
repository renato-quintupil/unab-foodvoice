import Link from 'next/link';
import {
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_ROL,
  MSG_SIN_DATOS_PEDIDOS,
  OrderStatus,
  Role,
} from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel · FoodVoice' };

type Metricas = {
  activeUsersByRole: Record<Role, number>;
  ordersByStatus: Record<OrderStatus, number>;
};

/**
 * Panel del administrador (T113, FR-019, FR-021, FR-023, FR-031).
 *
 * Es la **página de inicio del administrador**: al completarse la Fase D,
 * aterriza aquí y no en la gestión de usuarios.
 *
 * **De solo lectura.** El enlace a Usuarios no incumple FR-021 —navegar no es
 * modificar—, y el inventario de `vistas-panel.ts` lo deja verificable contra
 * una lista cerrada.
 *
 * Muestra **siempre** los cuatro roles y los cinco estados aunque valgan cero,
 * y **sin ninguna alusión a épicas futuras**: que los pedidos lleguen en E4/E2
 * es información del calendario del proyecto, no del administrador
 * (ux CHK022, ux CHK028).
 */
export default async function PaginaPanel() {
  const metricas = await pedirALaApi<Metricas>('/admin/dashboard/metrics');

  const totalPedidos = Object.values(metricas.ordersByStatus).reduce(
    (suma, cifra) => suma + cifra,
    0,
  );

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Panel</h1>

      <section aria-labelledby="usuarios-activos" className="flex flex-col gap-3">
        <h2 id="usuarios-activos" className="text-lg font-medium">
          Usuarios activos por rol
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.values(Role).map((rol) => (
            <Cifra key={rol} etiqueta={ETIQUETA_ROL[rol]} valor={metricas.activeUsersByRole[rol]} />
          ))}
        </div>
        <p>
          <Link
            href="/admin/usuarios"
            className="text-sm text-[var(--color-primario)] underline underline-offset-4"
          >
            Ver la gestión de usuarios
          </Link>
        </p>
      </section>

      <section aria-labelledby="pedidos-estado" className="flex flex-col gap-3">
        <h2 id="pedidos-estado" className="text-lg font-medium">
          Pedidos por estado
        </h2>

        {/* El mensaje de «sin datos» donde no hay pedidos (FR-022). */}
        {totalPedidos === 0 && (
          <p className="text-sm text-[var(--color-tenue)]">{MSG_SIN_DATOS_PEDIDOS}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Las etiquetas salen de ETIQUETA_ESTADO_PEDIDO, de modo que el
              panel nombre los estados de la máquina compartida y ninguno
              propio (FR-023). */}
          {Object.values(OrderStatus).map((estado) => (
            <Cifra
              key={estado}
              etiqueta={ETIQUETA_ESTADO_PEDIDO[estado]}
              valor={metricas.ordersByStatus[estado]}
            />
          ))}
        </div>

        <p>
          <Link
            href="/admin/pedidos"
            className="text-sm text-[var(--color-primario)] underline underline-offset-4"
          >
            Ver el reporte de pedidos
          </Link>
        </p>
      </section>

      {/* El menú, que los cuatro roles consultan por igual (T073 de E3,
          supuesto 13). El administrador lo ve **como el cliente**: navegar no es
          modificar, y desde aquí no hay ninguna entrada a la administración del
          catálogo, que es del rol negocio (FR-027). */}
      <section aria-labelledby="menu" className="flex flex-col gap-3">
        <h2 id="menu" className="text-lg font-medium">
          Menú
        </h2>
        <p>
          <Link
            href="/menu"
            className="text-sm text-[var(--color-primario)] underline underline-offset-4"
          >
            Ver el menú del local
          </Link>
        </p>
      </section>
    </div>
  );
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-md border border-[var(--color-borde)] px-4 py-3">
      <p className="text-sm text-[var(--color-tenue)]">{etiqueta}</p>
      <p className="text-2xl font-semibold">{valor}</p>
    </div>
  );
}
