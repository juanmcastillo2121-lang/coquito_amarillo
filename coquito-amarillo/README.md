# Coquito Amarillo SAS — Tienda web con MySQL

Tienda web académica desarrollada con HTML, CSS, JavaScript ES6+, PHP y MySQL. Incluye catálogo, carrito, cálculo de envío, checkout y registro persistente de pedidos.

## Base de datos

**Nombre exacto:** `coquito_amarillo`  
**Motor:** MySQL / MariaDB  
**Archivo de importación:** `database/coquito_amarillo.sql`

### Instalación en XAMPP y phpMyAdmin
1. Instala e inicia **Apache** y **MySQL** desde el panel de XAMPP.
2. Copia la carpeta `coquito-amarillo` dentro de `C:\xampp\htdocs\` (Windows) o la carpeta `htdocs` de tu instalación.
3. Abre `http://localhost/phpmyadmin` en el navegador.
4. En phpMyAdmin, entra a **Importar**, selecciona `coquito-amarillo/database/coquito_amarillo.sql` y pulsa **Importar**. El script crea la base `coquito_amarillo`, sus tablas y los ocho productos iniciales.
5. Revisa `api/config.php`. La configuración predeterminada de XAMPP es servidor `localhost`, usuario `root` y contraseña vacía. Si configuraste una contraseña para MySQL, escríbela en `$DB_PASS`.
6. Abre la tienda en `http://localhost/coquito-amarillo/`. No la abras con doble clic ni uses Live Server: PHP necesita ejecutarse mediante Apache.

## Qué se almacena en MySQL
- `categorias`: categorías del catálogo.
- `productos`: catálogo, precios e inventario.
- `clientes`: datos de contacto y entrega.
- `pedidos`: código, subtotal, envío, total, moneda, método y estado.
- `detalle_pedidos`: productos y cantidades de cada pedido.
- `pagos`: registro del método y resultado de pago simulado.

Al confirmar una compra, el backend PHP valida los datos, verifica el inventario, registra el cliente, pedido, detalle y pago dentro de una transacción SQL, y descuenta las unidades vendidas. Los productos se consultan desde MySQL mediante `api/productos.php`.

## Funcionalidades
- Catálogo desde MySQL y fotografías remotas de Unsplash.
- Carrito con validación de inventario.
- Registro de cliente y dirección de entrega.
- Cotización aproximada de envío y consulta de clima con Open-Meteo.
- Conversión COP/USD/EUR con ExchangeRate-API.
- Registro persistente de pedidos y actualización de stock.
- Métodos Tarjeta, PSE y Nequi con resultado **simulado**.
- Diseño responsive.

## Arquitectura POO
Se conservan las clases JavaScript `Usuario`, `Cliente`, `Producto`, `ItemCarrito`, `Carrito`, `Transaccion`, `MedioPago`, `PagoTarjeta`, `PagoPSE`, `PagoNequi` y los servicios de envío, clima y divisas.

## Seguridad y límites
Los pagos no son reales: no hay conexión con bancos ni pasarela de pagos. No ingreses datos financieros reales. El backend no recibe ni almacena número de tarjeta, vencimiento ni CVV; únicamente registra el método de pago y su estado simulado. Para una tienda comercial se requiere pasarela certificada, HTTPS, autenticación, protección CSRF, gestión de secretos y controles adicionales.

## Estructura
```text
coquito-amarillo/
├── api/                  # Endpoints PHP y conexión PDO
├── database/             # Script SQL para phpMyAdmin
├── data/productos.json   # Catálogo de respaldo/documentación
├── css/
├── js/
└── index.html
```
