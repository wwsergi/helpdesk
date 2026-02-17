<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index(Request $request)
    {
        $categories = Category::with('children.children')
            ->where('tenant_id', $request->user()->tenant_id)
            ->whereNull('parent_id')
            ->orderBy('name')
            ->get();

        return response()->json($categories);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'parent_id' => 'nullable|exists:categories,id',
            'is_active' => 'boolean',
        ]);

        // Optional: Enforce max 3 levels of nesting
        if ($validated['parent_id']) {
            $parent = Category::find($validated['parent_id']);
            $level = 1;
            $curr = $parent;
            while ($curr && $curr->parent_id) {
                $level++;
                $curr = $curr->parent;
            }
            if ($level >= 3) {
                return response()->json(['message' => 'Maximum 3 levels of nesting reached.'], 422);
            }
        }

        $category = Category::create([
            'tenant_id' => $request->user()->tenant_id,
            'name' => $validated['name'],
            'parent_id' => $validated['parent_id'],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json($category, 201);
    }

    public function update(Request $request, $id)
    {
        $category = Category::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'parent_id' => 'nullable|exists:categories,id',
            'is_active' => 'boolean',
        ]);

        // Prevent self-nesting or circular references
        if ($validated['parent_id'] == $id) {
            return response()->json(['message' => 'Cannot set category as its own parent.'], 422);
        }

        $category->update($validated);

        return response()->json($category);
    }

    public function destroy(Request $request, $id)
    {
        $category = Category::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);

        // Soft check: if it has children, maybe prevent deletion?
        if ($category->children()->exists()) {
            return response()->json(['message' => 'Cannot delete category with subcategories.'], 422);
        }

        $category->delete();

        return response()->json(['message' => 'Category deleted successfully']);
    }
}
