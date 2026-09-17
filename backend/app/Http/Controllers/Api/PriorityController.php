<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Priority;
use Illuminate\Http\Request;

class PriorityController extends Controller
{
    public function index(Request $request)
    {
        $priorities = Priority::where('tenant_id', $request->user()->tenant_id)
            ->orderBy('sort_order')
            ->get();

        return response()->json($priorities);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'       => 'required|string|max:50',
            'label'      => 'required|string|max:100',
            'color'      => 'required|string|regex:/^#[0-9a-fA-F]{6}$/',
            'sort_order' => 'integer|min:0',
        ]);

        $priority = Priority::create([
            'tenant_id' => $request->user()->tenant_id,
        ] + $validated);

        return response()->json($priority, 201);
    }

    public function update(Request $request, $id)
    {
        $priority = Priority::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);

        $validated = $request->validate([
            'name'       => 'sometimes|string|max:50',
            'label'      => 'sometimes|string|max:100',
            'color'      => 'sometimes|string|regex:/^#[0-9a-fA-F]{6}$/',
            'sort_order' => 'integer|min:0',
        ]);

        $priority->update($validated);

        return response()->json($priority);
    }

    public function destroy(Request $request, $id)
    {
        $priority = Priority::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);

        $inUse = \App\Models\Ticket::where('tenant_id', $request->user()->tenant_id)
            ->where('priority', $priority->name)
            ->exists();

        if ($inUse) {
            return response()->json(['message' => 'No se puede eliminar: hay tickets con esta prioridad.'], 400);
        }

        $priority->delete();

        return response()->json(null, 204);
    }
}
