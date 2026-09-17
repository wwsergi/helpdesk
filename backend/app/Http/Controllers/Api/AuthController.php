<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoginLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        // Login auditing is scoped to the internal team (agents/admins) only.
        $isTeamMember = $user && in_array($user->role, ['agent', 'admin']);

        if (!$user || !Hash::check($request->password, $user->password)) {
            if ($isTeamMember) {
                $this->recordLogin($request, $user, 'failed');
            }

            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        // Create token
        $token = $user->createToken('auth-token')->plainTextToken;

        if ($isTeamMember) {
            $this->recordLogin($request, $user, 'success');
        }

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'level' => $user->level,
                'tenant_id' => $user->tenant_id,
            ],
            'token' => $token,
        ]);
    }

    /**
     * Persist a login attempt for an internal team member.
     */
    private function recordLogin(Request $request, User $user, string $status): void
    {
        LoginLog::create([
            'user_id' => $user->id,
            'tenant_id' => $user->tenant_id,
            'email' => $user->email,
            'status' => $status,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully',
        ]);
    }

    public function me(Request $request)
    {
        return response()->json([
            'user' => [
                'id' => $request->user()->id,
                'name' => $request->user()->name,
                'email' => $request->user()->email,
                'role' => $request->user()->role,
                'level' => $request->user()->level,
                'tenant_id' => $request->user()->tenant_id,
            ],
        ]);
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'tenant_id' => 'required|exists:tenants,id',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'tenant_id' => $validated['tenant_id'],
            'role' => 'customer', // Default role
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'tenant_id' => $user->tenant_id,
            ],
            'token' => $token,
        ], 201);
    }
}
