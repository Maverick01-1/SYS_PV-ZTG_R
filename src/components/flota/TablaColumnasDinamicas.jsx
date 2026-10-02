import { useState } from "react";

/**
 * Tabla adaptativa reutilizable: encabezado fijo, scroll horizontal
 * CONTENIDO dentro de su propio contenedor (nunca se sale de la pantalla
 * ni obliga a hacer zoom del navegador), y un menú superior de botones
 * tipo Toggle para prender/apagar columnas — no un dropdown de checkboxes.
 *
 * @param {Object} props
 * @param {Array<Object>} props.filas
 * @param {Array<{ key: string, label: string, opcional?: boolean, render?: (fila: Object) => React.ReactNode, alinearDerecha?: boolean }>} props.columnas
 *   `opcional: false` (o ausente) = columna visible por defecto. `opcional: true` = empieza apagada, se prende con su botón Toggle.
 * @param {(fila: Object, indice: number) => string | number} [props.obtenerLlave]  Para el `key` de cada fila; por defecto usa el índice.
 * @param {(fila: Object) => void} [props.onFilaClick]  Si se pasa, cada fila se vuelve clicable (ej. para abrir un detalle).
 */
function TablaColumnasDinamicas({ filas, columnas, obtenerLlave, onFilaClick }) {
  const [columnasActivas, setColumnasActivas] = useState(() => new Set(columnas.filter((columna) => !columna.opcional).map((columna) => columna.key)));

  function alternarColumna(key) {
    setColumnasActivas((anteriores) => {
      const siguiente = new Set(anteriores);
      if (siguiente.has(key)) siguiente.delete(key);
      else siguiente.add(key);
      return siguiente;
    });
  }

  const columnasVisibles = columnas.filter((columna) => columnasActivas.has(columna.key));
  const columnasOpcionales = columnas.filter((columna) => columna.opcional);

  return (
    <div className="space-y-3">
      {columnasOpcionales.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {columnasOpcionales.map((columna) => {
            const activa = columnasActivas.has(columna.key);
            return (
              <button
                key={columna.key}
                onClick={() => alternarColumna(columna.key)}
                className={`px-3 py-1 rounded-full border font-label-sm text-label-sm transition-colors ${
                  activa
                    ? "bg-primary text-on-primary border-primary"
                    : "bg-surface-bright text-on-surface-variant border-outline-variant hover:bg-surface-container-high"
                }`}
              >
                {activa ? "✓ " : "+ "}{columna.label}
              </button>
            );
          })}
        </div>
      )}

      {/* overflow-x-auto contiene el desbordamiento DENTRO de la tabla, nunca se sale del layout ni requiere zoom. */}
      <div className="overflow-x-auto max-w-full border border-outline-variant rounded-lg">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant uppercase sticky top-0 z-10">
            <tr>
              {columnasVisibles.map((columna) => (
                <th key={columna.key} className={`p-2 whitespace-nowrap ${columna.alinearDerecha ? "text-right" : "text-left"}`}>
                  {columna.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20 bg-surface-container-lowest">
            {filas.map((fila, indice) => (
              <tr
                key={obtenerLlave ? obtenerLlave(fila, indice) : indice}
                onClick={onFilaClick ? () => onFilaClick(fila) : undefined}
                className={`hover:bg-surface-container-low transition-colors ${onFilaClick ? "cursor-pointer" : ""}`}
              >
                {columnasVisibles.map((columna) => (
                  <td key={columna.key} className={`p-2 whitespace-nowrap ${columna.alinearDerecha ? "text-right" : "text-left"}`}>
                    {columna.render ? columna.render(fila) : String(fila[columna.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={columnasVisibles.length} className="p-6 text-center text-on-surface-variant">
                  Sin resultados con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TablaColumnasDinamicas;
