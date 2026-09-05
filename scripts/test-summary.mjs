#!/usr/bin/env node
/**
 * Corre las pruebas unitarias de los tres workspaces y muestra un resumen
 * acotado (archivos, tests y cobertura por paquete, más un total general),
 * en vez del log completo de vitest/jest. No reemplaza `pnpm test`
 * (que sigue siendo la fuente de verdad de los umbrales de cobertura,
 * T117): este script solo lo hace legible.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');

const PAQUETES = [
  {
    nombre: '@foodvoice/shared',
    dir: 'packages/shared',
    runner: 'vitest',
    args: ['run', '--coverage', '--reporter=json', '--outputFile=.test-summary.json'],
    resultado: '.test-summary.json',
  },
  {
    nombre: '@foodvoice/api',
    dir: 'services/api',
    runner: 'jest',
    args: ['--coverage', '--json', '--outputFile=.test-summary.json'],
    resultado: '.test-summary.json',
  },
  {
    nombre: '@foodvoice/web',
    dir: 'apps/web',
    runner: 'vitest',
    args: ['run', '--coverage', '--reporter=json', '--outputFile=.test-summary.json'],
    resultado: '.test-summary.json',
  },
];

function ejecutar(paquete) {
  const cwd = path.join(root, paquete.dir);
  let salidaOk = true;
  try {
    execFileSync('pnpm', ['exec', paquete.runner, ...paquete.args], {
      cwd,
      stdio: ['ignore', 'ignore', 'ignore'],
      shell: true,
    });
  } catch {
    // jest/vitest salen con código != 0 si hay tests fallidos o no se
    // cumplen los umbrales de cobertura: igual queremos leer el resultado.
    salidaOk = false;
  }

  const resultadoPath = path.join(cwd, paquete.resultado);
  const coveragePath = path.join(cwd, 'coverage', 'coverage-summary.json');

  const resultado = existsSync(resultadoPath)
    ? JSON.parse(readFileSync(resultadoPath, 'utf-8'))
    : null;
  const coverage = existsSync(coveragePath)
    ? JSON.parse(readFileSync(coveragePath, 'utf-8')).total
    : null;

  return { ...paquete, salidaOk, resultado, coverage };
}

function pct(n) {
  return `${n.toFixed(2)}%`;
}

function imprimirPaquete({ nombre, resultado, coverage }) {
  if (!resultado) {
    console.log(`${nombre}: sin resultado (revisa la salida de la corrida)`);
    return { tests: 0, ok: 0 };
  }
  // `testResults` son archivos de prueba; `numTotalTestSuites` cuenta cada
  // `describe` (vitest) y no coincide con "Test Files" de su reporter nativo.
  const archivos = resultado.testResults ?? [];
  const suites = archivos.length || resultado.numTotalTestSuites || 0;
  const suitesOk = archivos.length
    ? archivos.filter((a) => a.status === 'passed').length
    : (resultado.numPassedTestSuites ?? suites);
  const tests = resultado.numTotalTests ?? 0;
  const testsOk = resultado.numPassedTests ?? 0;

  console.log(`${nombre}:test:  Test Files  ${suitesOk} passed (${suites})`);
  console.log(`${nombre}:test:  Tests        ${testsOk} passed (${tests})`);
  if (coverage) {
    console.log(
      `${nombre}:test:  Coverage:    ${pct(coverage.statements.pct)} stmts · ` +
        `${pct(coverage.branches.pct)} branch · ${pct(coverage.functions.pct)} funcs · ` +
        `${pct(coverage.lines.pct)} lines`,
    );
  }
  console.log('');
  return { tests, ok: testsOk };
}

const resultados = PAQUETES.map(ejecutar);
const totales = resultados.map(imprimirPaquete);

const totalTests = totales.reduce((acc, r) => acc + r.tests, 0);
const totalOk = totales.reduce((acc, r) => acc + r.ok, 0);
const detalle = resultados
  .map((r, i) => `${totales[i].tests} (${r.dir.split('/')[0]}/${r.dir.split('/')[1]})`)
  .join(' + ');

console.log(
  `Total: ${totalTests} pruebas unitarias — ${detalle} — ${totalTests - totalOk} fallidas`,
);

const huboFallo = resultados.some((r) => !r.salidaOk);
process.exit(huboFallo ? 1 : 0);
