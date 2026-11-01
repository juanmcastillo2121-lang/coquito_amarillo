<?php
// Configuración local para XAMPP. Cambia estos valores si tu MySQL usa otra clave.
ini_set('display_errors', '0');   // los avisos de PHP no deben mezclarse con la respuesta JSON
ini_set('log_errors', '1');       // pero sí quedan registrados en el log del servidor
error_reporting(E_ALL);

$DB_HOST = 'localhost';
$DB_NAME = 'coquito_amarillo';
$DB_USER = 'root';
$DB_PASS = '';

function db(): PDO {
    global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS;
    return new PDO("mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4", $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

function jsonResponse($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Cuenta caracteres UTF-8 sin depender de la extensión mbstring
function longitudTexto(string $texto): int {
    return function_exists('mb_strlen')
        ? mb_strlen($texto, 'UTF-8')
        : count(preg_split('//u', $texto, -1, PREG_SPLIT_NO_EMPTY));
}
