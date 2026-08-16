import { describe, expect, it } from 'vitest';
import {
  LIMITES_DESCRIPCION_CATEGORIA,
  LIMITES_DESCRIPCION_PRODUCTO,
  aplanarDescripcion,
  validarDescripcion,
} from '../src/schemas/description';

/**
 * Las tres condiciones de sustancia de FR-039 y sus dos criterios de éxito
 * (SC-031, SC-008). Se prueban los seis motivos de rechazo, los límites
 * **inclusivos** y el colapso de saltos de línea de D-033.
 */

/** Descripción válida de referencia: 20+ caracteres, seis palabras distintas. */
const PRODUCTO_OK = 'Masa delgada con mozzarella fresca y albahaca';
const CATEGORIA_OK =
  'Comida contundente y calórica, lo que se pide sin pensar en la dieta de mañana';

describe('aplanarDescripcion (D-033)', () => {
  it('colapsa saltos de línea, tabulaciones y espacios repetidos a uno solo', () => {
    expect(aplanarDescripcion('Masa\ndelgada\t\tcon   queso')).toBe('Masa delgada con queso');
  });

  it('recorta los extremos', () => {
    expect(aplanarDescripcion('  Masa con queso \n ')).toBe('Masa con queso');
  });

  it('deja intacto un párrafo que ya es plano', () => {
    expect(aplanarDescripcion(PRODUCTO_OK)).toBe(PRODUCTO_OK);
  });

  it('devuelve cadena vacía cuando solo hay espacios en blanco', () => {
    expect(aplanarDescripcion('  \n\t  ')).toBe('');
  });
});

describe('validarDescripcion · descripciones válidas', () => {
  it('acepta una descripción de producto en prosa y devuelve el texto aplanado', () => {
    const r = validarDescripcion(PRODUCTO_OK, 'Pizza Napolitana', LIMITES_DESCRIPCION_PRODUCTO);
    expect(r).toEqual({ valida: true, valor: PRODUCTO_OK });
  });

  it('acepta una descripción de categoría con su mínimo mayor', () => {
    const r = validarDescripcion(CATEGORIA_OK, 'Indulgente', LIMITES_DESCRIPCION_CATEGORIA);
    expect(r.valida).toBe(true);
  });

  it('devuelve el texto **aplanado**, no el original: se persiste lo que se validó', () => {
    const r = validarDescripcion(
      '  Masa delgada\ncon mozzarella\tfresca y albahaca  ',
      'Pizza',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r).toEqual({ valida: true, valor: 'Masa delgada con mozzarella fresca y albahaca' });
  });

  it('acepta una descripción que menciona el nombre pero añade algo propio', () => {
    const r = validarDescripcion(
      'Pizza napolitana con mozzarella fresca y albahaca',
      'Pizza Napolitana',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r.valida).toBe(true);
  });

  it('acepta prosa mediocre pero informativa: FR-039 no juzga la calidad', () => {
    // La spec lo declara expresamente: «Masa con queso encima y nada más» pasa.
    const r = validarDescripcion(
      'Masa con queso encima y nada mas',
      'Pizza',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r.valida).toBe(true);
  });

  it('no exige nombre: con nombre vacío solo aplica longitud y las dos primeras condiciones', () => {
    const r = validarDescripcion(PRODUCTO_OK, '   ', LIMITES_DESCRIPCION_PRODUCTO);
    expect(r.valida).toBe(true);
  });
});

describe('validarDescripcion · AUSENTE (§ Límites de los campos)', () => {
  it('rechaza la cadena vacía', () => {
    expect(validarDescripcion('', 'Pizza', LIMITES_DESCRIPCION_PRODUCTO)).toEqual({
      valida: false,
      motivo: 'AUSENTE',
    });
  });

  it('rechaza como ausente —no como corta— una descripción de solo espacios', () => {
    expect(validarDescripcion('     ', 'Pizza', LIMITES_DESCRIPCION_PRODUCTO)).toEqual({
      valida: false,
      motivo: 'AUSENTE',
    });
  });

  it('trata igual una descripción de solo saltos de línea', () => {
    expect(validarDescripcion('\n\n\t\n', 'Pizza', LIMITES_DESCRIPCION_PRODUCTO)).toEqual({
      valida: false,
      motivo: 'AUSENTE',
    });
  });
});

