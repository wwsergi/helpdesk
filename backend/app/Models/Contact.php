<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Contact extends Model
{
    use HasFactory;

    protected $fillable = ['tenant_id', 'name', 'contact_person', 'email', 'phone', 'external_id', 'cif', 'subscription_plan', 'max_users', 'billing_mode', 'rate', 'registration_date', 'active', 'distributor_id', 'has_contract', 'contract_type', 'contract_hours_month', 'contract_start_date', 'contract_end_date', 'contract_notes'];

    protected $casts = [
        'has_contract' => 'boolean',
        'active' => 'boolean',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function tickets()
    {
        return $this->hasMany(Ticket::class);
    }
}
