<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;

class AgentController extends Controller
{
    public function index(Request $request)
    {
        $query = User::where('tenant_id', $request->user()->tenant_id)
            ->whereIn('role', ['agent', 'admin']);

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        return response()->json($query->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'role' => 'required|in:agent,admin',
        ]);

        $agent = User::create([
            'tenant_id' => $request->user()->tenant_id,
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
        ]);

        return response()->json($agent, 201);
    }

    public function show(Request $request, $id)
    {
        $agent = User::where('tenant_id', $request->user()->tenant_id)
            ->whereIn('role', ['agent', 'admin'])
            ->findOrFail($id);

        return response()->json($agent);
    }

    public function update(Request $request, $id)
    {
        $agent = User::where('tenant_id', $request->user()->tenant_id)
            ->whereIn('role', ['agent', 'admin'])
            ->findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email,' . $id,
            'password' => ['nullable', 'confirmed', Rules\Password::defaults()],
            'role' => 'required|in:agent,admin',
        ]);

        $updateData = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'role' => $validated['role'],
        ];

        if (!empty($validated['password'])) {
            $updateData['password'] = Hash::make($validated['password']);
        }

        $agent->update($updateData);

        return response()->json($agent);
    }

    public function destroy(Request $request, $id)
    {
        $agent = User::where('tenant_id', $request->user()->tenant_id)
            ->whereIn('role', ['agent', 'admin'])
            ->findOrFail($id);

        // Prevent self-deletion
        if ($agent->id === $request->user()->id) {
            return response()->json(['message' => 'Cannot delete your own account.'], 422);
        }

        // Check if agent has assigned tickets
        if (\App\Models\Ticket::where('user_id', $agent->id)->exists()) {
            return response()->json(['message' => 'Cannot delete agent with assigned tickets. Reassign them first.'], 422);
        }

        $agent->delete();

        return response()->json(['message' => 'Agent deleted successfully']);
    }
}
