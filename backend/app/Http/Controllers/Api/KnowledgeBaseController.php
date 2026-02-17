<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KnowledgeBaseArticle;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class KnowledgeBaseController extends Controller
{
    public function index(Request $request)
    {
        $query = KnowledgeBaseArticle::with('category')
            ->where('tenant_id', $request->user()->tenant_id);

        if ($request->has('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('content', 'like', "%{$search}%");
            });
        }

        return response()->json($query->orderBy('title')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'category_id' => 'nullable|exists:categories,id',
            'content' => 'required|string',
            'is_published' => 'boolean',
        ]);

        $article = KnowledgeBaseArticle::create([
            'tenant_id' => $request->user()->tenant_id,
            'category_id' => $validated['category_id'],
            'title' => $validated['title'],
            'slug' => Str::slug($validated['title']),
            'content' => $validated['content'],
            'is_published' => $validated['is_published'] ?? true,
        ]);

        return response()->json($article, 201);
    }

    public function show(Request $request, $id)
    {
        $article = KnowledgeBaseArticle::with('category')
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        return response()->json($article);
    }

    public function update(Request $request, $id)
    {
        $article = KnowledgeBaseArticle::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'category_id' => 'nullable|exists:categories,id',
            'content' => 'required|string',
            'is_published' => 'boolean',
        ]);

        $updateData = $validated;
        $updateData['slug'] = Str::slug($validated['title']);

        $article->update($updateData);

        return response()->json($article);
    }

    public function destroy(Request $request, $id)
    {
        $article = KnowledgeBaseArticle::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        $article->delete();

        return response()->json(['message' => 'Article deleted successfully']);
    }
}
