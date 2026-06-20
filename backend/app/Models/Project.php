<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    protected $fillable = ['tenant_id', 'contact_id', 'name', 'category_id', 'status'];

    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
