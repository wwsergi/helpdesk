<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TicketAttachment extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_message_id',
        'name',
        'path',
        'mime_type',
        'size',
    ];

    protected $appends = ['url'];

    /**
     * Get the message this attachment belongs to
     */
    public function message()
    {
        return $this->belongsTo(TicketMessage::class, 'ticket_message_id');
    }

    /**
     * Get the full URL for the attachment
     */
    public function getUrlAttribute()
    {
        return url('/api/attachments/' . $this->id);
    }
}
