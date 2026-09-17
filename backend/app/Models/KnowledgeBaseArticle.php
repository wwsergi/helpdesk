<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KnowledgeBaseArticle extends Model
{
    protected $fillable = ['tenant_id', 'category_id', 'ticket_id', 'title', 'slug', 'content', 'solution', 'is_published', 'view_count'];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }
}
