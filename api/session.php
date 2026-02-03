<?php

session_start();
header('Content-Type: application/json');

$response = [
    'authenticated' => isset($_SESSION['steamid']),
];

if ($response['authenticated']) {
    $response['steamid'] = $_SESSION['steamid'];
}

echo json_encode($response);
