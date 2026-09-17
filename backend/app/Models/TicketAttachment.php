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

    protected $appends = ['url', 'preview_url'];

    public function message()
    {
        return $this->belongsTo(TicketMessage::class, 'ticket_message_id');
    }

    public function getUrlAttribute()
    {
        return '/api/attachments/' . $this->id;
    }

    public function getPreviewUrlAttribute()
    {
        return '/storage/' . $this->path;
    }
}
