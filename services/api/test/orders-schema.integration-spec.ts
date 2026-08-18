/**
 * El esquema de gestión de pedidos: migración, índices, checks, el índice
 * único parcial de dirección predeterminada, el evento inicial único y el
 * trigger append-only del historial (T023, T024, data-model.md, FR-042–FR-044).
 *
 * Es de integración por definición: son garantías que solo PostgreSQL puede
 * dar, no el código de la aplicación.
 */
import { OrderStatus, Role } from '@prisma/client';
import { normalizarBusqueda } from '@foodvoice/shared';
import { crearClasificacionMinima, crearProducto, crearUsuario } from './helpers';
import { prisma } from './setup';

describe('Migración de gestión de pedidos', () => {
  it('crea las seis tablas nuevas', async () => {
    const tablas = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('cart', 'cart_line', 'address', 'order', 'order_line', 'order_status_event')
      ORDER BY table_name
    `;
    expect(tablas.map((t) => t.table_name)).toEqual(
      ['address', 'cart', 'cart_line', 'order', 'order_line', 'order_status_event'].sort(),
    );
  });

  it('amplía el enum OrderStatus a seis valores, sin tocar los cinco existentes', async () => {
    const valores = await prisma.$queryRaw<{ enumlabel: string }[]>`
      SELECT e.enumlabel FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'OrderStatus'
      ORDER BY e.enumsortorder
    `;
    expect(valores.map((v) => v.enumlabel)).toEqual([
      'creado',
      'en_preparacion',
      'asignado_repartidor',
      'entregado',
      'cerrado',
      'rechazado',
    ]);
  });

  it('ninguna tabla de E1 ni de E3 gana columnas', async () => {
    const columnasUser = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user'
    `;
    expect(columnasUser).toHaveLength(10);

    const columnasProduct = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'product'
    `;
    expect(columnasProduct).toHaveLength(12);
  });

  it('declara las claves foráneas de las seis tablas', async () => {
    const fks = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
      WHERE contype = 'f'
        AND conrelid::regclass::text IN ('cart', 'cart_line', 'address', '"order"', 'order_line', 'order_status_event')
    `;
    expect(fks.length).toBeGreaterThanOrEqual(9);
  });

  it('declara los índices que data-model.md exige', async () => {
    const indices = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('cart', 'cart_line', 'address', 'order', 'order_line', 'order_status_event')
      ORDER BY indexname
    `;
    const nombres = indices.map((i) => i.indexname);
    for (const esperado of [
      'cart_line_cart_id_product_id_key',
      'address_user_id_label_normalized_key',
      'address_user_id_active_idx',
      'address_one_active_default_per_user_key',
      'order_status_created_at_id_idx',
      'order_user_id_created_at_idx',
      'order_line_order_id_idx',
      'order_status_event_order_id_occurred_at_id_idx',
      'order_status_event_one_initial_per_order_key',
    ]) {
      expect(nombres).toContain(esperado);
    }
  });
});

describe('Checks de cantidad (FR-003, FR-027)', () => {
  it('rechaza cantidad 0 y negativa en cart_line, en la base', async () => {
    const cliente = await crearUsuario({ email: 'checks-carrito@foodvoice.test' });
    const { foodType, healthProfile } = await crearClasificacionMinima('checks-carrito');
    const producto = await crearProducto({
      name: 'Producto Checks Carrito',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    const carrito = await prisma.cart.create({ data: { userId: cliente.id } });

    await expect(
      prisma.cartLine.create({ data: { cartId: carrito.id, productId: producto.id, quantity: 0 } }),
    ).rejects.toThrow();
    await expect(
      prisma.cartLine.create({ data: { cartId: carrito.id, productId: producto.id, quantity: -1 } }),
    ).rejects.toThrow();
  });

  it('rechaza cantidad 0 en order_line, en la base', async () => {
    const cliente = await crearUsuario({ email: 'checks-pedido@foodvoice.test' });
    const { foodType, healthProfile } = await crearClasificacionMinima('checks-pedido');
    const producto = await crearProducto({
      name: 'Producto Checks Pedido',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    const pedido = await prisma.order.create({
      data: { userId: cliente.id, addressText: 'Dirección de prueba' },
    });

    await expect(
      prisma.orderLine.create({
        data: {
          orderId: pedido.id,
          productId: producto.id,
          productName: producto.name,
          productPrice: producto.price,
          quantity: 0,
        },
      }),
    ).rejects.toThrow();
  });
});

describe('Unicidad de etiqueta de dirección, normalizada (FR-014, D-040)', () => {
  it('rechaza dos direcciones con la misma etiqueta normalizada del mismo cliente', async () => {
    const cliente = await crearUsuario({ email: 'direccion-unica@foodvoice.test' });
    await prisma.address.create({
      data: {
        userId: cliente.id,
        label: 'Casa',
        labelNormalized: normalizarBusqueda('Casa'),
        text: 'Los Aromos 123',
      },
    });
    await expect(
      prisma.address.create({
        data: {
          userId: cliente.id,
          label: 'casa',
          labelNormalized: normalizarBusqueda('casa'),
          text: 'Otra dirección',
        },
      }),
    ).rejects.toThrow();
  });

  it('la unicidad alcanza a las desactivadas', async () => {
    const cliente = await crearUsuario({ email: 'direccion-unica-baja@foodvoice.test' });
    await prisma.address.create({
      data: {
        userId: cliente.id,
        label: 'Trabajo',
        labelNormalized: normalizarBusqueda('Trabajo'),
        text: 'Oficina Piso 4',
        active: false,
      },
    });
    await expect(
      prisma.address.create({
        data: {
          userId: cliente.id,
          label: 'trabajo',
          labelNormalized: normalizarBusqueda('trabajo'),
          text: 'Otra oficina',
        },
      }),
    ).rejects.toThrow();
  });

  it('permite la misma etiqueta entre dos clientes distintos', async () => {
    const clienteA = await crearUsuario({ email: 'direccion-a@foodvoice.test' });
    const clienteB = await crearUsuario({ email: 'direccion-b@foodvoice.test' });
    await prisma.address.create({
      data: {
        userId: clienteA.id,
        label: 'Casa',
        labelNormalized: normalizarBusqueda('Casa'),
        text: 'Los Aromos 123',
      },
    });
    const deB = await prisma.address.create({
      data: {
        userId: clienteB.id,
        label: 'Casa',
        labelNormalized: normalizarBusqueda('Casa'),
        text: 'Otra calle 456',
      },
    });
    expect(deB.userId).toBe(clienteB.id);
  });
});

describe('Índice único parcial: a lo sumo una dirección predeterminada activa (D-049)', () => {
  it('rechaza una segunda dirección predeterminada activa del mismo cliente', async () => {
    const cliente = await crearUsuario({ email: 'default-unico@foodvoice.test' });
    await prisma.address.create({
      data: {
        userId: cliente.id,
        label: 'Casa',
        labelNormalized: normalizarBusqueda('Casa'),
        text: 'Los Aromos 123',
        isDefault: true,
      },
    });
    await expect(
      prisma.address.create({
        data: {
          userId: cliente.id,
          label: 'Trabajo',
          labelNormalized: normalizarBusqueda('Trabajo'),
          text: 'Oficina Piso 4',
          isDefault: true,
        },
      }),
    ).rejects.toThrow();
  });

  it('permite dos direcciones predeterminadas de dos clientes distintos', async () => {
    const clienteA = await crearUsuario({ email: 'default-a@foodvoice.test' });
    const clienteB = await crearUsuario({ email: 'default-b@foodvoice.test' });
    await prisma.address.create({
      data: {
        userId: clienteA.id,
        label: 'Casa',
        labelNormalized: normalizarBusqueda('Casa'),
        text: 'Los Aromos 123',
        isDefault: true,
      },
    });
    const deB = await prisma.address.create({
      data: {
        userId: clienteB.id,
        label: 'Casa',
        labelNormalized: normalizarBusqueda('Casa'),
        text: 'Otra calle 456',
        isDefault: true,
      },
    });
    expect(deB.isDefault).toBe(true);
  });

  it('permite una predeterminada por cliente si la anterior queda desactivada', async () => {
    const cliente = await crearUsuario({ email: 'default-reemplazo@foodvoice.test' });
    const primera = await prisma.address.create({
      data: {
        userId: cliente.id,
        label: 'Casa',
        labelNormalized: normalizarBusqueda('Casa'),
        text: 'Los Aromos 123',
        isDefault: true,
      },
    });
    await prisma.address.update({ where: { id: primera.id }, data: { isDefault: false } });
    const segunda = await prisma.address.create({
      data: {
        userId: cliente.id,
        label: 'Trabajo',
        labelNormalized: normalizarBusqueda('Trabajo'),
        text: 'Oficina Piso 4',
        isDefault: true,
      },
    });
    expect(segunda.isDefault).toBe(true);
  });
});

describe('Check: una dirección inactiva no puede seguir predeterminada (D-049)', () => {
  it('rechaza is_default = true con active = false', async () => {
    const cliente = await crearUsuario({ email: 'default-inactiva@foodvoice.test' });
    await expect(
      prisma.address.create({
        data: {
          userId: cliente.id,
          label: 'Casa',
          labelNormalized: normalizarBusqueda('Casa'),
          text: 'Los Aromos 123',
          isDefault: true,
          active: false,
        },
      }),
    ).rejects.toThrow();
  });
});

describe('Evento inicial único por pedido (FR-042)', () => {
  it('rechaza un segundo evento con previous_status NULL para el mismo pedido', async () => {
    const cliente = await crearUsuario({ email: 'evento-inicial@foodvoice.test' });
    const pedido = await prisma.order.create({
      data: { userId: cliente.id, addressText: 'Dirección de prueba' },
    });
    await prisma.orderStatusEvent.create({
      data: {
        orderId: pedido.id,
        previousStatus: null,
        resultingStatus: OrderStatus.CREADO,
        actorUserId: cliente.id,
        actorRole: Role.CLIENTE,
      },
    });
    await expect(
      prisma.orderStatusEvent.create({
        data: {
          orderId: pedido.id,
          previousStatus: null,
          resultingStatus: OrderStatus.CREADO,
          actorUserId: cliente.id,
          actorRole: Role.CLIENTE,
        },
      }),
    ).rejects.toThrow();
  });
});

describe('Check de forma del evento (FR-042, FR-043, D-047)', () => {
  it('rechaza un evento no inicial cuyo resultado es "creado"', async () => {
    const cliente = await crearUsuario({ email: 'evento-forma-1@foodvoice.test' });
    const pedido = await prisma.order.create({
      data: { userId: cliente.id, addressText: 'Dirección de prueba' },
    });
    await expect(
      prisma.orderStatusEvent.create({
        data: {
          orderId: pedido.id,
          previousStatus: OrderStatus.EN_PREPARACION,
          resultingStatus: OrderStatus.CREADO,
          actorUserId: cliente.id,
          actorRole: Role.NEGOCIO,
        },
      }),
    ).rejects.toThrow();
  });

  it('rechaza un evento cuyo estado anterior y resultante son iguales', async () => {
    const cliente = await crearUsuario({ email: 'evento-forma-2@foodvoice.test' });
    const pedido = await prisma.order.create({
      data: { userId: cliente.id, addressText: 'Dirección de prueba' },
    });
    await expect(
      prisma.orderStatusEvent.create({
        data: {
          orderId: pedido.id,
          previousStatus: OrderStatus.CREADO,
          resultingStatus: OrderStatus.CREADO,
          actorUserId: cliente.id,
          actorRole: Role.NEGOCIO,
        },
      }),
    ).rejects.toThrow();
  });
});

describe('Trigger append-only de order_status_event (FR-044, D-047)', () => {
  it('rechaza un UPDATE directo', async () => {
    const cliente = await crearUsuario({ email: 'append-only-update@foodvoice.test' });
    const pedido = await prisma.order.create({
      data: { userId: cliente.id, addressText: 'Dirección de prueba' },
    });
    const evento = await prisma.orderStatusEvent.create({
      data: {
        orderId: pedido.id,
        previousStatus: null,
        resultingStatus: OrderStatus.CREADO,
        actorUserId: cliente.id,
        actorRole: Role.CLIENTE,
      },
    });

    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE order_status_event SET actor_role = 'NEGOCIO' WHERE id = $1`,
        evento.id,
      ),
    ).rejects.toThrow();
  });

  it('rechaza un DELETE directo', async () => {
    const cliente = await crearUsuario({ email: 'append-only-delete@foodvoice.test' });
    const pedido = await prisma.order.create({
      data: { userId: cliente.id, addressText: 'Dirección de prueba' },
    });
    const evento = await prisma.orderStatusEvent.create({
      data: {
        orderId: pedido.id,
        previousStatus: null,
        resultingStatus: OrderStatus.CREADO,
        actorUserId: cliente.id,
        actorRole: Role.CLIENTE,
      },
    });

    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM order_status_event WHERE id = $1`, evento.id),
    ).rejects.toThrow();
  });
});

describe('cart_line.cart_id borra en cascada; order_line.order_id no borra nunca (data-model.md)', () => {
  it('vaciar el carrito (borrar el Cart) elimina sus líneas', async () => {
    const cliente = await crearUsuario({ email: 'cascada-carrito@foodvoice.test' });
    const { foodType, healthProfile } = await crearClasificacionMinima('cascada-carrito');
    const producto = await crearProducto({
      name: 'Producto Cascada',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    const carrito = await prisma.cart.create({ data: { userId: cliente.id } });
    await prisma.cartLine.create({ data: { cartId: carrito.id, productId: producto.id, quantity: 1 } });

    await prisma.cart.delete({ where: { id: carrito.id } });

    const lineas = await prisma.cartLine.findMany({ where: { cartId: carrito.id } });
    expect(lineas).toHaveLength(0);
  });

  it('un pedido con líneas no se puede borrar: no hay borrado físico de pedidos', async () => {
    const cliente = await crearUsuario({ email: 'no-borra-pedido@foodvoice.test' });
    const { foodType, healthProfile } = await crearClasificacionMinima('no-borra-pedido');
    const producto = await crearProducto({
      name: 'Producto No Se Borra',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    const pedido = await prisma.order.create({
      data: { userId: cliente.id, addressText: 'Dirección de prueba' },
    });
    await prisma.orderLine.create({
      data: {
        orderId: pedido.id,
        productId: producto.id,
        productName: producto.name,
        productPrice: producto.price,
        quantity: 1,
      },
    });

    await expect(prisma.order.delete({ where: { id: pedido.id } })).rejects.toThrow();
  });
});
