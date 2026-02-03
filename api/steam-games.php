<?php
declare(strict_types=1);

ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
session_start();

function jsonError(string $message): void
{
    echo json_encode([
        'success' => false,
        'error'   => $message
    ]);
    exit;
}

if (!isset($_SESSION['steamid'])) {
    jsonError('Not authenticated');
}

$sessionSteamId = $_SESSION['steamid'];
$steamId = $_GET['steamid'] ?? $sessionSteamId;

// базовая валидация
if (!preg_match('/^\d{17}$/', $steamId)) {
    jsonError('Invalid steamid');
}

$steamApiKey = '96B7100AF3458EDE4E74DFB50A3CBA09';

if (!$steamApiKey) {
    jsonError('Steam API key not configured');
}

$url = sprintf(
    'https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=%s&steamid=%s&include_appinfo=1&include_played_free_games=1&format=json',
    urlencode($steamApiKey),
    urlencode($steamId)
);

$response = @file_get_contents($url);

if ($response === false) {
    jsonError('Steam API request failed');
}

$data = json_decode($response, true);

if (!is_array($data)) {
    jsonError('Invalid Steam API response');
}

$games = [];
$source = ($steamId === $sessionSteamId) ? 'owned' : 'family';

if (
    isset($data['response']['games']) &&
    is_array($data['response']['games'])
) {
    foreach ($data['response']['games'] as $game) {
        $games[] = [
            'appid'          => $game['appid'],
            'name'           => $game['name'] ?? null,
            'source'         => $source,
            'owner_steamid'  => $steamId,
        ];
    }
}

echo json_encode([
    'success' => true,
    'games'   => $games
], JSON_UNESCAPED_UNICODE);

exit;
