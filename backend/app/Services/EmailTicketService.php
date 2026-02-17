<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\TicketAttachment;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class EmailTicketService
{
    /**
     * Process an email and create or update a ticket
     */
    public function processEmail($message)
    {
        try {
            // Extract email data
            $from = $message->getFrom()[0];
            $senderEmail = $from->mail;
            $senderName = $from->personal ?? $from->mail;
            $subject = $message->getSubject();
            $body = $this->getEmailBody($message);
            $messageId = $message->getMessageId();
            $headers = $message->getHeader()->raw;

            //  Check if we've already processed this email
            if ($this->isEmailProcessed($messageId)) {
                Log::info("Email already processed", ['message_id' => $messageId]);
                return null;
            }

            // Check if this is a reply to an existing ticket
            $existingTicket = $this->findTicketByEmailThread($message);

            if ($existingTicket) {
                // Add message to existing ticket
                return $this->addMessageToTicket($existingTicket, $senderEmail, $body, $messageId, $headers, $message);
            } else {
                // Create new ticket
                return $this->createTicketFromEmail($senderEmail, $senderName, $subject, $body, $messageId, $headers, $message);
            }
        } catch (\Exception $e) {
            Log::error("Error processing email", [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Get email body (prefer plain text, fallback to HTML)
     */
    private function getEmailBody($message)
    {
        $body = $message->getTextBody();

        if (empty($body)) {
            $body = $message->getHTMLBody();
            // Convert HTML to plain text (basic conversion)
            $body = strip_tags($body);
        }

        return trim($body);
    }

    /**
     * Check if email has already been processed
     */
    private function isEmailProcessed($messageId)
    {
        if (empty($messageId)) {
            return false;
        }

        return TicketMessage::where('email_message_id', $messageId)->exists();
    }

    /**
     * Find existing ticket by email thread
     */
    private function findTicketByEmailThread($message)
    {
        // Check References and In-Reply-To headers
        $references = $message->getReferences();
        $inReplyTo = $message->getInReplyTo();

        $threadIds = array_merge(
            is_array($references) ? $references : [],
            $inReplyTo ? [$inReplyTo] : []
        );

        if (empty($threadIds)) {
            return null;
        }

        foreach ($threadIds as $threadId) {
            $ticket = Ticket::where('email_message_id', $threadId)
                ->orWhere('email_thread_id', $threadId)
                ->first();

            if ($ticket) {
                return $ticket;
            }
        }

        return null;
    }

    /**
     * Create new ticket from email
     */
    private function createTicketFromEmail($senderEmail, $senderName, $subject, $body, $messageId, $headers, $message)
    {
        // Find or create contact
        $contact = $this->findOrCreateContact($senderEmail, $senderName);

        if (!$contact) {
            Log::error("Could not create contact for email", ['email' => $senderEmail]);
            return null;
        }

        // Create ticket
        $ticket = Ticket::create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $contact->tenant_id,
            'contact_id' => $contact->id,
            'subject' => $subject ?: 'No Subject',
            'status' => 'NEW',
            'priority' => 'P3',
            'type' => 'INCIDENCE',
            'email_message_id' => $messageId,
            'email_thread_id' => $messageId,
        ]);

        // Create first message
        $ticketMessage = TicketMessage::create([
            'ticket_id' => $ticket->id,
            'contact_id' => $contact->id,
            'body' => $body,
            'is_internal' => false,
            'channel_source' => 'email',
            'email_message_id' => $messageId,
            'email_headers' => $headers,
        ]);

        // Process attachments
        $this->processAttachments($message, $ticket->id, $ticketMessage->id);

        Log::info("Created ticket from email", [
            'ticket_id' => $ticket->id,
            'contact_email' => $senderEmail
        ]);

        return $ticket;
    }

    /**
     * Add message to existing ticket
     */
    private function addMessageToTicket($ticket, $senderEmail, $body, $messageId, $headers, $message)
    {
        // Find contact by email
        $contact = Contact::where('email', $senderEmail)
            ->where('tenant_id', $ticket->tenant_id)
            ->first();

        if (!$contact) {
            Log::warning("Email from unknown contact for existing ticket", [
                'email' => $senderEmail,
                'ticket_id' => $ticket->id
            ]);
            return null;
        }

        // Create message
        $ticketMessage = TicketMessage::create([
            'ticket_id' => $ticket->id,
            'contact_id' => $contact->id,
            'body' => $body,
            'is_internal' => false,
            'channel_source' => 'email',
            'email_message_id' => $messageId,
            'email_headers' => $headers,
        ]);

        // Update ticket status if it was closed
        if (in_array($ticket->status, ['CLOSED', 'RESOLVED'])) {
            $ticket->update(['status' => 'OPEN']);
        }

        // Process attachments
        $this->processAttachments($message, $ticket->id, $ticketMessage->id);

        Log::info("Added message to existing ticket", [
            'ticket_id' => $ticket->id,
            'message_id' => $ticketMessage->id
        ]);

        return $ticket;
    }

    /**
     * Find or create contact from email
     */
    private function findOrCreateContact($email, $name)
    {
        // Try to find existing contact across all tenants
        $contact = Contact::where('email', $email)->first();

        if ($contact) {
            return $contact;
        }

        // No existing contact - we need to determine tenant
        // For now, create contact without tenant (will need manual assignment)
        // In production, you might want to:
        // 1. Use email domain matching
        // 2. Use email plus addressing (support+tenant123@domain.com)
        // 3. Have a default tenant for unknown senders

        Log::warning("Received email from unknown sender", [
            'email' => $email,
            'name' => $name
        ]);

        // Return null to indicate we can't auto-create
        // The admin will need to manually create this contact
        return null;
    }

    /**
     * Process email attachments
     */
    private function processAttachments($message, $ticketId, $messageId)
    {
        $attachments = $message->getAttachments();

        foreach ($attachments as $attachment) {
            try {
                $fileName = $attachment->getName();
                $fileContent = $attachment->getContent();
                $mimeType = $attachment->getContentType();
                $fileSize = strlen($fileContent);

                // Generate unique filename
                $storedFileName = Str::uuid() . '_' . $fileName;
                $path = "attachments/{$ticketId}/{$storedFileName}";

                // Store file in S3/MinIO
                Storage::put($path, $fileContent);

                // Create attachment record
                TicketAttachment::create([
                    'ticket_id' => $ticketId,
                    'ticket_message_id' => $messageId,
                    'filename' => $fileName,
                    'filepath' => $path,
                    'filesize' => $fileSize,
                    'mimetype' => $mimeType,
                ]);

                Log::info("Processed attachment", [
                    'ticket_id' => $ticketId,
                    'filename' => $fileName
                ]);
            } catch (\Exception $e) {
                Log::error("Error processing attachment", [
                    'ticket_id' => $ticketId,
                    'filename' => $fileName ?? 'unknown',
                    'error' => $e->getMessage()
                ]);
            }
        }
    }
}
