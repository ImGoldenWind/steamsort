<?php

header('Content-Type: application/json; charset=utf-8');

$DB_HOST = 'localhost';
$DB_USER = 'dwarfiwd_steamso';
$DB_PASS = '%MA7B8PIasaW';
$DB_NAME = 'dwarfiwd_steamso';

$db = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
$db->set_charset('utf8mb4');

if ($db->connect_error) {
    echo json_encode(['status' => 'error']);
    exit;
}

function jsonError(): void
{
    echo json_encode(['status' => 'error']);
    exit;
}

function jsonOk(int $main, int $mainExtra, int $completionist): void
{
    echo json_encode([
        'status'         => 'ok',
        'main'           => $main,
        'mainExtra'      => $mainExtra,
        'completionist'  => $completionist,
    ]);
    exit;
}

function fetchHltb(mysqli $db, string $sql, string $param): bool
{
    $stmt = $db->prepare($sql);
    $stmt->bind_param('s', $param);
    $stmt->execute();
    $stmt->bind_result($main, $mainExtra, $completionist);

    if ($stmt->fetch()) {
        jsonOk((int)$main, (int)$mainExtra, (int)$completionist);
    }

    $stmt->close();
    return false;
}

function normalizeGameName(string $name): string
{
    $name = strtolower($name);

    $name = preg_replace('/[™®©]/u', '', $name);
    $name = preg_replace('/[\p{So}\p{Sk}]/u', '', $name);
    $name = preg_replace('/\([^)]*\)/u', '', $name);

    $name = preg_replace(
        '/\b(edition|remastered|definitive|complete|goty|ultimate|directors cut)\b/u',
        '',
        $name
    );
    $name = preg_replace(
        '/\b(dlc|soundtrack|demo|beta|playtest)\b/u',
        '',
        $name
    );

    $name = preg_replace('/[\'’&]/u', '', $name);

    $name = preg_replace('/[:\-–_"!.,]/u', ' ', $name);

    $name = str_replace('video game', 'videogame', $name);

    $name = preg_replace('/\s+/u', ' ', $name);

    return trim($name);
}

$raw   = file_get_contents('php://input');
$input = json_decode($raw, true);

if (!is_array($input) || empty($input['name'])) {
    jsonError();
}

$name       = trim($input['name']);
$normalized = normalizeGameName($name);

fetchHltb(
    $db,
    'SELECT main_story, main_plus_sides, completionist
     FROM hltb_games
     WHERE name = ?
     LIMIT 1',
    $name
);

fetchHltb(
    $db,
    'SELECT main_story, main_plus_sides, completionist
     FROM hltb_games
     WHERE normalized_name = ?
     LIMIT 1',
    $normalized
);

fetchHltb(
    $db,
    'SELECT main_story, main_plus_sides, completionist
     FROM hltb_games
     WHERE normalized_name LIKE ?
     ORDER BY
       CASE WHEN main_story IS NOT NULL THEN 1 ELSE 0 END DESC,
       CASE WHEN main_plus_sides IS NOT NULL THEN 1 ELSE 0 END DESC,
       CASE WHEN completionist IS NOT NULL THEN 1 ELSE 0 END DESC
     LIMIT 1',
    '%' . $normalized . '%'
);

jsonError();
