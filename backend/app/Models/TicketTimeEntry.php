<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TicketTimeEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_id',
        'agent_id',
        'description',
        'assistance_type',
        'date',
        'duration_minutes',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function ticket()
    {
        return $this->belongsTo(Ticket::class);
    }

    public function agent()
    {
        return $this->belongsTo(User::class, 'agent_id');
    }
}
