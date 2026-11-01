// js/main.js
// Une la página (index.html), las clases POO, la API PHP y los servicios externos.
import { Producto } from "./producto.js";
import { Carrito } from "./carrito.js";
import { Cliente, Transaccion } from "./pedido.js";
import { crearMedioPago } from "./pagos.js";
import { ServicioEnvio, ServicioClima, ServicioDivisas, ServicioUbicacion } from "./servicios.js";

const $ = (id) => document.getElementById(id);
const LOCALES = { COP: "es-CO", USD: "en-US", EUR: "de-DE" };

const estado = {
  catalogo: [],
  categoria: "Todos",
  moneda: "COP",
  tasa: 1,            // pesos por 1 unidad de la moneda elegida
  envio: null,        // resultado de ServicioEnvio.cotizar()
  enviando: false,
  solicitudTasa: 0,   // evita que una respuesta vieja pise una más reciente
};
const carrito = new Carrito();
const textoBotonPagar = $("pay-button").innerHTML;

// ---------- utilidades ----------
function el(tag, clase = "", texto) {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}

function formatear(valor, moneda = "COP") {
  return new Intl.NumberFormat(LOCALES[moneda], {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: moneda === "COP" ? 0 : 2,
  }).format(valor);
}

let temporizadorToast;
function notificar(mensaje) {
  const toast = $("toast");
  toast.textContent = mensaje;
  toast.classList.add("show");
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => toast.classList.remove("show"), 3200);
}

function mostrarModal(id, visible) {
  const modal = $(id);
  modal.classList.toggle("open", visible);
  modal.setAttribute("aria-hidden", String(!visible));
}

function mostrarBolsa(visible) {
  mostrarModal("cart-drawer", visible);
  $("overlay").classList.toggle("visible", visible);
}

// ---------- catálogo ----------
async function cargarCatalogo() {
  try {
    const respuesta = await fetch("api/productos.php", { cache: "no-store" });
    let datos;
    try {
      datos = await respuesta.json();
    } catch {
      throw new Error("El servidor no respondió con datos. Abre la tienda desde http://localhost/coquito-amarillo/");
    }
    if (!respuesta.ok) throw new Error(datos.error ?? `Error ${respuesta.status} del servidor.`);
    estado.catalogo = datos.map((d) => new Producto(d.nombre, d.precio, d.stock, d));
    renderCatalogo();
  } catch (err) {
    mostrarErrorCatalogo(err instanceof TypeError
      ? "No se pudo conectar con el servidor. Revisa que Apache esté encendido."
      : err.message);
  }
}

function mostrarErrorCatalogo(mensaje) {
  const caja = el("div", "catalog-error");
  const pista = el("p");
  pista.append("Revisa que Apache y MySQL estén encendidos e importa ", el("code", "", "database/coquito_amarillo.sql"), " en phpMyAdmin.");
  caja.append(el("strong", "", "No pudimos cargar el catálogo."), el("p", "", mensaje), pista);
  $("product-grid").replaceChildren(caja);
}

function renderCatalogo() {
  const lista = estado.categoria === "Todos"
    ? estado.catalogo
    : estado.catalogo.filter((p) => p.categoria === estado.categoria);
  if (!lista.length) {
    $("product-grid").replaceChildren(el("p", "empty-cart", "No hay productos en esta categoría."));
    return;
  }
  $("product-grid").replaceChildren(...lista.map(tarjetaProducto));
}

function tarjetaProducto(p) {
  const card = el("article", "product-card");

  const imagen = el("div", "product-image");
  const foto = el("img");
  foto.src = p.imagen;
  foto.alt = p.nombre;
  foto.loading = "lazy";
  imagen.append(foto);
  if (p.stock <= 0) imagen.append(el("span", "product-tag", "Agotado"));
  else if (p.etiqueta) imagen.append(el("span", "product-tag", p.etiqueta));

  const info = el("div", "product-info");
  info.append(
    el("span", "product-category", `${p.categoria} · ${p.peso}`),
    el("h3", "", p.nombre),
    el("p", "product-desc", p.descripcion),
  );

  const abajo = el("div", "product-bottom");
  const boton = el("button", "add-button", "+");
  boton.type = "button";
  boton.disabled = p.stock <= 0;
  boton.setAttribute("aria-label", `Agregar ${p.nombre} a la bolsa`);
  boton.addEventListener("click", () => agregarAlCarrito(p));
  abajo.append(el("span", "price", formatear(p.precio)), boton);
  info.append(abajo);

  card.append(imagen, info);
  return card;
}

