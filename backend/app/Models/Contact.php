<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Contact extends Model
{
    use HasFactory;

    protected $fillable = ['tenant_id', 'name', 'contact_person', 'email', 'phone', 'external_id', 'cif', 'subscription_plan', 'max_users', 'billing_mode', 'rate', 'registration_date', 'active', 'distributor_id'];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function tickets()
    {
        return $this->hasMany(Ticket::class);
    }
}
