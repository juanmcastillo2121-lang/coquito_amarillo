// js/carrito.js
import { Producto } from "./producto.js";

export class ItemCarrito {
  #producto;
  #cantidad = 0;

  constructor(producto, cantidad = 1) {
    if (!Producto.esProducto(producto)) throw new TypeError("Se requiere un Producto");
    this.#producto = producto;
    this.cambiarCantidad(cantidad);
  }

  get producto() { return this.#producto; }
  get cantidad() { return this.#cantidad; }
  get subtotal() { return this.#producto.precio * this.#cantidad; }

  cambiarCantidad(cantidad) {
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      throw new RangeError("La cantidad debe ser un entero mayor o igual a 1");
    }
    if (cantidad > this.#producto.stock) {
      throw new Error(`Solo hay ${this.#producto.stock} unidades disponibles de ${this.#producto.nombre}`);
    }
    this.#cantidad = cantidad;
  }
}

export class Carrito {
  #items = new Map();                  // clave: SKU

  agregar(producto, cantidad = 1) {
    const existente = this.#items.get(producto.sku);
    if (existente) existente.cambiarCantidad(existente.cantidad + cantidad);
    else this.#items.set(producto.sku, new ItemCarrito(producto, cantidad));
  }

  cambiarCantidad(sku, cantidad) {
    this.#buscar(sku).cambiarCantidad(cantidad);
  }

  quitar(sku) { this.#items.delete(sku); }
  vaciar() { this.#items.clear(); }

  get items() { return [...this.#items.values()]; }
  get cantidadTotal() { return this.items.reduce((suma, i) => suma + i.cantidad, 0); }
  get subtotal() { return this.items.reduce((suma, i) => suma + i.subtotal, 0); }
  get estaVacio() { return this.#items.size === 0; }

  #buscar(sku) {
    const item = this.#items.get(sku);
    if (!item) throw new Error("Ese producto ya no está en tu bolsa");
    return item;
  }
}