// ---------- bolsa ----------
function agregarAlCarrito(producto) {
  try {
    carrito.agregar(producto, 1);
    notificar(`${producto.nombre} agregado a tu bolsa`);
  } catch (err) {
    notificar(err.message);
  }
  actualizarCarrito();
}

function cambiarCantidad(sku, nueva) {
  try {
    if (nueva < 1) carrito.quitar(sku);
    else carrito.cambiarCantidad(sku, nueva);
  } catch (err) {
    notificar(err.message);
  }
  actualizarCarrito();
}

function actualizarCarrito() {
  $("cart-count").textContent = carrito.cantidadTotal;
  $("drawer-count").textContent = `(${carrito.cantidadTotal})`;
  $("cart-subtotal").textContent = formatear(carrito.subtotal);
  renderBolsa();
  refrescarTotales();
}

function renderBolsa() {
  if (carrito.estaVacio) {
    $("cart-items").replaceChildren(el("p", "empty-cart", "Tu bolsa está vacía. Agrega productos para continuar."));
    return;
  }
  $("cart-items").replaceChildren(...carrito.items.map(filaBolsa));
}

function filaBolsa(item) {
  const p = item.producto;
  const fila = el("div", "cart-item");

  const foto = el("img");
  foto.src = p.imagen;
  foto.alt = p.nombre;

  const info = el("div");
  const control = el("div", "quantity");
  const menos = el("button", "", "−");
  menos.type = "button";
  menos.setAttribute("aria-label", `Quitar una unidad de ${p.nombre}`);
  const mas = el("button", "", "+");
  mas.type = "button";
  mas.setAttribute("aria-label", `Agregar una unidad de ${p.nombre}`);
  control.append(menos, el("span", "", String(item.cantidad)), mas);

  const quitar = el("button", "remove-item", "Quitar");
  quitar.type = "button";
  info.append(el("small", "", p.categoria), el("h4", "", p.nombre), control, quitar);

  fila.append(foto, info, el("strong", "", formatear(item.subtotal)));

  menos.addEventListener("click", () => cambiarCantidad(p.sku, item.cantidad - 1));
  mas.addEventListener("click", () => cambiarCantidad(p.sku, item.cantidad + 1));
  quitar.addEventListener("click", () => cambiarCantidad(p.sku, 0));
  return fila;
}

// ---------- pedido: resumen, envío y moneda ----------
function abrirCheckout() {
  if (carrito.estaVacio) {
    notificar("Agrega productos a tu bolsa para continuar.");
    return;
  }
  mostrarBolsa(false);
  $("checkout-items").replaceChildren(...carrito.items.map((item) => {
    const fila = el("div", "checkout-product");
    const foto = el("img");
    foto.src = item.producto.imagen;
    foto.alt = "";
    const texto = el("div");
    texto.append(
      el("strong", "", item.producto.nombre),
      el("small", "", `${item.cantidad} × ${formatear(item.producto.precio)}`),
    );
    fila.append(foto, texto, el("b", "", formatear(item.subtotal)));
    return fila;
  }));
  mostrarModal("checkout-modal", true);
  refrescarTotales();
}

function refrescarTotales() {
  const ciudad = $("customer-city").value;
  if (ciudad) {
    estado.envio = ServicioEnvio.cotizar(ciudad, carrito.subtotal);
    $("shipping-value").textContent = estado.envio.valor === 0
      ? "Gratis"
      : formatear(estado.envio.valor / estado.tasa, estado.moneda);
    $("shipping-detail").textContent = estado.envio.detalle;
  } else {
    estado.envio = null;
    $("shipping-value").textContent = "Pendiente";
    $("shipping-detail").textContent = "Completa la ciudad para cotizar.";
  }
  renderResumen();
}

