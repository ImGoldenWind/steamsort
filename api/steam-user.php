<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

session_start();
header('Content-Type: application/json');

function jsonError(int $code, string $message): void
{
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

if (!isset($_SESSION['steamid'])) {
    jsonError(401, 'Not authenticated');
}

$steamId = $_SESSION['steamid'];
$apiKey  = '96B7100AF3458EDE4E74DFB50A3CBA09';

$url = sprintf(
    'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=%s&steamids=%s',
    $apiKey,
    $steamId
);

$response = @file_get_contents($url);

if ($response === false) {
    jsonError(500, 'Steam API request failed');
}

$data = json_decode($response, true);

if (
    !isset($data['response']) ||
    !isset($data['response']['players'][0])
) {
    jsonError(404, 'Player not found');
}

$player = $data['response']['players'][0];

echo json_encode([
    'steamid' => $player['steamid'],
    'name'    => $player['personaname'],
    'avatar'  => $player['avatarfull'],
]);
