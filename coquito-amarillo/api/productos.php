<?php
require_once __DIR__ . '/config.php';

try {
    $filas = db()->query(
        'SELECT sku, nombre, peso, precio, stock, categoria, etiqueta, descripcion, imagen
         FROM productos WHERE activo = 1 ORDER BY id'
    )->fetchAll();

    // MySQL entrega DECIMAL e INT como texto; los convertimos a números para el frontend
    foreach ($filas as &$f) {
        $f['precio'] = (float)$f['precio'];
        $f['stock'] = (int)$f['stock'];
    }
    unset($f);

    jsonResponse($filas);
} catch (Throwable $e) {
    error_log('productos.php: ' . $e->getMessage());
    jsonResponse(['error' => 'No fue posible consultar los productos. Importa database/coquito_amarillo.sql en phpMyAdmin.'], 500);
}