function renderResumen() {
  const m = estado.moneda;
  const t = estado.tasa;
  const subtotal = carrito.subtotal;
  const envio = estado.envio ? estado.envio.valor : null;
  $("summary-subtotal").textContent = formatear(subtotal / t, m);
  $("summary-shipping").textContent = envio === null ? "Por calcular" : envio === 0 ? "Gratis" : formatear(envio / t, m);
  $("summary-total").textContent = formatear((subtotal + (envio ?? 0)) / t, m);
}

async function cambiarMoneda(moneda) {
  const solicitud = ++estado.solicitudTasa;
  if (moneda === "COP") {
    estado.moneda = "COP";
    estado.tasa = 1;
    $("api-status").textContent = "Montos en pesos colombianos.";
    refrescarTotales();
    return;
  }
  $("api-status").textContent = "Consultando la tasa de cambio…";
  try {
    const tasa = await ServicioDivisas.cotizacionCOP(moneda);
    if (solicitud !== estado.solicitudTasa) return;
    estado.moneda = moneda;
    estado.tasa = tasa;
    $("api-status").textContent = `Tasa de referencia: 1 ${moneda} = ${formatear(tasa)}. Los valores son aproximados.`;
  } catch {
    if (solicitud !== estado.solicitudTasa) return;
    estado.moneda = "COP";
    estado.tasa = 1;
    $("currency").value = "COP";
    $("api-status").textContent = "No fue posible consultar la tasa. Los montos se muestran en pesos.";
  }
  refrescarTotales();
}

function usarUbicacion() {
  if (!navigator.geolocation) {
    notificar("Tu navegador no permite usar la ubicación.");
    return;
  }
  notificar("Buscando tu ubicación…");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const ciudad = ServicioUbicacion.ciudadMasCercana(pos.coords.latitude, pos.coords.longitude);
      $("customer-city").value = ciudad;
      refrescarTotales();
      notificar(`Ciudad sugerida: ${ciudad}. Revisa tu dirección completa.`);
    },
    () => notificar("No pudimos obtener tu ubicación. Selecciona la ciudad manualmente."),
    { timeout: 10000 },
  );
}

function actualizarCamposPago() {
  const metodo = document.querySelector('input[name="payment"]:checked').value;
  $("payment-fields").style.display = metodo === "Tarjeta" ? "grid" : "none";
}

