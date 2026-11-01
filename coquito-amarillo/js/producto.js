// js/producto.js
export class Producto {
  #sku; #precio; #stock;               // campos privados
  static #secuencia = 0;               // privado y estático

  // datos (opcional): { sku, peso, categoria, etiqueta, descripcion, imagen }.
  // Si no se indica sku, se genera uno automático: CA-0001, CA-0002...
  constructor(nombre, precio, stock, datos = {}) {
    this.nombre = nombre;
    this.precio = precio;              // pasa por el setter → se valida
    this.#validarStock(stock);         // el stock inicial también se valida
    this.#stock = stock;
    this.#sku = typeof datos.sku === "string" && datos.sku.trim() !== ""
      ? datos.sku.trim()
      : `CA-${String(++Producto.#secuencia).padStart(4, "0")}`;
    this.peso = datos.peso ?? "";
    this.categoria = datos.categoria ?? "";
    this.etiqueta = datos.etiqueta ?? "";
    this.descripcion = datos.descripcion ?? "";
    this.imagen = datos.imagen ?? "";
  }

  get sku() { return this.#sku; }      // solo lectura: no hay setter
  get stock() { return this.#stock; }  // solo lectura: el inventario real se descuenta en el servidor
  get precio() { return this.#precio; }
  set precio(valor) {
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new RangeError("El precio debe ser un número positivo");
    }
    this.#precio = valor;
  }

  reservar(cantidad) {
    this.#validarCantidad(cantidad);
    this.#stock -= cantidad;
    return this.#stock;
  }

  #validarStock(stock) {
    if (!Number.isInteger(stock) || stock < 0) {
      throw new RangeError("El stock debe ser un entero mayor o igual a 0");
    }
  }

  #validarCantidad(cantidad) {
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new RangeError("La cantidad debe ser un entero positivo");
    }
    if (cantidad > this.#stock) throw new Error(`Stock insuficiente: ${this.nombre}`);
  }

  static esProducto(obj) {             // no lanza error si obj es null o un primitivo
    return obj !== null && typeof obj === "object" && #sku in obj; // verificación de marca (ES2022)
  }
}
