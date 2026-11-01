<?php
require_once __DIR__ . '/config.php';

// Errores de validación o de inventario: se devuelven al cliente con HTTP 422.
// Cualquier otra excepción (por ejemplo, de MySQL) se registra en el log y responde 500 genérico.
class PedidoInvalido extends RuntimeException {}

const METODOS_PAGO = ['Tarjeta', 'PSE', 'Nequi'];
const MONEDAS = ['COP', 'USD', 'EUR'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['error' => 'Método no permitido.'], 405);

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) jsonResponse(['error' => 'Solicitud inválida.'], 400);

$cliente   = is_array($input['cliente'] ?? null) ? $input['cliente'] : [];
$items     = is_array($input['items'] ?? null) ? $input['items'] : [];
$nombre    = trim((string)($cliente['nombre'] ?? ''));
$correo    = trim((string)($cliente['correo'] ?? ''));
$ciudad    = trim((string)($cliente['ciudad'] ?? ''));
$direccion = trim((string)($cliente['direccion'] ?? ''));
$metodo    = (string)($input['pago'] ?? '');
$moneda    = (string)($input['moneda'] ?? 'COP');
$envio     = is_numeric($input['envio'] ?? null) ? (float)$input['envio'] : -1.0;
$tasa      = is_numeric($input['tasa'] ?? null) ? (float)$input['tasa'] : 0.0;

try {
    if (longitudTexto($nombre) < 3) throw new PedidoInvalido('El nombre debe tener al menos 3 caracteres.');
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) throw new PedidoInvalido('El correo electrónico no es válido.');
    if ($ciudad === '' || $direccion === '') throw new PedidoInvalido('Completa la ciudad y la dirección de entrega.');
    if (!in_array($metodo, METODOS_PAGO, true)) throw new PedidoInvalido('Selecciona un método de pago válido.');
    if (!in_array($moneda, MONEDAS, true)) throw new PedidoInvalido('La moneda seleccionada no está disponible.');
    if ($moneda === 'COP') $tasa = 1.0;   // en pesos la tasa siempre es 1
    if ($envio < 0) throw new PedidoInvalido('El costo de envío no es válido.');
    if ($tasa <= 0) throw new PedidoInvalido('La tasa de cambio no es válida.');
    if (!$items) throw new PedidoInvalido('Tu bolsa está vacía.');

    // Sumamos las cantidades por SKU: un mismo producto repetido no puede superar el inventario
    $solicitado = [];
    foreach ($items as $item) {
        $sku = is_array($item) ? trim((string)($item['sku'] ?? '')) : '';
        $cantidad = is_array($item) ? filter_var($item['cantidad'] ?? null, FILTER_VALIDATE_INT) : false;
        if ($sku === '' || $cantidad === false || $cantidad < 1) {
            throw new PedidoInvalido('Hay un producto o una cantidad inválida en tu bolsa.');
        }
        $solicitado[$sku] = ($solicitado[$sku] ?? 0) + $cantidad;
    }

    $pdo = db();
    $pdo->beginTransaction();

    $pdo->prepare(
        'INSERT INTO clientes (nombre, correo, ciudad, direccion) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), ciudad = VALUES(ciudad), direccion = VALUES(direccion)'
    )->execute([$nombre, $correo, $ciudad, $direccion]);

    $buscarCliente = $pdo->prepare('SELECT id FROM clientes WHERE correo = ?');
    $buscarCliente->execute([$correo]);
    $clienteId = (int)$buscarCliente->fetchColumn();

    // FOR UPDATE bloquea cada producto hasta que termine la transacción
    $buscarProducto = $pdo->prepare('SELECT id, nombre, precio, stock FROM productos WHERE sku = ? AND activo = 1 FOR UPDATE');
    $subtotal = 0.0;
    $detalles = [];
    foreach ($solicitado as $sku => $cantidad) {
        $buscarProducto->execute([(string)$sku]);
        $p = $buscarProducto->fetch();
        $buscarProducto->closeCursor();
        if (!$p) throw new PedidoInvalido("El producto {$sku} ya no está disponible.");
        if ((int)$p['stock'] < $cantidad) {
            throw new PedidoInvalido("Inventario insuficiente de {$p['nombre']}. Disponibles: {$p['stock']}.");
        }
        $precio = (float)$p['precio'];
        $linea = $precio * $cantidad;
        $subtotal += $linea;
        $detalles[] = ['id' => (int)$p['id'], 'nombre' => $p['nombre'], 'precio' => $precio, 'cantidad' => $cantidad, 'total' => $linea];
    }

    // Los totales los calcula el servidor; el cliente no decide el valor convertido
    $total = round($subtotal + $envio, 2);
    $totalConvertido = round($total / $tasa, 2);
    $codigo = 'COQ-' . strtoupper(bin2hex(random_bytes(5)));

    $pedido = $pdo->prepare(
        "INSERT INTO pedidos (codigo, cliente_id, subtotal, envio, total, metodo_pago, estado, moneda, tasa_cambio, total_convertido)
         VALUES (?, ?, ?, ?, ?, ?, 'Aprobada (simulada)', ?, ?, ?)"
    );
    $pedido->execute([$codigo, $clienteId, $subtotal, $envio, $total, $metodo, $moneda, $tasa, $totalConvertido]);
    $pedidoId = (int)$pdo->lastInsertId();

    $insertarDetalle = $pdo->prepare(
        'INSERT INTO detalle_pedidos (pedido_id, producto_id, nombre_producto, precio_unitario, cantidad, total) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $descontar = $pdo->prepare('UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?');
    foreach ($detalles as $d) {
        $insertarDetalle->execute([$pedidoId, $d['id'], $d['nombre'], $d['precio'], $d['cantidad'], $d['total']]);
        $descontar->execute([$d['cantidad'], $d['id'], $d['cantidad']]);
        if ($descontar->rowCount() !== 1) throw new PedidoInvalido("Inventario insuficiente de {$d['nombre']}.");
    }

    $pdo->prepare("INSERT INTO pagos (pedido_id, metodo, estado, referencia) VALUES (?, ?, 'Simulado aprobado', ?)")
        ->execute([$pedidoId, $metodo, $codigo]);

    $pdo->commit();

    jsonResponse([
        'ok' => true,
        'pedido_id' => $pedidoId,
        'codigo' => $codigo,
        'estado' => 'Aprobada (simulada)',
        'moneda' => $moneda,
        'subtotal' => round($subtotal, 2),
        'envio' => round($envio, 2),
        'total' => $total,
        'total_convertido' => $totalConvertido,
    ], 201);

} catch (PedidoInvalido $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    jsonResponse(['error' => $e->getMessage()], 422);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('pedidos.php: ' . $e->getMessage());
    jsonResponse(['error' => 'No fue posible registrar el pedido. Revisa la conexión con MySQL e intenta de nuevo.'], 500);
}
