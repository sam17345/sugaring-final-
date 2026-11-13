<?php
/**
 * SS Gaming Store - Admin Authentication, Session Security, CSRF & Throttling
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/config.php';

// Block indexing on every admin response
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

/**
 * Start hardened PHP session and enforce 30-minute idle timeout.
 * Returns true if session expired during this request.
 */
function ss_admin_start_session(): bool
{
    $cookiePath = ss_detect_base_path();
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');

    session_name(SS_SESSION_NAME);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => $cookiePath,
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => $isHttps,
    ]);

    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    $expired = false;
    if (!empty($_SESSION['ss_admin_logged_in'])) {
        $lastActivity = (int)($_SESSION['last_activity'] ?? 0);
        if ($lastActivity > 0 && (time() - $lastActivity) > SS_SESSION_IDLE_TIMEOUT) {
            $expired = true;
            ss_admin_destroy_session();
            session_start();
        } else {
            $_SESSION['last_activity'] = time();
        }
    }

    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $expired;
}

function ss_admin_destroy_session(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            (bool)$params['secure'],
            (bool)$params['httponly']
        );
    }
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}

function ss_is_logged_in(): bool
{
    return !empty($_SESSION['ss_admin_logged_in']);
}

function ss_csrf_token(): string
{
    return (string)($_SESSION['csrf_token'] ?? '');
}

function ss_verify_csrf(?string $token): bool
{
    $expected = ss_csrf_token();
    if ($expected === '' || !$token) {
        return false;
    }
    return hash_equals($expected, $token);
}

/**
 * First-time setup is ONLY active when data/auth.json does not have a password hash yet.
 */
function ss_is_password_configured(): bool
{
    $auth = ss_json_read(SS_AUTH_FILE);
    return is_array($auth) && !empty($auth['password_hash']) && is_string($auth['password_hash']);
}

function ss_client_ip_key(): string
{
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    return hash('sha256', $ip . '|ssgs_throttle');
}

/**
 * Check if current IP is locked out after 5 failed login attempts.
 * Returns ['locked' => bool, 'remaining_seconds' => int].
 */
function ss_check_login_throttle(): array
{
    $attempts = ss_json_read(SS_ATTEMPTS_FILE, []);
    if (!is_array($attempts)) {
        return ['locked' => false, 'remaining_seconds' => 0];
    }
    $key = ss_client_ip_key();
    $entry = $attempts[$key] ?? null;
    if (!is_array($entry)) {
        return ['locked' => false, 'remaining_seconds' => 0];
    }

    $lockedUntil = (int)($entry['locked_until'] ?? 0);
    $now = time();
    if ($lockedUntil > $now) {
        return ['locked' => true, 'remaining_seconds' => $lockedUntil - $now];
    }

    return ['locked' => false, 'remaining_seconds' => 0];
}

function ss_record_failed_login(): array
{
    $attempts = ss_json_read(SS_ATTEMPTS_FILE, []);
    if (!is_array($attempts)) {
        $attempts = [];
    }
    $now = time();

    // Prune stale entries older than 1 hour
    foreach ($attempts as $k => $v) {
        if (!is_array($v) || (($v['last_try'] ?? 0) < ($now - 3600))) {
            unset($attempts[$k]);
        }
    }

    $key = ss_client_ip_key();
    $entry = is_array($attempts[$key] ?? null) ? $attempts[$key] : ['count' => 0, 'locked_until' => 0, 'last_try' => $now];

    // Reset counter if previous lockout already expired
    if (($entry['locked_until'] ?? 0) > 0 && ($entry['locked_until'] <= $now)) {
        $entry['count'] = 0;
        $entry['locked_until'] = 0;
    }

    $entry['count'] = (int)$entry['count'] + 1;
    $entry['last_try'] = $now;

    if ($entry['count'] >= SS_MAX_LOGIN_ATTEMPTS) {
        $entry['locked_until'] = $now + SS_LOGIN_LOCKOUT_SECONDS;
    }

    $attempts[$key] = $entry;
    ss_json_write_atomic(SS_ATTEMPTS_FILE, $attempts);

    return $entry;
}

function ss_clear_login_attempts(): void
{
    $attempts = ss_json_read(SS_ATTEMPTS_FILE, []);
    if (!is_array($attempts)) {
        return;
    }
    $key = ss_client_ip_key();
    if (isset($attempts[$key])) {
        unset($attempts[$key]);
        ss_json_write_atomic(SS_ATTEMPTS_FILE, $attempts);
    }
}
