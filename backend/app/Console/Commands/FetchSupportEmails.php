<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Webklex\PHPIMAP\ClientManager;
use App\Services\EmailTicketService;
use Illuminate\Support\Facades\Log;

class FetchSupportEmails extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'tickets:fetch-emails {--limit=50 : Maximum emails to process}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Fetch support emails and create/update tickets';

    protected $emailService;

    public function __construct(EmailTicketService $emailService)
    {
        parent::__construct();
        $this->emailService = $emailService;
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting email fetch...');

        try {
            // Check if IMAP is configured
            if (!config('imap.accounts.default.username')) {
                $this->error('IMAP not configured. Please set IMAP credentials in .env');
                return 1;
            }

            // Connect to IMAP
            $cm = new ClientManager();
            $client = $cm->make([
                'host' => config('imap.accounts.default.host'),
                'port' => config('imap.accounts.default.port'),
                'encryption' => config('imap.accounts.default.encryption'),
                'validate_cert' => config('imap.accounts.default.validate_cert'),
                'username' => config('imap.accounts.default.username'),
                'password' => config('imap.accounts.default.password'),
                'protocol' => config('imap.accounts.default.protocol'),
            ]);

            $client->connect();

            $this->info('Connected to email server');

            // Get INBOX folder
            $folder = $client->getFolder('INBOX');

            // Get unread messages from the last hour only
            $sinceDate = now()->subHour()->format('d M Y');

            $messages = $folder->query()
                ->unseen()
                ->since($sinceDate)
                ->limit($this->option('limit'))
                ->get();

            $this->info("Found {$messages->count()} unread messages");

            $processed = 0;
            $errors = 0;

            foreach ($messages as $message) {
                try {
                    $this->line("Processing: " . $message->getSubject());

                    $result = $this->emailService->processEmail($message);

                    if ($result) {
                        // Mark as seen
                        $message->setFlag('Seen');
                        $processed++;
                        $this->info("  ✓ Processed successfully");
                    } else {
                        $this->warn("  ⚠ Skipped (unknown sender or duplicate)");
                    }
                } catch (\Exception $e) {
                    $errors++;
                    $this->error("  ✗ Error: " . $e->getMessage());
                    Log::error("Error processing email", [
                        'subject' => $message->getSubject(),
                        'error' => $e->getMessage()
                    ]);
                }
            }

            $this->info("\nSummary:");
            $this->info("  Processed: {$processed}");
            $this->info("  Errors: {$errors}");
            $this->info("  Total: {$messages->count()}");

            return 0;
        } catch (\Exception $e) {
            $this->error('Failed to fetch emails: ' . $e->getMessage());
            Log::error('Email fetch failed', ['error' => $e->getMessage()]);
            return 1;
        }
    }
}
