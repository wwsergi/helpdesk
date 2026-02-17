<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use PhpOffice\PhpSpreadsheet\IOFactory;

class ContactController extends Controller
{
    public function index(Request $request)
    {
        $query = Contact::where('tenant_id', $request->user()->tenant_id);

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
            'email' => 'required|email|max:255|unique:contacts,email,NULL,id,tenant_id,' . $request->user()->tenant_id . '|unique:users,email',
            'phone' => 'nullable|string|max:50',
            'external_id' => 'nullable|string|max:255',
            'password' => ['nullable', 'confirmed', Password::defaults()],
            'cif' => 'nullable|string|max:255',
            'subscription_plan' => 'nullable|string|max:255',
            'max_users' => 'nullable|integer|min:1',
            'billing_mode' => 'nullable|string|max:255',
            'rate' => 'nullable|string|max:255',
            'registration_date' => 'nullable|date',
        ]);

        $contact = Contact::create([
            'tenant_id' => $request->user()->tenant_id,
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'external_id' => $validated['external_id'] ?? null,
            'cif' => $validated['cif'] ?? null,
            'subscription_plan' => $validated['subscription_plan'] ?? null,
            'max_users' => $validated['max_users'] ?? null,
            'billing_mode' => $validated['billing_mode'] ?? null,
            'rate' => $validated['rate'] ?? null,
            'registration_date' => $validated['registration_date'] ?? null,
        ]);

        // Create associated User for login ONLY if password provided
        if (!empty($validated['password'])) {
            User::create([
                'tenant_id' => $request->user()->tenant_id,
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role' => 'customer',
            ]);
        }

        return response()->json($contact, 201);
    }

    public function show(Request $request, $id)
    {
        $contact = Contact::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        return response()->json($contact);
    }

    public function update(Request $request, $id)
    {
        $contact = Contact::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);
        $oldEmail = $contact->email;

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:contacts,email,' . $id . ',id,tenant_id,' . $request->user()->tenant_id . '|unique:users,email,' . $oldEmail . ',email',
            'phone' => 'nullable|string|max:50',
            'external_id' => 'nullable|string|max:255',
            'password' => ['nullable', 'confirmed', Password::defaults()],
            'cif' => 'nullable|string|max:255',
            'subscription_plan' => 'nullable|string|max:255',
            'max_users' => 'nullable|integer|min:1',
            'billing_mode' => 'nullable|string|max:255',
            'rate' => 'nullable|string|max:255',
            'registration_date' => 'nullable|date',
        ]);

        $contact->update([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'external_id' => $validated['external_id'] ?? null,
            'cif' => $validated['cif'] ?? null,
            'subscription_plan' => $validated['subscription_plan'] ?? null,
            'max_users' => $validated['max_users'] ?? null,
            'billing_mode' => $validated['billing_mode'] ?? null,
            'rate' => $validated['rate'] ?? null,
            'registration_date' => $validated['registration_date'] ?? null,
        ]);

        // Update associated User logic
        if (!empty($validated['password'])) {
            // If password provided, we need to ensure User exists or create it
            User::updateOrCreate(
                ['email' => $oldEmail, 'role' => 'customer'], // Search by OLD email
                [
                    'tenant_id' => $request->user()->tenant_id,
                    'name' => $validated['name'],
                    'email' => $validated['email'], // Update to NEW email
                    'password' => Hash::make($validated['password']),
                ]
            );
        } elseif ($validated['email'] !== $oldEmail) {
            // If email changed but password NOT provided, just update email on existing user
            $user = User::where('email', $oldEmail)->where('role', 'customer')->first();
            if ($user) {
                $user->update([
                    'name' => $validated['name'],
                    'email' => $validated['email'],
                ]);
            }
        }

        return response()->json($contact);
    }

    public function destroy(Request $request, $id)
    {
        $contact = Contact::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);

        // Prevent deletion if contact has tickets
        if ($contact->tickets()->exists()) {
            return response()->json(['message' => 'Cannot delete customer with existing tickets.'], 422);
        }

        // Delete associated User first (or after, doesn't strictly matter if no Foreign Key constraint blocks it)
        User::where('email', $contact->email)->where('role', 'customer')->delete();
        $contact->delete();

        return response()->json(['message' => 'Customer deleted successfully']);
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // 10MB max
        ]);

        try {
            $file = $request->file('file');
            $spreadsheet = IOFactory::load($file->getPathname());
            $sheet = $spreadsheet->getActiveSheet();
            $rows = $sheet->toArray();

            // Skip header row
            $header = array_shift($rows);

            $imported = 0;
            $updated = 0;
            $skipped = 0;
            $errors = [];

            foreach ($rows as $index => $row) {
                // Skip empty rows
                if (empty(array_filter($row))) {
                    continue;
                }

                // Map columns based on actual Excel structure:
                // [0]=Alta(Date) [1]=UID(External ID) [2]=Email [3]=Nombre(Name) [4]=CIF
                // [5]=Suscripción(Plan) [6]=UMax(Max Users) [7]=Modo Cobro(Billing) [8]=Tarifa(Rate)
                $data = [
                    'name' => $row[3] ?? null,  // Column 3: Nombre
                    'email' => $row[2] ?? null,  // Column 2: Email
                    'phone' => null,  // Not in Excel file
                    'external_id' => $row[1] ?? null,  // Column 1: UID
                    'cif' => $row[4] ?? null,  // Column 4: CIF
                    'subscription_plan' => $row[5] ?? null,  // Column 5: Suscripción
                    'max_users' => !empty($row[6]) ? (int) $row[6] : null,  // Column 6: UMax
                    'billing_mode' => $row[7] ?? null,  // Column 7: Modo Cobro
                    'rate' => $row[8] ?? null,  // Column 8: Tarifa
                    'registration_date' => !empty($row[0]) ? date('Y-m-d', strtotime($row[0])) : null,  // Column 0: Alta
                ];

                // Validate required fields
                if (empty($data['name']) || empty($data['email'])) {
                    $errors[] = "Row " . ($index + 2) . ": Missing required fields (name or email)";
                    continue;
                }

                // Check if contact exists (update) or create new
                $contact = Contact::where('tenant_id', $request->user()->tenant_id)
                    ->where('email', $data['email'])
                    ->first();

                if ($contact) {
                    // Check if any data has actually changed
                    $hasChanges = false;
                    foreach ($data as $key => $value) {
                        // Compare values, treating null and empty string as equivalent
                        $oldValue = $contact->{$key};
                        $newValue = $value;

                        if ($oldValue != $newValue && !($oldValue === null && $newValue === '') && !($oldValue === '' && $newValue === null)) {
                            $hasChanges = true;
                            break;
                        }
                    }

                    // Only update if there are actual changes
                    if ($hasChanges) {
                        $contact->update($data);
                        $updated++;
                    } else {
                        $skipped++;
                    }
                } else {
                    Contact::create(array_merge($data, [
                        'tenant_id' => $request->user()->tenant_id,
                    ]));
                    $imported++;
                }
            }

            return response()->json([
                'message' => 'Import completed successfully',
                'imported' => $imported,
                'updated' => $updated,
                'skipped' => $skipped,
                'errors' => $errors,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Import failed: ' . $e->getMessage(),
            ], 500);
        }
    }
}
