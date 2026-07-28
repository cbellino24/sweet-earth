<?php
declare(strict_types=1);

/**
 * Bluehost PHP mail() settings for 452digitalco.com.
 *
 * Envelope must use your Bluehost server address (what previously delivered).
 * Recipients: Gmail primary + domain inbox backup.
 */
const FORM_MAIL_ENVELOPE = 'no-reply@uhj.psk.mybluehost.me';

/** @var list<string> */
const FORM_MAIL_RECIPIENTS = [
    '452digitalco@gmail.com',
    'hello@452digitalco.com',
];

function form_mail_send(
    string $subject,
    string $body,
    string $replyToName,
    string $replyToEmail,
    string $extraHeader = '',
): bool {
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: 452 Digital Co. <' . FORM_MAIL_ENVELOPE . '>',
        'Reply-To: ' . $replyToName . ' <' . $replyToEmail . '>',
    ];
    if ($extraHeader !== '') {
        $headers[] = $extraHeader;
    }
    $headerStr = implode("\r\n", $headers);
    $envelope = '-f' . FORM_MAIL_ENVELOPE;
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

    $anySent = false;
    foreach (FORM_MAIL_RECIPIENTS as $to) {
        $ok = @mail($to, $encodedSubject, $body, $headerStr, $envelope);
        if (!$ok) {
            $ok = @mail($to, $subject, $body, $headerStr, $envelope);
        }
        if ($ok) {
            $anySent = true;
        }
    }

    return $anySent;
}
