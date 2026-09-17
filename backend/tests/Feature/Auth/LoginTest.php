<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use App\Models\User;
use App\Models\Tenant; // Assuming there is a Tenant model
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test successful login.
     *
     * @return void
     */
    public function test_user_can_login_with_valid_credentials()
    {
        // Many systems have a specific Setup, so we'll just try to create a standard user.
        // If Tenant factory exists, we create one, otherwise we might need to handle it.
        // Assuming UserFactory handles tenant_id or we can just bypass it by creating necessary data.

        // We'll create a user with a known password. We'll try just the User factory first.
        $user = User::factory()->create([
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'user' => [
                         'id',
                         'name',
                         'email',
                         'role',
                         'tenant_id',
                     ],
                     'token',
                 ]);
    }

    /**
     * Test login failure with incorrect password.
     *
     * @return void
     */
    public function test_user_cannot_login_with_invalid_credentials()
    {
        $user = User::factory()->create([
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['email']);
    }

    /**
     * Test login validation for missing fields.
     *
     * @return void
     */
    public function test_login_requires_email_and_password()
    {
        $response = $this->postJson('/api/login', []);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['email', 'password']);
    }
}
