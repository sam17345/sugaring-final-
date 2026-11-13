<?php
/**
 * SS Gaming Store - Admin Logout Endpoint
 */

declare(strict_types=1);

require_once __DIR__ . '/auth.php';

ss_admin_start_session();
ss_admin_destroy_session();

header('Location: ./');
exit;
