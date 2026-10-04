<?php
/**
 * Tash Counter - Server-side Match Persistence API
 * Saves game states and match history to JSON file (or database in future phase).
 */
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataDir = __DIR__ . '/../data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0777, true);
}

$dataFile = $dataDir . '/games.json';

// Read JSON input
$inputRaw = file_get_contents('php://input');
if (!$inputRaw) {
    echo json_encode(['status' => 'error', 'message' => 'No payload received']);
    exit;
}

$payload = json_decode($inputRaw, true);
if (!$payload) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
    exit;
}

// Add server timestamp
$payload['server_saved_at'] = date('Y-m-d H:i:s');

// Save to disk with exclusive lock
file_put_contents($dataFile, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

echo json_encode([
    'status' => 'success',
    'message' => 'Game state safely stored on server',
    'timestamp' => $payload['server_saved_at']
]);
