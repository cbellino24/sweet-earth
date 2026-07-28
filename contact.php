<?php
/**
 * Contact form handler for Bluehost shared hosting (uses PHP mail()).
 *
 * Inbox: 452digitalco@gmail.com (+ hello@452digitalco.com backup).
 * Envelope: no-reply@uhj.psk.mybluehost.me (Bluehost shared hosting).
 */
declare(strict_types=1);

require_once __DIR__ . '/mail-config.php';

/** Honeypot field name (avoid legacy name "company" — triggers some ModSecurity rules). */
function contact_honeypot_filled(): bool
{
    $trap = trim((string) ($_POST['bot_check'] ?? ''));
    if ($trap !== '') {
        return true;
    }
    return trim((string) ($_POST['company'] ?? '')) !== '';
}

function contact_wants_json(): bool
{
    return str_contains((string) ($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json');
}

/**
 * @param int $httpStatus
 * @param array{ok: bool, message?: string} $data
 * @return never
 */
function contact_json(int $httpStatus, array $data): void
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
function contact_redirect(string $query = ''): void
{
    $path = '/contact';
    if ($query !== '') {
        $path .= '?' . ltrim($query, '?');
    }
    header('X-Content-Type-Options: nosniff');
    header('Location: ' . $path, true, 303);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    // Block direct access; do not show PHP to visitors.
    contact_redirect('');
}

// Always JSON for POST (site forms use fetch). Avoids relying on Accept: application/json,
// which Bluehost ModSecurity often blocks with HTTP 406.
$wantsJson = true;

if ($method !== 'POST') {
    if ($wantsJson) {
        contact_json(405, [
            'ok' => false,
            'message' => 'Use the contact form to send a message.',
        ]);
    }
    contact_redirect('error=1');
}

if (contact_honeypot_filled()) {
    if ($wantsJson) {
        // Silent "success" for spam bots.
        contact_json(200, [
            'ok' => true,
            'message' => 'Thanks — we got your message. We will reply within one business day.',
        ]);
    }
    contact_redirect('sent=1');
}

function contact_clean_line(string $s): string
{
    $s = preg_replace("/[\r\n\x00]+/u", ' ', $s);
    return trim($s);
}

function contact_sanitize_string(string $s, int $max = 20000): string
{
    $s = contact_clean_line($s);
    if (strlen($s) > $max) {
        $s = substr($s, 0, $max);
    }
    return $s;
}

/**
 * Preserves newlines (email body) while removing nulls and capping length.
 */
function contact_sanitize_multiline(string $s, int $max = 20000): string
{
    $s = str_replace("\0", '', $s);
    $s = str_replace(["\r\n", "\r"], "\n", $s);
    if (strlen($s) > $max) {
        $s = substr($s, 0, $max);
    }
    return trim($s);
}

$name = contact_sanitize_string((string) ($_POST['name'] ?? ''), 500);
$business = contact_sanitize_string((string) ($_POST['business'] ?? ''), 500);
$email = contact_sanitize_string((string) ($_POST['email'] ?? ''), 320);
$phone = contact_sanitize_string((string) ($_POST['phone'] ?? ''), 100);
$help = contact_sanitize_string((string) ($_POST['help'] ?? ''), 500);
$messageBody = contact_sanitize_multiline((string) ($_POST['message'] ?? ''), 20000);
if ($messageBody === '') {
    $messageBody = contact_sanitize_multiline((string) ($_POST['details'] ?? ''), 20000);
}
$website = contact_sanitize_string((string) ($_POST['website'] ?? ''), 2000);
$timeline = contact_sanitize_string((string) ($_POST['timeline'] ?? ''), 200);

$missing = [];
if ($name === '') {
    $missing[] = 'name';
}
if ($business === '') {
    $missing[] = 'business';
}
if ($email === '') {
    $missing[] = 'email';
}
if ($phone === '') {
    $missing[] = 'phone';
}
if ($help === '') {
    $missing[] = 'help';
}
if ($messageBody === '') {
    $missing[] = 'message';
}

if (count($missing) > 0) {
    if ($wantsJson) {
        contact_json(400, [
            'ok' => false,
            'message' => 'Please fill out the required fields.',
            'reason' => 'missing_fields',
        ]);
    }
    contact_redirect('error=1');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    if ($wantsJson) {
        contact_json(400, [
            'ok' => false,
            'message' => 'Please enter a valid email address.',
            'reason' => 'invalid_email',
        ]);
    }
    contact_redirect('error=1');
}

if ($website !== '' && !filter_var($website, FILTER_VALIDATE_URL)) {
    if ($wantsJson) {
        contact_json(400, [
            'ok' => false,
            'message' => 'Please enter a full website URL (include https://), or leave it blank.',
            'reason' => 'invalid_website',
        ]);
    }
    contact_redirect('error=1');
}

$tz = new DateTimeZone('America/Chicago');
$submitted = (new DateTimeImmutable('now', $tz))->format('Y-m-d H:i:s T');

$lines = [
    'Name: ' . $name,
    'Business: ' . $business,
    'Email: ' . $email,
    'Phone: ' . $phone,
];
if ($website !== '') {
    $lines[] = 'Website: ' . $website;
}
$lines[] = 'Service / help: ' . $help;
$lines[] = '';
$lines[] = 'Message:';
$lines[] = $messageBody;
if ($timeline !== '') {
    $lines[] = '';
    $lines[] = 'When hoping to start: ' . $timeline;
}
$lines[] = '';
$lines[] = 'Date/time submitted: ' . $submitted;
$body = str_replace("\r", '', implode("\n", $lines));
$body = (string) preg_replace("/\n{3,}/u", "\n\n", $body);

$subject = 'New website inquiry from 452 Digital Co.';
$ok = form_mail_send($subject, $body, $name, $email, 'X-Contact-Form: 452digitalco.com');

if (!$ok) {
    if ($wantsJson) {
        contact_json(500, [
            'ok' => false,
            'message' => 'We could not send your message right now. Please call (402) 804-3315.',
            'reason' => 'mail_failed',
        ]);
    }
    contact_redirect('error=1');
}

if ($wantsJson) {
    contact_json(200, [
        'ok' => true,
        'message' => 'Thanks — we got your message. We will reply within one business day.',
    ]);
}
contact_redirect('sent=1');
