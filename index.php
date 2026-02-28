<?php
$serverIP = $_SERVER['SERVER_ADDR'];
$clientIP = $_SERVER['REMOTE_ADDR'];
?>

<h1>Prototype Dashboard</h1>

<ul>
    <li>Server IP: <?php echo $serverIP; ?></li>
    <li>Client IP: <?php echo $clientIP; ?></li>
    <li>Server Time: <?php echo date("Y-m-d H:i:s"); ?></li>
</ul>
