import { describe, expect, it } from 'vitest';
import { OrderStatus } from '../src/enums/order-status';
import { Role, UserStatus } from '../src/enums/role';
import { MSG_RANGO_FECHAS_INVALIDO } from '../src/messages/es';
import {
  BusinessOrdersQuerySchema,
  ListUsersQuerySchema,
  OrdersQuerySchema,
  PAGE_SIZE,
} from '../src/schemas/query';

function mensajes(resultado: { success: boolean; error?: unknown }): string[] {
  if (resultado.success) return [];
  return (resultado.error as { issues: { message: string }[] }).issues.map((i) => i.message);
}

describe('PAGE_SIZE (FR-015)', () => {
  it('es 20 y es la única fuente del tamaño de página', () => {
    expect(PAGE_SIZE).toBe(20);
  });
});

describe('ListUsersQuerySchema (FR-015, D-016)', () => {
  it('aplica page = 1 por defecto y acepta los tres filtros combinados', () => {
    const resultado = ListUsersQuerySchema.safeParse({
      search: '  maría  ',
      role: Role.CLIENTE,
      status: UserStatus.ACTIVO,
    });
    expect(resultado.success).toBe(true);
    expect(resultado.success && resultado.data).toEqual({
      search: 'maría',
      role: Role.CLIENTE,
      status: UserStatus.ACTIVO,
      page: 1,
    });
  });

  it('coacciona page desde la cadena de consulta y rechaza valores menores que 1', () => {
    const ok = ListUsersQuerySchema.safeParse({ page: '3' });
    expect(ok.success && ok.data.page).toBe(3);
    expect(ListUsersQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(ListUsersQuerySchema.safeParse({ page: '1.5' }).success).toBe(false);
  });

  it('no expone pageSize ni parámetros de ordenamiento (api CHK004)', () => {
    const resultado = ListUsersQuerySchema.safeParse({ pageSize: 50, sort: 'fullName' });
    expect(resultado.success).toBe(true);
    expect(resultado.success && Object.keys(resultado.data).sort()).toEqual(['page']);
  });
});

describe('OrdersQuerySchema (FR-020, api CHK004)', () => {
  it('acepta el formato AAAA-MM-DD', () => {
    expect(OrdersQuerySchema.safeParse({ from: '2026-08-15', to: '2026-08-31' }).success).toBe(
      true,
    );
  });

  it('rechaza 15-08-2026 con el mensaje en español', () => {
    const resultado = OrdersQuerySchema.safeParse({ from: '15-08-2026' });
    expect(mensajes(resultado)).toContain('Debes ingresar una fecha con el formato AAAA-MM-DD.');
  });

  it('rechaza el día inexistente 2026-02-30', () => {
    const resultado = OrdersQuerySchema.safeParse({ from: '2026-02-30' });
    expect(mensajes(resultado)).toContain('Esa fecha no existe.');
  });

  it('acepta from = to: la misma fecha dos veces es el día completo', () => {
    expect(OrdersQuerySchema.safeParse({ from: '2026-08-15', to: '2026-08-15' }).success).toBe(
      true,
    );
  });

  it('rechaza from > to con MSG_RANGO_FECHAS_INVALIDO', () => {
    const resultado = OrdersQuerySchema.safeParse({ from: '2026-08-16', to: '2026-08-15' });
    expect(resultado.success).toBe(false);
    expect(mensajes(resultado)).toContain(MSG_RANGO_FECHAS_INVALIDO);
  });

  it('acepta cada extremo por separado', () => {
    expect(OrdersQuerySchema.safeParse({ from: '2026-08-15' }).success).toBe(true);
    expect(OrdersQuerySchema.safeParse({ to: '2026-08-15' }).success).toBe(true);
  });

  it('acepta un rango de amplitud extrema y uno enteramente futuro (api CHK026)', () => {
    expect(OrdersQuerySchema.safeParse({ from: '1976-01-01', to: '2076-01-01' }).success).toBe(
      true,
    );
    expect(OrdersQuerySchema.safeParse({ from: '2090-01-01', to: '2090-12-31' }).success).toBe(
      true,
    );
  });

  it('acepta los cinco estados de la máquina compartida', () => {
    for (const estado of Object.values(OrderStatus)) {
      expect(OrdersQuerySchema.safeParse({ status: estado }).success).toBe(true);
    }
    expect(OrdersQuerySchema.safeParse({ status: 'cancelado' }).success).toBe(false);
  });

  it('aplica page = 1 por defecto', () => {
    const resultado = OrdersQuerySchema.safeParse({});
    expect(resultado.success && resultado.data.page).toBe(1);
  });
});

describe('BusinessOrdersQuerySchema (FR-038, FR-041, D-043)', () => {
  it('acepta status creado o en_preparacion', () => {
    expect(BusinessOrdersQuerySchema.safeParse({ status: OrderStatus.CREADO }).success).toBe(
      true,
    );
    expect(
      BusinessOrdersQuerySchema.safeParse({ status: OrderStatus.EN_PREPARACION }).success,
    ).toBe(true);
  });

  it('rechaza un estado ajeno a la bandeja, como rechazado o cerrado', () => {
    expect(BusinessOrdersQuerySchema.safeParse({ status: OrderStatus.RECHAZADO }).success).toBe(
      false,
    );
    expect(BusinessOrdersQuerySchema.safeParse({ status: OrderStatus.CERRADO }).success).toBe(
      false,
    );
  });

  it('sin status es válido: la bandeja combina ambos estados', () => {
    expect(BusinessOrdersQuerySchema.safeParse({}).success).toBe(true);
  });

  it('aplica page = 1 por defecto y rechaza página menor que 1', () => {
    const resultado = BusinessOrdersQuerySchema.safeParse({});
    expect(resultado.success && resultado.data.page).toBe(1);
    expect(BusinessOrdersQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });
});
