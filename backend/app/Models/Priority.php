<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Priority extends Model
{
    protected $fillable = ['tenant_id', 'name', 'label', 'color', 'sort_order'];

    protected $casts = ['sort_order' => 'integer'];

    public function tickets()
    {
        return $this->hasMany(Ticket::class, 'priority', 'name')
            ->where('tenant_id', $this->tenant_id);
    }
}
