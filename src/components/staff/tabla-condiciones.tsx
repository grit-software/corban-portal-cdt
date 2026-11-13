// Tabla de condiciones (servidor, sin estado). Las filas con creado_por nulo son de la semilla
// DEMO y se marcan para que el coordinador no las confunda con tasas reales.
export type FilaCondicionVista = {
  id: string;
  entidad: string;
  plazoDias: number;
  periodicidad: string;
  montoMin: number;
  montoMax: number | null;
  tasaEa: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
  demo: boolean;
};

export function TablaCondiciones({ filas }: { filas: FilaCondicionVista[] }) {
  if (filas.length === 0) {
    return <p className="text-muted-foreground">Todavía no hay condiciones de tasa.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-muted-foreground">
          <tr>
            <th className="py-2 font-medium">Entidad</th>
            <th className="py-2 font-medium">Plazo</th>
            <th className="py-2 font-medium">Periodicidad</th>
            <th className="py-2 font-medium">Monto</th>
            <th className="py-2 font-medium">Tasa E.A.</th>
            <th className="py-2 font-medium">Vigencia</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.id} className="h-10 border-b border-border">
              <td className="py-2">
                {fila.entidad}
                {fila.demo ? (
                  <span className="ml-2 rounded-md bg-secondary px-2 py-0.5 text-xs">DEMO</span>
                ) : null}
              </td>
              <td className="py-2">{fila.plazoDias} días</td>
              <td className="py-2">{fila.periodicidad}</td>
              <td className="py-2">
                {fila.montoMin.toLocaleString("es-CO")}
                {fila.montoMax === null
                  ? " en adelante"
                  : ` a ${fila.montoMax.toLocaleString("es-CO")}`}
              </td>
              <td className="py-2">{fila.tasaEa}%</td>
              <td className="py-2">
                {fila.vigenteDesde} → {fila.vigenteHasta ?? "sin fin"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
