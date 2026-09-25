<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;

class AgentController extends Controller
{
    public function index(Request $request)
    {
        $query = User::where('tenant_id', $request->user()->tenant_id)
            ->whereIn('role', ['agent', 'admin'])
            // Los desplegables de asignación y delegación consumen este endpoint,
            // así que por defecto no se ofrece a nadie desactivado. La pantalla de
            // gestión de agentes pide include_inactive=1 para verlos todos.
            ->when(!$request->boolean('include_inactive'), fn ($q) => $q->where('active', true))
            ->withCount([
                'tickets as open_tickets_count' => fn ($q) => $q->whereNotIn('status', self::CLOSED_STATUSES),
                'tickets as total_tickets_count',
            ]);

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
            'level' => 'nullable|integer|in:1,2,3',
        ]);

        $agent = User::create([
            'tenant_id' => $request->user()->tenant_id,
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'level' => $validated['level'] ?? null,
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
            'level' => 'nullable|integer|in:1,2,3',
        ]);

        $updateData = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'role' => $validated['role'],
            'level' => $validated['level'] ?? null,
        ];

        if (!empty($validated['password'])) {
            $updateData['password'] = Hash::make($validated['password']);
        }

        $agent->update($updateData);

        return response()->json($agent);
    }

    /**
     * Login history (success + failed attempts) for a team member. Admin only.
     */
    public function logins(Request $request, $id)
    {
        $agent = User::where('tenant_id', $request->user()->tenant_id)
            ->whereIn('role', ['agent', 'admin'])
            ->findOrFail($id);

        $logs = \App\Models\LoginLog::where('user_id', $agent->id)
            ->orderBy('created_at', 'desc')
            ->paginate(25);

        return response()->json($logs);
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

    /** Un ticket cerrado ya no es de nadie a efectos de carga de trabajo, pero
     *  conserva su agente para el histórico. Se enumeran los cerrados y no los
     *  abiertos a propósito: si mañana aparece un estado nuevo, contará como
     *  abierto, que es el fallo seguro. */
    private const CLOSED_STATUSES = ['RESOLVED', 'CLOSED'];

    /**
     * Desactiva un agente. Sus tickets NO se tocan salvo que se pida
     * explícitamente reasignarlos: se mantienen atribuidos a él para no perder
     * la trazabilidad de quién los llevaba.
     */
    public function deactivate(Request $request, $id)
    {
        $data = $request->validate([
            'reassign_to' => 'nullable|integer|exists:users,id',
        ]);

        $tenantId = $request->user()->tenant_id;

        $agent = User::where('tenant_id', $tenantId)
            ->whereIn('role', ['agent', 'admin'])
            ->findOrFail($id);

        if ($agent->id === $request->user()->id) {
            return response()->json(['message' => 'No puedes desactivar tu propia cuenta.'], 422);
        }

        $reassigned = 0;
        $target = null;

        if (!empty($data['reassign_to'])) {
            $target = User::where('tenant_id', $tenantId)
                ->whereIn('role', ['agent', 'admin'])
                ->where('active', true)
                ->find($data['reassign_to']);

            if (!$target) {
                return response()->json(['message' => 'El agente destino no existe o está desactivado.'], 422);
            }
            if ($target->id === $agent->id) {
                return response()->json(['message' => 'No se puede reasignar un agente a sí mismo.'], 422);
            }
        }

        DB::transaction(function () use ($agent, $target, &$reassigned) {
            if ($target) {
                // Solo los abiertos: los cerrados conservan a su agente para que
                // los informes históricos sigan cuadrando.
                $reassigned = Ticket::where('user_id', $agent->id)
                    ->whereNotIn('status', self::CLOSED_STATUSES)
                    ->update(['user_id' => $target->id]);
            }

            $agent->active = false;
            $agent->save();
        });

        $pending = Ticket::where('user_id', $agent->id)
            ->whereNotIn('status', self::CLOSED_STATUSES)
            ->count();

        return response()->json([
            'message'    => 'Agente desactivado.',
            'reassigned' => $reassigned,
            'reassigned_to' => $target?->name,
            'still_assigned' => $pending,
        ]);
    }

    /** Reactiva un agente. Sus tickets siguen donde estaban. */
    public function activate(Request $request, $id)
    {
        $agent = User::where('tenant_id', $request->user()->tenant_id)
            ->whereIn('role', ['agent', 'admin'])
            ->findOrFail($id);

        $agent->active = true;
        $agent->save();

        return response()->json(['message' => 'Agente reactivado.']);
    }
}
