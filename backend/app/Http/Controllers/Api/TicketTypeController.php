<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\TicketType;

class TicketTypeController extends Controller
{
    public function index(Request $request)
    {
        $types = TicketType::where('tenant_id', $request->user()->tenant_id)
            ->withCount('tickets')
            ->get();
        return response()->json($types);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $type = TicketType::create([
            'tenant_id' => $request->user()->tenant_id,
        ] + $validated);

        return response()->json($type, 201);
    }

    public function show($id, Request $request)
    {
        $type = TicketType::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        return response()->json($type);
    }

    public function update(Request $request, $id)
    {
        $type = TicketType::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $type->update($validated);

        return response()->json($type);
    }

    public function destroy($id, Request $request)
    {
        $type = TicketType::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);

        if ($type->tickets()->count() > 0) {
            return response()->json(['message' => 'Cannot delete type with associated tickets'], 400);
        }

        $type->delete();

        return response()->json(null, 204);
    }
}