describe('validarDescripcion · longitud, con los límites inclusivos (CHK014)', () => {
  it('acepta exactamente el mínimo del producto: 20 caracteres', () => {
    const veinte = 'masa ques ajo sal to'; // 20 caracteres, 5 palabras de 2+
    expect(veinte).toHaveLength(20);
    expect(validarDescripcion(veinte, 'Pizza', LIMITES_DESCRIPCION_PRODUCTO).valida).toBe(true);
  });

  it('rechaza 19 caracteres: un carácter por debajo del mínimo', () => {
    const diecinueve = 'masa queso ajo sal';
    expect(diecinueve.length).toBeLessThan(20);
    expect(validarDescripcion(diecinueve, 'Pizza', LIMITES_DESCRIPCION_PRODUCTO)).toEqual({
      valida: false,
      motivo: 'DEMASIADO_CORTA',
    });
  });

  it('acepta exactamente el mínimo de la categoría: 30 caracteres', () => {
    const treinta = 'masa queso ajo sal tomate orex'; // 30
    expect(treinta).toHaveLength(30);
    expect(validarDescripcion(treinta, 'Pizzas', LIMITES_DESCRIPCION_CATEGORIA).valida).toBe(true);
  });

  it('rechaza 29 caracteres en una categoría (SC-008)', () => {
    const veintinueve = 'masa queso ajo sal tomate ore';
    expect(veintinueve).toHaveLength(29);
    expect(validarDescripcion(veintinueve, 'Pizzas', LIMITES_DESCRIPCION_CATEGORIA)).toEqual({
      valida: false,
      motivo: 'DEMASIADO_CORTA',
    });
  });

  it('acepta exactamente el máximo del producto: 1.000 caracteres', () => {
    const mil = 'masa queso ajo sal tomate '.padEnd(1000, 'x');
    expect(mil).toHaveLength(1000);
    expect(validarDescripcion(mil, 'Pizza', LIMITES_DESCRIPCION_PRODUCTO).valida).toBe(true);
  });

  it('rechaza 1.001 caracteres en un producto', () => {
    const excesiva = 'masa queso ajo sal tomate '.padEnd(1001, 'x');
    expect(excesiva).toHaveLength(1001);
    expect(validarDescripcion(excesiva, 'Pizza', LIMITES_DESCRIPCION_PRODUCTO)).toEqual({
      valida: false,
      motivo: 'DEMASIADO_LARGA',
    });
  });

  it('acepta exactamente el máximo de la categoría: 500 caracteres', () => {
    const quinientos = 'masa queso ajo sal tomate '.padEnd(500, 'x');
    expect(quinientos).toHaveLength(500);
    expect(validarDescripcion(quinientos, 'Pizzas', LIMITES_DESCRIPCION_CATEGORIA).valida).toBe(
      true,
    );
  });

  it('rechaza 501 caracteres en una categoría', () => {
    const excesiva = 'masa queso ajo sal tomate '.padEnd(501, 'x');
    expect(validarDescripcion(excesiva, 'Pizzas', LIMITES_DESCRIPCION_CATEGORIA)).toEqual({
      valida: false,
      motivo: 'DEMASIADO_LARGA',
    });
  });

  it('mide la longitud **después** de aplanar: los saltos no alargan el texto', () => {
    // 18 caracteres de contenido y 6 saltos de línea: aplanado no llega a 20.
    const conSaltos = 'masa\nqueso\najo\nsal';
    expect(conSaltos.length).toBeLessThan(20);
    expect(validarDescripcion(conSaltos, 'Pizza', LIMITES_DESCRIPCION_PRODUCTO).valida).toBe(false);
  });
});

describe('validarDescripcion · FR-039.1 · al menos cinco palabras de 2+ caracteres', () => {
  it('rechaza cuatro palabras largas aunque sobrepasen el mínimo de caracteres', () => {
    const r = validarDescripcion(
      'masa mozzarella albahaca aceituna',
      'Pizza',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r).toEqual({ valida: false, motivo: 'POCAS_PALABRAS' });
  });

  it('no cuenta las palabras de un solo carácter', () => {
    // Nueve «palabras» separadas por espacios, pero solo cuatro tienen dos o
    // más caracteres: las de una letra no acercan la descripción al mínimo.
    const r = validarDescripcion(
      'masa a queso b ajo c sal d e',
      'Pizza',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r).toEqual({ valida: false, motivo: 'POCAS_PALABRAS' });
  });

  it('acepta exactamente cinco palabras distintas de dos o más caracteres', () => {
    const r = validarDescripcion(
      'masa queso ajo sal tomate',
      'Pizza',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r.valida).toBe(true);
  });

  it('cuenta las palabras separadas por saltos de línea como palabras (D-033)', () => {
    const r = validarDescripcion(
      'masa\nqueso\najo\nsal\ntomate\nmas',
      'Pizza',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r.valida).toBe(true);
  });

  it('trata la puntuación como separador: «masa,queso,ajo» son tres palabras', () => {
    const r = validarDescripcion(
      'masa,queso,ajo,sal,tomate,mas',
      'Pizza',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r.valida).toBe(true);
  });
});

