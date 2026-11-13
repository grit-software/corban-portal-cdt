// Forma pública de un CDT en el portafolio del cliente (E3-T1). Puro: lo leen el servicio
// (que lo produce), la API v1 y las vistas. No incluye ids de staff ni la condición de tasa.
export type CdtPortafolio = {
  id: string;
  numeroCdt: string;
  entidad: string;
  valor: number;
  tasaEa: string;
  fechaApertura: string;
  fechaVenc: string;
  periodicidad: string;
  estado: string;
};

export type Portafolio = {
  vigentes: CdtPortafolio[];
  totalInvertido: number;
  proximosVencimientos: CdtPortafolio[];
};
