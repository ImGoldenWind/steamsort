<?php
session_start();

$realm    = 'https://sort-steam-library.ru/';
$returnTo = $realm . '/api/steam-callback.php';

$openidNs = 'http://specs.openid.net/auth/2.0';
$identifierSelect = $openidNs . '/identifier_select';

$params = [
    'openid.ns'         => $openidNs,
    'openid.mode'       => 'checkid_setup',
    'openid.return_to'  => $returnTo,
    'openid.realm'      => $realm,
    'openid.identity'   => $identifierSelect,
    'openid.claimed_id' => $identifierSelect,
];

$query = http_build_query($params);

header('Location: https://steamcommunity.com/openid/login?' . $query);
exit;
