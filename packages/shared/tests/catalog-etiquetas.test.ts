import { describe, expect, it } from 'vitest';
import {
  Dimension,
  PriceTier,
  ProductStatus,
  derivarEstadoProducto,
} from '../src/enums/dimension';
import {
  AYUDA_DESCRIPCION_CATEGORIA,
  AYUDA_DESCRIPCION_PRODUCTO,
  MSG_CATEGORIA_EN_USO,
  MSG_CATEGORIA_INACTIVA,
  MSG_DESCRIPCION_DEMASIADO_CORTA,
  MSG_DESCRIPCION_DEMASIADO_LARGA,
  MSG_DIMENSION_SIN_CATEGORIAS,
} from '../src/messages/es';
import {
  CatalogAction,
  ETIQUETA_DIMENSION,
  ETIQUETA_ESTADO_CATEGORIA,
  ETIQUETA_ESTADO_PRODUCTO,
  ETIQUETA_TRAMO,
  MSG_EXITO_CATALOGO,
} from '../src/messages/etiquetas';
import {
  LIMITES_DESCRIPCION_CATEGORIA,
  LIMITES_DESCRIPCION_PRODUCTO,
  mensajeDescripcion,
} from '../src/schemas/description';

describe('derivarEstadoProducto (data-model § Los dos interruptores)', () => {
  it('activo y disponible es Disponible', () => {
    expect(derivarEstadoProducto({ active: true, available: true })).toBe(
      ProductStatus.DISPONIBLE,
    );
  });

  it('activo y no disponible es Agotado: sigue siendo activo (FR-029)', () => {
    expect(derivarEstadoProducto({ active: true, available: false })).toBe(ProductStatus.AGOTADO);
  });

  it('no activo es Dado de baja, **con independencia de su disponibilidad**', () => {
    expect(derivarEstadoProducto({ active: false, available: true })).toBe(
      ProductStatus.DADO_DE_BAJA,
    );
    expect(derivarEstadoProducto({ active: false, available: false })).toBe(
      ProductStatus.DADO_DE_BAJA,
    );
  });
});

describe('Etiquetas visibles (§ Vocabulario visible del catálogo, SC-029)', () => {
  it('nombra las dos dimensiones como las nombra la spec', () => {
    expect(ETIQUETA_DIMENSION[Dimension.TIPO_COMIDA]).toBe('Tipo de comida');
    expect(ETIQUETA_DIMENSION[Dimension.PERFIL_SALUD]).toBe('Perfil de salud');
  });

  it('nombra los tres tramos con sus acentos correctos', () => {
    expect(ETIQUETA_TRAMO[PriceTier.ECONOMICO]).toBe('Económico');
    expect(ETIQUETA_TRAMO[PriceTier.MEDIO]).toBe('Medio');
    expect(ETIQUETA_TRAMO[PriceTier.CARO]).toBe('Caro');
  });

  it('usa «Agotado» y «Dado de baja», nunca los sinónimos prohibidos', () => {
    expect(ETIQUETA_ESTADO_PRODUCTO[ProductStatus.AGOTADO]).toBe('Agotado');
    expect(ETIQUETA_ESTADO_PRODUCTO[ProductStatus.DADO_DE_BAJA]).toBe('Dado de baja');
    const todas = Object.values(ETIQUETA_ESTADO_PRODUCTO).join(' ').toLowerCase();
    for (const prohibido of ['sin stock', 'no disponible', 'suspendido', 'eliminado', 'borrado']) {
      expect(todas).not.toContain(prohibido);
    }
  });

  it('la categoría se desactiva y el producto se da de baja (supuesto 4)', () => {
    expect(ETIQUETA_ESTADO_CATEGORIA.ACTIVA).toBe('Activa');
    expect(ETIQUETA_ESTADO_CATEGORIA.DESACTIVADA).toBe('Desactivada');
  });

  it('ningún identificador interno en mayúsculas llega a las etiquetas', () => {
    const visibles = [
      ...Object.values(ETIQUETA_DIMENSION),
      ...Object.values(ETIQUETA_TRAMO),
      ...Object.values(ETIQUETA_ESTADO_PRODUCTO),
      ...Object.values(ETIQUETA_ESTADO_CATEGORIA),
    ];
    for (const texto of visibles) {
      expect(texto).not.toMatch(/[A-Z_]{4,}/u);
    }
  });
});

describe('MSG_EXITO_CATALOGO (FR-025)', () => {
  it('tiene un mensaje por cada acción del catálogo', () => {
    for (const accion of Object.values(CatalogAction)) {
      expect(typeof MSG_EXITO_CATALOGO[accion]).toBe('function');
    }
  });

  it('cada mensaje nombra el elemento afectado y la acción realizada', () => {
    expect(MSG_EXITO_CATALOGO[CatalogAction.CREAR_PRODUCTO]('Pizza Napolitana')).toBe(
      'Se creó el producto Pizza Napolitana.',
    );
    expect(MSG_EXITO_CATALOGO[CatalogAction.AGOTAR_PRODUCTO]('Pizza Napolitana')).toBe(
      'Se marcó Pizza Napolitana como agotado.',
    );
    expect(MSG_EXITO_CATALOGO[CatalogAction.REPONER_PRODUCTO]('Pizza Napolitana')).toBe(
      'Se repuso Pizza Napolitana.',
    );
    expect(MSG_EXITO_CATALOGO[CatalogAction.DAR_DE_BAJA_PRODUCTO]('Pizza Napolitana')).toBe(
      'Se dio de baja Pizza Napolitana.',
    );
    expect(MSG_EXITO_CATALOGO[CatalogAction.DESACTIVAR_CATEGORIA]('Pizzas')).toBe(
      'Se desactivó la categoría Pizzas.',
    );
    expect(MSG_EXITO_CATALOGO[CatalogAction.REACTIVAR_CATEGORIA]('Pizzas')).toBe(
      'Se reactivó la categoría Pizzas.',
    );
    expect(MSG_EXITO_CATALOGO[CatalogAction.CREAR_CATEGORIA]('Pizzas')).toBe(
      'Se creó la categoría Pizzas.',
    );
    expect(MSG_EXITO_CATALOGO[CatalogAction.EDITAR_CATEGORIA]('Pizzas')).toBe(
      'Se guardaron los cambios de la categoría Pizzas.',
    );
    expect(MSG_EXITO_CATALOGO[CatalogAction.EDITAR_PRODUCTO]('Pizza')).toBe(
      'Se guardaron los cambios de Pizza.',
    );
    expect(MSG_EXITO_CATALOGO[CatalogAction.REACTIVAR_PRODUCTO]('Pizza')).toBe(
      'Se reactivó Pizza.',
    );
  });
});

