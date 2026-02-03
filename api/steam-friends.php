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

function jsonSuccess(array $payload): void
{
    echo json_encode(
        array_merge(['success' => true], $payload),
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

if (!isset($_SESSION['steamid'])) {
    jsonError('Not authenticated');
}

$steamId = $_SESSION['steamid'];

$steamApiKey = '96B7100AF3458EDE4E74DFB50A3CBA09';

$friendsUrl = sprintf(
    'https://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key=%s&steamid=%s&relationship=friend&format=json',
    urlencode($steamApiKey),
    urlencode($steamId)
);

$response = @file_get_contents($friendsUrl);

if ($response === false) {
    jsonError('Steam API request failed (friends list)');
}

$data = json_decode($response, true);

if (
    !isset($data['friendslist']['friends']) ||
    !is_array($data['friendslist']['friends'])
) {
    jsonSuccess(['friends' => []]);
}

$friendSteamIds = array_map(
    static fn(array $f): string => $f['steamid'],
    $data['friendslist']['friends']
);

if ($friendSteamIds === []) {
    jsonSuccess(['friends' => []]);
}

$profilesUrl = sprintf(
    'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=%s&steamids=%s&format=json',
    urlencode($steamApiKey),
    urlencode(implode(',', $friendSteamIds))
);

$profilesResponse = @file_get_contents($profilesUrl);

if ($profilesResponse === false) {
    jsonError('Steam API request failed (profiles)');
}

$profilesData = json_decode($profilesResponse, true);

if (
    !isset($profilesData['response']['players']) ||
    !is_array($profilesData['response']['players'])
) {
    jsonSuccess(['friends' => []]);
}

$friends = [];

foreach ($profilesData['response']['players'] as $player) {
    $friends[] = [
        'steamid' => $player['steamid'],
        'name'    => $player['personaname'],
        'avatar'  => $player['avatar'],
    ];
}

jsonSuccess(['friends' => $friends]);
