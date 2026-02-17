<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TicketAttachment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AttachmentController extends Controller
{
    /**
     * Allowed file types
     */
    private const ALLOWED_MIME_TYPES = [
        // Images
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/svg+xml',
        // Documents
        'application/pdf',
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/vnd.ms-excel', // .xls
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-powerpoint', // .ppt
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
        // Text
        'text/plain',
        'text/csv',
        // Archives
        'application/zip',
        'application/x-zip-compressed',
    ];

    private const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    /**
     * Upload a file
     */
    public function upload(Request $request)
    {
        $request->validate([
            'file' => 'required|file|max:10240', // 10MB in KB
        ]);

        $file = $request->file('file');

        // Validate file type
        if (!in_array($file->getMimeType(), self::ALLOWED_MIME_TYPES)) {
            return response()->json([
                'message' => 'File type not allowed. Allowed types: images, PDFs, documents, text files, and ZIP archives.'
            ], 422);
        }

        // Validate file size
        if ($file->getSize() > self::MAX_FILE_SIZE) {
            return response()->json([
                'message' => 'File size exceeds 10MB limit.'
            ], 422);
        }

        // Generate unique filename
        $originalName = $file->getClientOriginalName();
        $extension = $file->getClientOriginalExtension();
        $safeFilename = Str::slug(pathinfo($originalName, PATHINFO_FILENAME));
        $uniqueFilename = $safeFilename . '_' . uniqid() . '.' . $extension;

        // Store file
        $path = $file->storeAs('attachments', $uniqueFilename, 'public');

        // Return file data to be saved when associated with a ticket/message
        return response()->json([
            'name' => $originalName,
            'path' => $path,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
        ]);
    }

    /**
     * Download/view a file
     */
    public function download($id)
    {
        $attachment = TicketAttachment::findOrFail($id);

        // Security: Check if user has access to this attachment
        // via their tenant_id through the ticket
        if ($attachment->message && $attachment->message->ticket) {
            $ticket = $attachment->message->ticket;

            if (auth()->user()->tenant_id !== $ticket->tenant_id) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
        }

        if (!Storage::disk('public')->exists($attachment->path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        return response()->download(
            Storage::disk('public')->path($attachment->path),
            $attachment->name
        );
    }

    /**
     * Delete an attachment
     */
    public function destroy($id)
    {
        $attachment = TicketAttachment::findOrFail($id);

        // Security check
        if ($attachment->message && $attachment->message->ticket) {
            $ticket = $attachment->message->ticket;

            if (auth()->user()->tenant_id !== $ticket->tenant_id) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Only allow deletion if user is admin
            if (auth()->user()->role !== 'admin') {
                return response()->json(['message' => 'Only admins can delete attachments'], 403);
            }
        }

        // Delete file from storage
        if (Storage::disk('public')->exists($attachment->path)) {
            Storage::disk('public')->delete($attachment->path);
        }

        $attachment->delete();

        return response()->json(['message' => 'Attachment deleted successfully']);
    }
}
