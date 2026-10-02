import { useMemo, useState } from "react";
import { useSearch } from "../../context/SearchContext.jsx";
import { useReportes } from "../../hooks/useReportes.js";
import { obtenerNombreDepartamento } from "../../data/departamentosStore.js";

const ETIQUETAS_TIPO_REPORTE = {
  anomalia: "Anomalía",
  mantenimiento: "Mantenimiento",
  siniestro: "Siniestro",
};

function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha";

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(fecha));
}

function TopNavBar({ activeTab = "Resumen", searchPlaceholder = "Buscar..." }) {
  const { query, setQuery } = useSearch();
  const reportes = useReportes();
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false);

  const reportesNotificacion = useMemo(
    () =>
      reportes
        .filter((reporte) => ["mantenimiento", "siniestro"].includes(reporte.tipoReporte))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    [reportes],
  );

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-outline-variant/30 shadow-sm sticky top-0 z-40 flex justify-between items-center w-full px-margin-desktop h-16">
      <div className="flex items-center gap-8">
        <h2 className="font-title-md text-title-md font-bold text-primary hidden md:block">
          Sistema de Gestión de Flota
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-outline">search</span>
          </span>
          <input
            className="pl-10 pr-4 py-2 border-none border-b border-outline-variant focus:border-b-2 focus:border-secondary-container bg-surface-container-lowest rounded-t-md font-body-md text-body-md text-on-surface focus:ring-0 transition-colors w-64"
            placeholder={searchPlaceholder}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMostrarNotificaciones((prev) => !prev)}
            className="w-10 h-10 rounded-full hover:bg-surface-container transition-colors flex items-center justify-center text-on-surface-variant relative"
            aria-label="Notificaciones"
          >
            <span className="material-symbols-outlined">notifications</span>
            {reportesNotificacion.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center px-1">
                {reportesNotificacion.length > 9 ? "9+" : reportesNotificacion.length}
              </span>
            )}
          </button>

          {mostrarNotificaciones && (
            <div className="absolute right-0 top-12 w-80 max-h-[360px] overflow-hidden bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg z-50">
              <div className="flex items-center justify-between p-3 border-b border-outline-variant/30">
                <h3 className="font-label-sm text-label-sm text-on-surface uppercase">Reportes de departamentos</h3>
                <span className="font-technical-mono text-technical-mono text-xs text-on-surface-variant">
                  {reportesNotificacion.length}
                </span>
              </div>

              <div className="max-h-[300px] overflow-y-auto divide-y divide-outline-variant/20">
                {reportesNotificacion.length === 0 ? (
                  <p className="p-4 font-body-md text-body-md text-on-surface-variant text-sm">
                    No hay reportes de mantenimiento ni siniestro.
                  </p>
                ) : (
                  reportesNotificacion.map((reporte) => (
                    <div key={reporte.id} className="p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-label-sm text-label-sm uppercase text-error">
                          {ETIQUETAS_TIPO_REPORTE[reporte.tipoReporte] ?? reporte.tipoReporte}
                        </span>
                        <span className="font-technical-mono text-technical-mono text-[10px] text-on-surface-variant">
                          {reporte.folio}
                        </span>
                      </div>
                      <p className="font-body-md text-body-md text-on-surface text-sm">{reporte.descripcion}</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">
                        {reporte.autorNombre} · {obtenerNombreDepartamento(reporte.autorDepartamento)}
                      </p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">{formatearFecha(reporte.fecha)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center overflow-hidden border border-outline-variant cursor-pointer">
          <span className="material-symbols-outlined text-[20px]">account_circle</span>
        </div>
      </div>
    </header>
  );
}

export default TopNavBar;
