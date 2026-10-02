import * as XLSX from "xlsx";

function normalizarEncabezado(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizarTexto(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
}

function valorCelda(fila, indice) {
  return indice === undefined ? "" : normalizarTexto(fila[indice]);
}

function esFilaVacia(fila) {
  return !fila.some((valor) => valor !== null && valor !== undefined && String(valor).trim() !== "");
}

function buscarHojasConEncabezados(libro) {
  const hojas = [];
  for (const nombre of libro.SheetNames) {
    const filas = XLSX.utils.sheet_to_json(libro.Sheets[nombre], { header: 1, defval: null });
    const indice = filas.findIndex((fila) => {
      const encabezados = fila.map(normalizarEncabezado);
      return encabezados.includes("ECONOMICO") && encabezados.includes("NO. SERIE");
    });
    if (indice === -1) continue;
    const encabezados = filas[indice].map(normalizarEncabezado);
    const tieneResguardanteSap = encabezados.includes("NOMBRE RESGUARDANTE SAP");
    const tieneResguardante = encabezados.includes("NOMBRE RESGUARDANTE") || tieneResguardanteSap;
    hojas.push({ filas, indice, nombre, tieneResguardante, tieneResguardanteSap });
  }

  if (hojas.length === 0) {
    throw new Error("No se reconoce el formato: no se encontraron las columnas ECONOMICO y NO. SERIE.");
  }

  hojas.sort((a, b) => Number(b.tieneResguardanteSap) - Number(a.tieneResguardanteSap) || Number(b.tieneResguardante) - Number(a.tieneResguardante));
  return hojas;
}

/**
 * Lee la relación de parque vehicular y conserva el nombre de la Jefatura
 * que encabeza cada bloque del libro.
 */
export async function leerArchivoParqueVehicular(archivo) {
  const buffer = await archivo.arrayBuffer();
  const libro = XLSX.read(buffer, { cellDates: true });
  // Se usa una sola hoja fuente: la que contiene la versión más completa
  // del catálogo (prioriza NOMBRE RESGUARDANTE SAP) para no duplicar filas
  // al combinar hojas históricas o de traspasos del mismo libro.
  const hojas = [buscarHojasConEncabezados(libro)[0]];

  const filasVehiculares = [];
  let filasInvalidas = 0;

  hojas.forEach(({ filas, indice: indiceEncabezado, nombre: nombreHoja }) => {
    const encabezados = filas[indiceEncabezado].map(normalizarEncabezado);
    const indiceDe = (nombre) => encabezados.findIndex((encabezado) => encabezado === nombre);
    const indiceResguardante = indiceDe("NOMBRE RESGUARDANTE") !== -1 ? indiceDe("NOMBRE RESGUARDANTE") : indiceDe("NOMBRE RESGUARDANTE SAP");
    const indices = {
      economico: indiceDe("ECONOMICO"),
      marca: indiceDe("MARCA"),
      submarca: indiceDe("SUBMARCA"),
      tipo: indiceDe("TIPO"),
      modelo: indiceDe("MODELO"),
      numeroSerie: indiceDe("NO. SERIE"),
      placas: indiceDe("PLACAS"),
      placas2025: indiceDe("PLACAS 2025"),
      centroGestor: indiceDe("CENTRO GESTOR"),
      centroCostos: indiceDe("CENTRO DE COSTOS"),
      ubicacionTecnica: indiceDe("UBICACION TECNICA"),
      rpeResguardante: indiceDe("R.P.E RESGUARDANTE"),
      arrendadora: indiceDe("ARRENDADORA"),
      conductorAsignado: indiceResguardante,
    };

    let jefaturaActual = "";
    filas.slice(0, indiceEncabezado).forEach((fila) => {
      const texto = fila.map(normalizarTexto).find(Boolean);
      if (texto && normalizarEncabezado(texto) === "JEFATURA") jefaturaActual = "Jefatura";
    });

    filas.slice(indiceEncabezado + 1).forEach((fila, offset) => {
      const filaExcel = indiceEncabezado + offset + 2;
      if (esFilaVacia(fila)) return;

      const economico = valorCelda(fila, indices.economico);
      const tieneDatosVehiculo = [indices.marca, indices.numeroSerie, indices.placas].some((indice) => valorCelda(fila, indice));
      const textoEconomico = normalizarEncabezado(economico);

      if (economico && !tieneDatosVehiculo && !/^\d[\d\s/-]*$/.test(economico)) {
        jefaturaActual = economico;
        return;
      }

      if (!economico && !valorCelda(fila, indices.numeroSerie)) {
        if (tieneDatosVehiculo) filasInvalidas += 1;
        return;
      }

      if (!tieneDatosVehiculo || textoEconomico === "ECONOMICO") {
        filasInvalidas += 1;
        return;
      }

      const cambios = {};
      Object.entries(indices).forEach(([campo, indice]) => {
        if (campo === "economico" || indice === -1) return;
        const valor = valorCelda(fila, indice);
        if (valor) cambios[campo] = valor;
      });
      filasVehiculares.push({ filaExcel, economico, jefatura: jefaturaActual, hoja: nombreHoja, cambios });
    });
  });

  return { nombreHoja: hojas[0]?.nombre ?? "Parque vehicular", filas: filasVehiculares, filasInvalidas };
}

function claveEconomico(valor) {
  return normalizarTexto(valor).toUpperCase();
}

/**
 * Genera una vista previa sin modificar el store.
 */
export function analizarParqueVehicular(datos, unidades, resolverDepartamento) {
  const porSerie = new Map();
  const porEconomico = new Map();
  unidades.forEach((unidad) => {
    const serie = claveEconomico(unidad.numeroSerie);
    const economico = claveEconomico(unidad.economico);
    if (serie) porSerie.set(serie, [...(porSerie.get(serie) ?? []), unidad]);
    if (economico) porEconomico.set(economico, [...(porEconomico.get(economico) ?? []), unidad]);
  });

  const seriesProcesadas = new Set();
  const economicosProcesados = new Set();
  const duplicados = [];
  const noEncontrados = [];
  const nuevasUnidades = [];
  const actualizaciones = [];

  datos.filas.forEach((fila) => {
    const serie = claveEconomico(fila.cambios.numeroSerie);
    const economico = claveEconomico(fila.economico);
    const departamento = resolverDepartamento(fila.jefatura);
    const candidatasSerie = porSerie.get(serie) ?? [];
    const candidatasEconomico = porEconomico.get(economico) ?? [];
    const seleccionar = (candidatas) => {
      const delDepartamento = candidatas.filter((unidad) => unidad.departamento === departamento);
      return delDepartamento.length === 1 ? delDepartamento[0] : candidatas.length === 1 ? candidatas[0] : null;
    };
    const unidad = seleccionar(candidatasSerie) ?? seleccionar(candidatasEconomico);

    if (serie && seriesProcesadas.has(serie)) {
      duplicados.push(fila);
      return;
    }
    if (economico && economicosProcesados.has(economico)) {
      duplicados.push(fila);
      return;
    }
    if (serie) seriesProcesadas.add(serie);
    if (economico) economicosProcesados.add(economico);
    if (!unidad) {
      if (candidatasSerie.length > 1 || candidatasEconomico.length > 1 || (economico && economicosProcesados.has(economico))) {
        duplicados.push(fila);
      } else if (serie) {
        nuevasUnidades.push({
          cambios: { ...fila.cambios, ...(economico ? { economico: fila.economico } : {}), ...(departamento ? { departamento } : {}) },
          filaExcel: fila.filaExcel,
          jefatura: fila.jefatura,
        });
      } else {
        noEncontrados.push(fila);
      }
      return;
    }

    actualizaciones.push({
      unidad,
      economico: fila.economico,
      filaExcel: fila.filaExcel,
      cambios: {
        ...fila.cambios,
        ...(departamento ? { departamento } : {}),
      },
      jefatura: fila.jefatura,
      coincidencia: candidatasSerie.length > 0 ? "numeroSerie" : "economico",
    });
  });

  return {
    hoja: datos.nombreHoja,
    actualizaciones,
    duplicados,
    noEncontrados,
    nuevasUnidades,
    filasInvalidas: datos.filasInvalidas,
    jefaturasNoEncontradas: actualizaciones.filter((fila) => fila.jefatura && !fila.cambios.departamento),
  };
}