describe('Mensajes con dato variable (FR-007, FR-012, FR-021)', () => {
  it('MSG_CATEGORIA_EN_USO dice **cuántos** productos bloquean (SC-015)', () => {
    expect(MSG_CATEGORIA_EN_USO(3)).toContain('3 productos activos');
    expect(MSG_CATEGORIA_EN_USO(3)).toContain('Reclasifícalos');
  });

  it('concuerda en singular con un solo producto', () => {
    expect(MSG_CATEGORIA_EN_USO(1)).toContain('1 producto activo');
    expect(MSG_CATEGORIA_EN_USO(1)).toContain('Reclasifícalo');
  });

  it('MSG_CATEGORIA_INACTIVA **nombra la dimensión** afectada (SC-010)', () => {
    expect(MSG_CATEGORIA_INACTIVA(ETIQUETA_DIMENSION[Dimension.TIPO_COMIDA])).toContain(
      'Tipo de comida',
    );
  });

  it('MSG_DIMENSION_SIN_CATEGORIAS nombra la dimensión y ofrece crear la primera', () => {
    const m = MSG_DIMENSION_SIN_CATEGORIAS(ETIQUETA_DIMENSION[Dimension.PERFIL_SALUD]);
    expect(m).toContain('Perfil de salud');
    expect(m).toContain('Crea la primera');
  });

  it('los mensajes de longitud nombran el límite concreto de su entidad', () => {
    expect(MSG_DESCRIPCION_DEMASIADO_CORTA(20)).toContain('20 caracteres');
    expect(MSG_DESCRIPCION_DEMASIADO_CORTA(30)).toContain('30 caracteres');
    expect(MSG_DESCRIPCION_DEMASIADO_LARGA(1000)).toContain('1000 caracteres');
  });
});

describe('mensajeDescripcion (FR-039, SC-031)', () => {
  it('devuelve un mensaje distinto para cada uno de los seis motivos', () => {
    const motivos = [
      'AUSENTE',
      'DEMASIADO_CORTA',
      'DEMASIADO_LARGA',
      'POCAS_PALABRAS',
      'PALABRAS_REPETIDAS',
      'REPITE_EL_NOMBRE',
    ] as const;
    const mensajes = motivos.map((m) => mensajeDescripcion(m, LIMITES_DESCRIPCION_PRODUCTO));
    expect(new Set(mensajes).size).toBe(motivos.length);
    for (const mensaje of mensajes) expect(mensaje.length).toBeGreaterThan(10);
  });

  it('usa los límites de la entidad que se le pasa', () => {
    expect(mensajeDescripcion('DEMASIADO_CORTA', LIMITES_DESCRIPCION_CATEGORIA)).toContain('30');
    expect(mensajeDescripcion('DEMASIADO_LARGA', LIMITES_DESCRIPCION_CATEGORIA)).toContain('500');
  });
});

describe('Ayuda contextual (FR-005, FR-016, SC-019)', () => {
  it('cada una trae ejemplo y explicación', () => {
    for (const ayuda of [AYUDA_DESCRIPCION_PRODUCTO, AYUDA_DESCRIPCION_CATEGORIA]) {
      expect(ayuda.ejemplo.length).toBeGreaterThan(40);
      expect(ayuda.explicacion.length).toBeGreaterThan(40);
    }
  });

  it('el ejemplo del producto **cumple** las reglas que el formulario exige', () => {
    // Si el ejemplo que se enseña no pasara la validación, la pantalla estaría
    // pidiendo algo que ella misma declara inaceptable.
    expect(AYUDA_DESCRIPCION_PRODUCTO.ejemplo.length).toBeGreaterThanOrEqual(
      LIMITES_DESCRIPCION_PRODUCTO.minimo,
    );
    expect(AYUDA_DESCRIPCION_PRODUCTO.ejemplo.length).toBeLessThanOrEqual(
      LIMITES_DESCRIPCION_PRODUCTO.maximo,
    );
  });

  it('el ejemplo de la categoría cumple sus propios límites', () => {
    expect(AYUDA_DESCRIPCION_CATEGORIA.ejemplo.length).toBeGreaterThanOrEqual(
      LIMITES_DESCRIPCION_CATEGORIA.minimo,
    );
    expect(AYUDA_DESCRIPCION_CATEGORIA.ejemplo.length).toBeLessThanOrEqual(
      LIMITES_DESCRIPCION_CATEGORIA.maximo,
    );
  });

  it('la explicación menciona la voz, que es la razón del campo (FR-016)', () => {
    expect(AYUDA_DESCRIPCION_PRODUCTO.explicacion.toLowerCase()).toContain('hablando');
    expect(AYUDA_DESCRIPCION_CATEGORIA.explicacion.toLowerCase()).toContain('palabras');
  });
});
