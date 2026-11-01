// js/pedido.js
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Cliente {
  #nombre; #correo; #ciudad; #direccion;

  constructor({ nombre = "", correo = "", ciudad = "", direccion = "" } = {}) {
    const n = nombre.trim();
    const c = correo.trim();
    const ci = ciudad.trim();
    const d = direccion.trim();
    if (n.length < 3) throw new Error("Escribe tu nombre completo (mínimo 3 letras).");
    if (!EMAIL.test(c)) throw new Error("Revisa el correo electrónico.");
    if (!ci) throw new Error("Selecciona tu ciudad de entrega.");
    if (d.length < 5) throw new Error("Escribe la dirección completa de entrega.");
    this.#nombre = n;
    this.#correo = c;
    this.#ciudad = ci;
    this.#direccion = d;
  }

  get datos() {
    return { nombre: this.#nombre, correo: this.#correo, ciudad: this.#ciudad, direccion: this.#direccion };
  }
}

export class Transaccion {
  #lineas; #cliente; #envio; #medioPago; #moneda; #tasa;

  // Guarda una copia de la bolsa: el carrito puede vaciarse después de confirmar
  constructor({ cliente, carrito, envio, medioPago, moneda = "COP", tasa = 1 }) {
    if (!(cliente instanceof Cliente)) throw new TypeError("Se requiere un Cliente");
    if (carrito.estaVacio) throw new Error("Tu bolsa está vacía.");
    this.#cliente = cliente;
    this.#lineas = carrito.items.map((i) => ({
      sku: i.producto.sku,
      nombre: i.producto.nombre,
      precio: i.producto.precio,
      cantidad: i.cantidad,
      subtotal: i.subtotal,
    }));
    this.#envio = envio;
    this.#medioPago = medioPago;
    this.#moneda = moneda;
    this.#tasa = tasa;
  }

  get subtotal() { return this.#lineas.reduce((suma, l) => suma + l.subtotal, 0); }
  get total() { return this.subtotal + this.#envio; }   // en COP
  get ciudad() { return this.#cliente.datos.ciudad; }
  get metodoPago() { return this.#medioPago.nombre; }

  // Lo que se envía a api/pedidos.php: sin datos de tarjeta; los totales los calcula el servidor
  paraApi() {
    return {
      cliente: this.#cliente.datos,
      items: this.#lineas.map((l) => ({ sku: l.sku, cantidad: l.cantidad })),
      pago: this.#medioPago.nombre,
      envio: this.#envio,
      moneda: this.#moneda,
      tasa: this.#tasa,
    };
  }
}
