<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Ticket extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'contact_id',
        'user_id',
        'queue_id',
        'category_id',
        'subject',
        'description',
        'status',
        'priority',
        'ticket_type_id',
        'first_response_at',
        'resolved_at',
        'closed_at',
        'sla_first_response_due_at',
        'sla_resolution_due_at',
        'sla_first_response_breached',
        'sla_resolution_breached',
        'metadata',
        'jira_issue_link',
        'parent_ticket_id',
    ];

    protected $casts = [
        'first_response_at' => 'datetime',
        'resolved_at' => 'datetime',
        'closed_at' => 'datetime',
        'sla_first_response_due_at' => 'datetime',
        'sla_resolution_due_at' => 'datetime',
        'metadata' => 'array',
        'sla_first_response_breached' => 'boolean',
        'sla_resolution_breached' => 'boolean',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function queue()
    {
        return $this->belongsTo(Queue::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function messages()
    {
        return $this->hasMany(TicketMessage::class);
    }

    public function parent()
    {
        return $this->belongsTo(Ticket::class, 'parent_ticket_id');
    }

    public function children()
    {
        return $this->hasMany(Ticket::class, 'parent_ticket_id');
    }

    public function ticketType()
    {
        return $this->belongsTo(TicketType::class);
    }
}
