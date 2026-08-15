/**
 * Panel y reporte de pedidos (T116, FR-019, FR-021, FR-022, FR-023, SC-015,
 * SC-020).
 */
import { render, screen } from '@testing-library/react';
import {
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_ROL,
  MSG_SIN_DATOS_PEDIDOS,
  MSG_SIN_RESULTADOS_PEDIDOS,
  OrderStatus,
  Role,
} from '@foodvoice/shared';
import { describe, expect, it, vi } from 'vitest';
import { FiltrosPedidos } from '@/app/admin/pedidos/filtros-pedidos';
import {
  VISTAS_DEL_PANEL,
  elPanelEsDeSoloLectura,
} from '@/app/admin/_components/vistas-panel';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * El panel es un Server Component asíncrono, así que aquí se ejerce lo que sí
 * es comprobable sin servidor: su vocabulario visible, el inventario de vistas
 * y los filtros del reporte. Las cifras contra el padrón las verifica el paso
 * C2 de la guía, y el conteo, T106.
 */

describe('Vocabulario visible (ux CHK028)', () => {
  it('los cuatro roles tienen etiqueta y ninguna es el identificador interno', () => {
    for (const rol of Object.values(Role)) {
      expect(ETIQUETA_ROL[rol]).toBeTruthy();
      expect(ETIQUETA_ROL[rol]).not.toBe(rol);
    }
  });

  it('los cinco estados de pedido tienen etiqueta visible', () => {
    for (const estado of Object.values(OrderStatus)) {
      expect(ETIQUETA_ESTADO_PEDIDO[estado]).toBeTruthy();
      expect(ETIQUETA_ESTADO_PEDIDO[estado]).not.toBe(estado);
    }
  });

  it('los mensajes de sin datos están en español y no mencionan épicas futuras', () => {
    for (const mensaje of [MSG_SIN_DATOS_PEDIDOS, MSG_SIN_RESULTADOS_PEDIDOS]) {
      expect(mensaje).toBeTruthy();
      // El calendario del proyecto no es información del administrador
      // (ux CHK022).
      expect(mensaje).not.toMatch(/E\d|épica|proximamente|próximamente|pendiente/i);
    }
  });
});

describe('Inventario de vistas del panel (T115, SC-015, ux CHK034)', () => {
  it('ninguna vista ofrece acciones que modifiquen datos', () => {
    expect(elPanelEsDeSoloLectura()).toBe(true);
    for (const vista of VISTAS_DEL_PANEL) {
      expect(vista.accionesDeEscritura).toEqual([]);
    }
  });

  it('el inventario es una lista cerrada y cada entrada declara qué muestra', () => {
    // Sin inventario, «el 100 % de las vistas» no es verificable porque nadie
    // puede afirmar que las visitó todas.
    expect(VISTAS_DEL_PANEL.length).toBeGreaterThan(0);
    for (const vista of VISTAS_DEL_PANEL) {
      expect(vista.ruta).toMatch(/^\/admin/);
      expect(vista.nombre).toBeTruthy();
      expect(vista.contenido).toBeTruthy();
    }
  });

  it('cubre las dos vistas del panel: el panel y el reporte', () => {
    expect(VISTAS_DEL_PANEL.map((v) => v.ruta).sort()).toEqual(
      ['/admin', '/admin/pedidos'].sort(),
    );
  });
});

describe('Filtros del reporte de pedidos (FR-020, ux CHK021)', () => {
  it('presenta estado y rango de fechas con etiquetas en español', () => {
    render(<FiltrosPedidos />);
    expect(screen.getByLabelText('Estado')).toBeInTheDocument();
    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    expect(screen.getByLabelText('Hasta')).toBeInTheDocument();
  });

  it('nombra los cinco estados de la máquina compartida y ninguno propio', () => {
    render(<FiltrosPedidos />);
    const opciones = screen
      .getAllByRole('option')
      .map((opcion) => opcion.textContent)
      .filter((texto) => texto !== 'Todos');

    expect(opciones.sort()).toEqual(
      Object.values(OrderStatus)
        .map((estado) => ETIQUETA_ESTADO_PEDIDO[estado])
        .sort(),
    );
    expect(opciones).not.toContain('Cancelado');
  });

  it('los campos de fecha no muestran el formato interno en pantalla', () => {
    render(<FiltrosPedidos />);
    // `type="date"` se presenta en el formato local del navegador y envía
    // AAAA-MM-DD, que es lo que el esquema compartido valida.
    expect(screen.getByLabelText('Desde')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Hasta')).toHaveAttribute('type', 'date');
  });

  it('no ofrece ningún control de escritura (FR-021, RN-004)', () => {
    render(<FiltrosPedidos />);
    const botones = screen.getAllByRole('button').map((b) => b.textContent);
    expect(botones).toEqual(['Aplicar filtros']);
  });
});
