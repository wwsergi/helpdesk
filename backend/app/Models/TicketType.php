<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TicketType extends Model
{
    protected $fillable = ['tenant_id', 'name', 'description', 'is_active'];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function tickets()
    {
        return $this->hasMany(Ticket::class);
    }
}
