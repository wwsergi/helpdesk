<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TicketMessage extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'ticket_id',
        'user_id',
        'contact_id',
        'body',
        'is_internal',
        'channel_source',
        'email_message_id',
        'email_headers',
    ];

    protected $appends = ['author'];

    protected $casts = [
        'is_internal' => 'boolean',
    ];

    public function getAuthorAttribute()
    {
        return $this->user ?? $this->contact;
    }

    public function ticket()
    {
        return $this->belongsTo(Ticket::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function attachments()
    {
        return $this->hasMany(TicketAttachment::class);
    }
}
