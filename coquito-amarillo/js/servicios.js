// js/servicios.js
// Tarifas de envío de ejemplo: ajústalas a tus tarifas reales.
const TARIFAS_ENVIO = {
  "Medellín": 12000,
  "Bogotá": 18000,
  "Cali": 18000,
  "Barranquilla": 22000,
  "Cartagena": 22000,
  "Bucaramanga": 20000,
};
const UMBRAL_ENVIO_GRATIS = 250000;  // mismo beneficio que el anuncio superior

export const CIUDADES = {
  "Medellín": { lat: 6.2442, lon: -75.5812 },
  "Bogotá": { lat: 4.7110, lon: -74.0721 },
  "Cali": { lat: 3.4516, lon: -76.5320 },
  "Barranquilla": { lat: 10.9685, lon: -74.7813 },
  "Cartagena": { lat: 10.3910, lon: -75.4794 },
  "Bucaramanga": { lat: 7.1193, lon: -73.1227 },
};

export class ServicioEnvio {
  static cotizar(ciudad, subtotal) {
    if (!Object.hasOwn(TARIFAS_ENVIO, ciudad)) throw new Error("Selecciona una ciudad de entrega válida.");
    if (subtotal >= UMBRAL_ENVIO_GRATIS) {
      return { valor: 0, detalle: "Envío gratis por compras desde $250.000" };
    }
    return { valor: TARIFAS_ENVIO[ciudad], detalle: `Tarifa estándar a ${ciudad}` };
  }
}

export class ServicioUbicacion {
  static ciudadMasCercana(lat, lon) {
    let ciudad = null;
    let distanciaMinima = Infinity;
    for (const [nombre, c] of Object.entries(CIUDADES)) {
      const d = distanciaKm(lat, lon, c.lat, c.lon);
      if (d < distanciaMinima) {
        distanciaMinima = d;
        ciudad = nombre;
      }
    }
    return ciudad;
  }
}

export class ServicioClima {
  // Open-Meteo no requiere clave de API
  static async consultar(ciudad) {
    if (!Object.hasOwn(CIUDADES, ciudad)) return null;
    const { lat, lon } = CIUDADES[ciudad];
    const respuesta = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
    );
    if (!respuesta.ok) throw new Error("Clima no disponible");
    const datos = await respuesta.json();
    return { ciudad, temperatura: datos.current_weather.temperature };
  }
}

// ExchangeRate-API en acceso abierto (sin clave). Las tasas se reutilizan 10 minutos.
let tasasCache = null;
let tasasMomento = 0;

async function obtenerTasasCOP() {
  const ahora = Date.now();
  if (tasasCache && ahora - tasasMomento < 10 * 60 * 1000) return tasasCache;
  const respuesta = await fetch("https://open.er-api.com/v6/latest/COP");
  const datos = respuesta.ok ? await respuesta.json() : null;
  if (!datos || datos.result !== "success" || !datos.rates) {
    throw new Error("No fue posible consultar la tasa de cambio.");
  }
  tasasCache = datos.rates;
  tasasMomento = ahora;
  return tasasCache;
}

export class ServicioDivisas {
  // Devuelve cuántos pesos (COP) vale 1 unidad de la moneda indicada
  static async cotizacionCOP(moneda) {
    if (moneda === "COP") return 1;
    const tasas = await obtenerTasasCOP();
    const unidadesPorCOP = tasas[moneda];
    if (!unidadesPorCOP) throw new Error(`Moneda no disponible: ${moneda}`);
    return 1 / unidadesPorCOP;
  }
}

function distanciaKm(lat1, lon1, lat2, lon2) {
  const radio = 6371;
  const rad = (grados) => (grados * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radio * Math.asin(Math.sqrt(a));
}