describe('validarDescripcion · FR-039.3 · cinco palabras distintas (SC-031)', () => {
  it('rechaza «rica rica rica rica rica rica», el caso que la spec nombra', () => {
    const r = validarDescripcion(
      'rica rica rica rica rica rica',
      'Pizza',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r).toEqual({ valida: false, motivo: 'PALABRAS_REPETIDAS' });
  });

  it('rechaza la repetición de una secuencia para alcanzar el mínimo', () => {
    const r = validarDescripcion(
      'muy rica muy rica muy rica muy rica',
      'Pizza',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r).toEqual({ valida: false, motivo: 'PALABRAS_REPETIDAS' });
  });

  it('cuenta como una sola palabra las que solo difieren en acentos o mayúsculas', () => {
    const r = validarDescripcion(
      'Rica rica RICA ríca rica rica',
      'Pizza',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r).toEqual({ valida: false, motivo: 'PALABRAS_REPETIDAS' });
  });

  it('acepta cinco distintas aunque alguna se repita después', () => {
    const r = validarDescripcion(
      'masa queso ajo sal tomate queso masa',
      'Pizza',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r.valida).toBe(true);
  });
});

describe('validarDescripcion · FR-039.2 · no repite el nombre (SC-031)', () => {
  it('rechaza una descripción idéntica al nombre', () => {
    const nombre = 'Pizza Napolitana Especial Grande De Masa';
    const r = validarDescripcion(nombre, nombre, LIMITES_DESCRIPCION_PRODUCTO);
    expect(r).toEqual({ valida: false, motivo: 'REPITE_EL_NOMBRE' });
  });

  it('rechaza la igualdad aunque cambien acentos y mayúsculas', () => {
    const r = validarDescripcion(
      'PIZZA NAPOLITANA ESPECIAL GRANDE DE MASA',
      'Pizza Napolitana Especial Grande de Masa',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r).toEqual({ valida: false, motivo: 'REPITE_EL_NOMBRE' });
  });

  it('rechaza la que solo repite las palabras del nombre sin añadir nada', () => {
    const r = validarDescripcion(
      'Napolitana Pizza Especial Grande Masa Pizza',
      'Pizza Napolitana Especial Grande Masa',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r).toEqual({ valida: false, motivo: 'REPITE_EL_NOMBRE' });
  });

  it('acepta la que repite el nombre y añade al menos una palabra propia', () => {
    const r = validarDescripcion(
      'Pizza Napolitana Especial Grande Masa horneada',
      'Pizza Napolitana Especial Grande Masa',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r.valida).toBe(true);
  });

  it('el caso de la categoría: describir «Indulgente» con esa sola palabra repetida', () => {
    const r = validarDescripcion(
      'Indulgente indulgente indulgente indulgente indulgente',
      'Indulgente',
      LIMITES_DESCRIPCION_CATEGORIA,
    );
    // Falla por palabras repetidas antes de llegar a comparar con el nombre: es
    // el mismo texto una y otra vez, que es el defecto más específico.
    expect(r).toEqual({ valida: false, motivo: 'PALABRAS_REPETIDAS' });
  });
});

describe('validarDescripcion · orden de las comprobaciones', () => {
  it('la longitud se comprueba antes que la sustancia: «rica» corta es CORTA, no POCAS_PALABRAS', () => {
    expect(validarDescripcion('rica', 'Pizza', LIMITES_DESCRIPCION_PRODUCTO)).toEqual({
      valida: false,
      motivo: 'DEMASIADO_CORTA',
    });
  });

  it('el nombre no se compara cuando ya falló otra condición', () => {
    // Repetir el nombre cinco veces incumple las tres condiciones a la vez; se
    // informa la de palabras repetidas, no la del nombre.
    const r = validarDescripcion(
      'Pizza Pizza Pizza Pizza Pizza',
      'Pizza',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r).toEqual({ valida: false, motivo: 'PALABRAS_REPETIDAS' });
  });

  it('con cuatro repeticiones informa POCAS_PALABRAS: falla primero la cuenta', () => {
    const r = validarDescripcion(
      'Napolitana Napolitana Napolitana Napolitana',
      'Pizza',
      LIMITES_DESCRIPCION_PRODUCTO,
    );
    expect(r).toEqual({ valida: false, motivo: 'POCAS_PALABRAS' });
  });
});
