// js/pagos.js
// Pagos simulados: no hay conexión con bancos. Los datos de tarjeta solo se validan aquí y nunca se envían.

export class MedioPago {
  #nombre;
  constructor(nombre) { this.#nombre = nombre; }
  get nombre() { return this.#nombre; }
  validar() { return true; }           // cada medio redefine su validación
}

export class PagoTarjeta extends MedioPago {
  constructor() { super("Tarjeta"); }

  validar({ numero = "", vencimiento = "", cvv = "" } = {}) {
    const digitos = numero.replace(/\s/g, "");
    if (!/^\d{13,19}$/.test(digitos) || !luhn(digitos)) {
      throw new Error("Revisa el número de tarjeta.");
    }
    const formato = /^(\d{2})\/(\d{2})$/.exec(vencimiento);
    if (!formato) throw new Error("La fecha de vencimiento debe tener formato MM/AA.");
    const mes = Number(formato[1]);
    const anio = 2000 + Number(formato[2]);
    if (mes < 1 || mes > 12) throw new Error("El mes de vencimiento no es válido.");
    const finDeVigencia = new Date(anio, mes, 0, 23, 59, 59);   // último instante del mes
    if (finDeVigencia < new Date()) throw new Error("La tarjeta está vencida.");
    if (!/^\d{3,4}$/.test(cvv)) throw new Error("El CVV debe tener 3 o 4 dígitos.");
    return true;
  }
}

export class PagoPSE extends MedioPago {
  constructor() { super("PSE"); }
}

export class PagoNequi extends MedioPago {
  constructor() { super("Nequi"); }
}

export function crearMedioPago(nombre) {
  switch (nombre) {
    case "Tarjeta": return new PagoTarjeta();
    case "PSE": return new PagoPSE();
    case "Nequi": return new PagoNequi();
    default: throw new Error("Método de pago no válido");
  }
}

// Algoritmo de Luhn: detecta números de tarjeta mal escritos
function luhn(numero) {
  let suma = 0;
  let doble = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let d = Number(numero[i]);
    if (doble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    doble = !doble;
  }
  return suma % 10 === 0;
}
