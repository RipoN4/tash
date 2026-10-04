<?php
/**
 * Tash Counter - Fetch Saved Matches & Live State
 */
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

$dataFile = __DIR__ . '/../data/games.json';

if (!file_exists($dataFile)) {
    echo json_encode([
        'status' => 'empty',
        'data' => null,
        'message' => 'No saved games found yet'
    ]);
    exit;
}

$content = file_get_contents($dataFile);
$data = json_decode($content, true);

echo json_encode([
    'status' => 'success',
    'data' => $data
]);