// ---------- confirmar pedido ----------
async function confirmarPedido(evento) {
  evento.preventDefault();
  if (estado.enviando) return;
  $("form-error").textContent = "";

  try {
    const cliente = new Cliente({
      nombre: $("customer-name").value,
      correo: $("customer-email").value,
      ciudad: $("customer-city").value,
      direccion: $("customer-address").value,
    });
    if (!$("privacy-consent").checked) throw new Error("Autoriza el tratamiento de tus datos para continuar.");
    if (!estado.envio) throw new Error("Selecciona tu ciudad para calcular el envío.");

    const metodo = document.querySelector('input[name="payment"]:checked').value;
    const medioPago = crearMedioPago(metodo);
    if (metodo === "Tarjeta") {
      medioPago.validar({
        numero: $("card-number").value,
        vencimiento: $("card-expiry").value,
        cvv: $("card-cvv").value,
      });
    }

    // Como indica la página, la tasa se consulta al confirmar el pedido
    if (estado.moneda !== "COP") {
      estado.tasa = await ServicioDivisas.cotizacionCOP(estado.moneda);
    }
    refrescarTotales();

    const transaccion = new Transaccion({
      cliente,
      carrito,
      envio: estado.envio.valor,
      medioPago,
      moneda: estado.moneda,
      tasa: estado.tasa,
    });

    estado.enviando = true;
    $("pay-button").disabled = true;
    $("pay-button").textContent = "Procesando…";

    const respuesta = await fetch("api/pedidos.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transaccion.paraApi()),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.error ?? "No fue posible registrar el pedido.");

    const clima = await ServicioClima.consultar(transaccion.ciudad).catch(() => null);
    carrito.vaciar();
    mostrarModal("checkout-modal", false);
    actualizarCarrito();
    mostrarRecibo(datos, transaccion, clima);
    cargarCatalogo();   // refresca el inventario mostrado
  } catch (err) {
    $("form-error").textContent = err.message;
  } finally {
    estado.enviando = false;
    $("pay-button").disabled = false;
    $("pay-button").innerHTML = textoBotonPagar;
  }
}

function mostrarRecibo(datos, transaccion, clima) {
  const filas = [
    ["Código", datos.codigo],
    ["Estado", datos.estado],
    ["Método de pago", transaccion.metodoPago],
    ["Ciudad de entrega", transaccion.ciudad],
    ["Subtotal", formatear(datos.subtotal)],
    ["Envío", datos.envio === 0 ? "Gratis" : formatear(datos.envio)],
    ["Total (COP)", formatear(datos.total)],
  ];
  if (datos.moneda !== "COP") {
    filas.push([`Total aprox. (${datos.moneda})`, formatear(datos.total_convertido, datos.moneda)]);
  }
  if (clima) filas.push([`Clima en ${clima.ciudad}`, `${Math.round(clima.temperatura)} °C`]);

  const detalles = el("div", "receipt-details");
  for (const [etiqueta, valor] of filas) {
    const fila = el("div");
    fila.append(el("span", "", etiqueta), el("strong", "", String(valor)));
    detalles.append(fila);
  }

  const volver = el("button", "button button-dark", "Volver a la tienda");
  volver.type = "button";
  volver.addEventListener("click", () => mostrarModal("receipt-modal", false));

  $("receipt-content").replaceChildren(
    el("div", "receipt-mark", "C"),
    el("p", "receipt-success", "Pedido registrado · pago simulado"),
    el("h2", "", "¡Gracias por tu compra!"),
    el("p", "", "Guarda este código para cualquier consulta sobre tu pedido."),
    detalles,
    el("div", "receipt-actions", ""),
  );
  $("receipt-content").querySelector(".receipt-actions").append(volver);
  mostrarModal("receipt-modal", true);
}

// ---------- eventos ----------
$("filters").addEventListener("click", (evento) => {
  const boton = evento.target.closest(".filter");
  if (!boton) return;
  document.querySelectorAll(".filter").forEach((f) => f.classList.toggle("active", f === boton));
  estado.categoria = boton.dataset.category;
  renderCatalogo();
});

$("open-cart").addEventListener("click", () => {
  renderBolsa();
  mostrarBolsa(true);
});
$("close-cart").addEventListener("click", () => mostrarBolsa(false));
$("overlay").addEventListener("click", () => mostrarBolsa(false));
$("go-checkout").addEventListener("click", abrirCheckout);
$("close-checkout").addEventListener("click", () => mostrarModal("checkout-modal", false));

$("customer-city").addEventListener("change", refrescarTotales);
$("quote-shipping").addEventListener("click", () => {
  if (!$("customer-city").value) {
    notificar("Selecciona primero tu ciudad de entrega.");
    return;
  }
  refrescarTotales();
  notificar("Envío calculado.");
});
$("currency").addEventListener("change", (e) => cambiarMoneda(e.target.value));
$("use-location").addEventListener("click", usarUbicacion);

document.querySelectorAll('input[name="payment"]').forEach((radio) =>
  radio.addEventListener("change", actualizarCamposPago));

// Formato automático de los campos de tarjeta (solo visual; el número nunca sale del navegador)
$("card-number").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
});
$("card-expiry").addEventListener("input", (e) => {
  const d = e.target.value.replace(/\D/g, "").slice(0, 4);
  e.target.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
});
$("card-cvv").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
});

$("checkout-form").addEventListener("submit", confirmarPedido);

$("receipt-modal").addEventListener("click", (e) => {
  if (e.target.id === "receipt-modal") mostrarModal("receipt-modal", false);
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  mostrarModal("receipt-modal", false);
  mostrarModal("checkout-modal", false);
  mostrarBolsa(false);
});

// ---------- arranque ----------
actualizarCamposPago();
actualizarCarrito();
cargarCatalogo();
