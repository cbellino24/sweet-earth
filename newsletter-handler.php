<?php
declare(strict_types=1);

require_once __DIR__ . '/mail-config.php';

function newsletter_wants_json(): bool
{
    return str_contains((string) ($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json');
}

/**
 * @param array{ok: bool, message?: string, reason?: string} $data
 * @return never
 */
function newsletter_json(int $httpStatus, array $data): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    http_response_code($httpStatus);
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * @return never
 */
function redirect_to(string $path): void
{
    header('Location: ' . $path, true, 303);
    exit;
}

function clean_field(string $value, int $maxLen): string
{
    $v = trim($value);
    $v = str_replace(["\r", "\n"], ' ', $v);
    if (function_exists('mb_substr')) {
        $v = mb_substr($v, 0, $maxLen);
    } else {
        $v = substr($v, 0, $maxLen);
    }
    return $v;
}

function csv_safe(string $value): string
{
    if ($value !== '' && preg_match('/^[=\+\-@]/', $value) === 1) {
        return "'" . $value;
    }
    return $value;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    if (newsletter_wants_json()) {
        newsletter_json(405, [
            'ok' => false,
            'message' => 'Use the newsletter form to subscribe.',
            'reason' => 'invalid_method',
        ]);
    }
    redirect_to('/blog');
}

// POST from blog newsletter uses fetch — always JSON (see contact.php re ModSecurity).
$wantsJson = true;

$honeypot = trim((string) ($_POST['bot_check'] ?? $_POST['company'] ?? ''));
if ($honeypot !== '') {
    if ($wantsJson) {
        newsletter_json(200, [
            'ok' => true,
            'message' => 'Thanks — you are on the list.',
        ]);
    }
    redirect_to('/thank-you');
}

$name = clean_field((string) ($_POST['name'] ?? ''), 80);
$emailRaw = clean_field((string) ($_POST['email'] ?? ''), 254);
$email = strtolower($emailRaw);

if ($name === '' || $email === '') {
    if ($wantsJson) {
        newsletter_json(400, [
            'ok' => false,
            'message' => 'Please enter your name and email.',
            'reason' => 'missing_fields',
        ]);
    }
    redirect_to('/blog?newsletter=error');
}

if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    if ($wantsJson) {
        newsletter_json(400, [
            'ok' => false,
            'message' => 'Please enter a valid email address.',
            'reason' => 'invalid_email',
        ]);
    }
    redirect_to('/blog?newsletter=error');
}

$csvPath = __DIR__ . DIRECTORY_SEPARATOR . 'newsletter-signups.csv';
$isNew = !file_exists($csvPath);

$fp = @fopen($csvPath, 'ab');
if ($fp === false) {
    if ($wantsJson) {
        newsletter_json(500, [
            'ok' => false,
            'message' => 'We could not save your signup right now. Please try again in a moment.',
            'reason' => 'storage_error',
        ]);
    }
    redirect_to('/blog?newsletter=error');
}

if (!flock($fp, LOCK_EX)) {
    fclose($fp);
    if ($wantsJson) {
        newsletter_json(500, [
            'ok' => false,
            'message' => 'We could not save your signup right now. Please try again in a moment.',
            'reason' => 'storage_busy',
        ]);
    }
    redirect_to('/blog?newsletter=error');
}

if ($isNew) {
    fputcsv($fp, ['timestamp', 'name', 'email', 'ip', 'user_agent']);
}

$row = [
    gmdate('c'),
    csv_safe($name),
    csv_safe($email),
    clean_field((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 64),
    clean_field((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 240),
];

fputcsv($fp, $row);
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

$notifySubject = 'Newsletter signup — 452 Digital Co.';
$notifyBody = "New newsletter signup\n\nName: {$name}\nEmail: {$email}\nTime: " . gmdate('c') . "\n";
form_mail_send($notifySubject, $notifyBody, $name, $email, 'X-Newsletter-Form: 452digitalco.com');

if ($wantsJson) {
    newsletter_json(200, [
        'ok' => true,
        'message' => 'Thanks — you are on the list. We will send Omaha web design and SEO tips when we publish.',
    ]);
}
redirect_to('/thank-you');
