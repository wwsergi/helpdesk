<?php

return [
    'default' => env('IMAP_DEFAULT_ACCOUNT', 'default'),

    'accounts' => [
        'default' => [
            'host' => env('IMAP_HOST', 'localhost'),
            'port' => env('IMAP_PORT', 993),
            'encryption' => env('IMAP_ENCRYPTION', 'ssl'),
            'validate_cert' => env('IMAP_VALIDATE_CERT', true),
            'username' => env('IMAP_USERNAME'),
            'password' => env('IMAP_PASSWORD'),
            'protocol' => env('IMAP_PROTOCOL', 'imap'),
        ],
    ],

    'options' => [
        'delimiter' => env('IMAP_DELIMITER', '/'),
        'fetch' => \Webklex\PHPIMAP\IMAP::FT_PEEK,
        'fetch_body' => true,
        'fetch_attachment' => true,
        'fetch_flags' => true,
        'message_key' => 'id',
        'fetch_order' => 'asc',
        'open' => [
            'DISABLE_AUTHENTICATOR' => env('IMAP_OPEN_DISABLE_AUTHENTICATOR', 'GSSAPI'),
        ],
        'decoder' => [
            'message' => [
                'subject' => 'utf-8',
                'from' => 'utf-8',
                'to' => 'utf-8',
            ],
            'attachment' => [
                'name' => 'utf-8',
            ],
        ],
    ],

    'date_format' => 'd M y',

    'masks' => [
        'message' => \Webklex\PHPIMAP\Support\Masks\MessageMask::class,
        'attachment' => \Webklex\PHPIMAP\Support\Masks\AttachmentMask::class
    ],
];
