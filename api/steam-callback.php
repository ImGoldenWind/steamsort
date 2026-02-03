<?php

session_start();

function openidError(string $message): void
{
    die($message);
}

if (!isset($_GET['openid_claimed_id'])) {
    openidError('Invalid OpenID response');
}

$claimedId = $_GET['openid_claimed_id'];

if (!preg_match('#/id/(\d+)$#', $claimedId, $matches)) {
    openidError('SteamID not found');
}

$steamId = $matches[1];

$_SESSION['steamid'] = $steamId;

header('Location: /');
exit;
