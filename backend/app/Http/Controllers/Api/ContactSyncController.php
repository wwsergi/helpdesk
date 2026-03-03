<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Services\IntratimeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ContactSyncController extends Controller
{
    protected $intratimeService;

    public function __construct(IntratimeService $intratimeService)
    {
        $this->intratimeService = $intratimeService;
    }

    public function sync(Request $request)
    {
        // Only admins or agents should be allowed
        if ($request->user()->role === 'customer') {
            abort(403, 'Unauthorized');
        }

        $companies = $this->intratimeService->getCompanies();

        if (empty($companies)) {
            return response()->json([
                'message' => 'No companies found or API error.',
                'imported' => 0,
                'updated' => 0,
                'skipped' => 0
            ]);
        }

        $stats = [
            'imported' => 0,
            'updated' => 0,
            'skipped' => 0,
            'errors' => []
        ];

        foreach ($companies as $company) {
            try {
                // Map fields from API response (based on Postman collection billing object structure pattern)
                // Assuming the API returns a list of company objects with billing info
                // If the structure is different (e.g. wrapper), we might need to adjust.
                // Postman shows "billing" object in "Show" response, but "Index" response likely returns array of company objects.
                // Let's assume broad mapping and fallbacks.

                $externalId = $company['BILLING_ID'] ?? $company['id'] ?? null;
                $email = $company['BILLING_MAIL'] ?? $company['email'] ?? null;
                $name = $company['BILLING_NAME'] ?? $company['name'] ?? null;

                if (!$email || !$name) {
                    $stats['skipped']++;
                    continue;
                }

                $contact = Contact::updateOrCreate(
                    [
                        'tenant_id' => $request->user()->tenant_id,
                        'external_id' => $externalId, // Prefer matching by external ID
                    ],
                    [
                        'email' => $email, // If checking by external_id, email can be updated
                        'name' => $name,
                        'phone' => $company['BILLING_TLF'] ?? $company['phone'] ?? null,
                        'cif' => $company['BILLING_NIF'] ?? $company['cif'] ?? null,
                        'subscription_plan' => $company['BILLING_SUBSCRIPTION_PLAN'] ?? null,
                        'max_users' => $company['BILLING_USERS_QUANTITY'] ?? 0,
                        'billing_mode' => $company['BILLING_CYCLE'] ?? null, // e.g., monthly/annual
                        'rate' => $company['BILLING_AMOUNT'] ?? null,
                        'registration_date' => isset($company['BILLING_REGISTER_CREATION_DATE'])
                            ? Carbon::parse($company['BILLING_REGISTER_CREATION_DATE'])->format('Y-m-d')
                            : null,
                    ]
                );

                if ($contact->wasRecentlyCreated) {
                    $stats['imported']++;
                } else {
                    $stats['updated']++;
                }

            } catch (\Exception $e) {
                Log::error("Error syncing company ID {$company['id']}: " . $e->getMessage());
                $stats['errors'][] = "Error with {$company['name']}: " . $e->getMessage();
            }
        }

        return response()->json([
            'message' => 'Sync completed successfully.',
            ...$stats
        ]);
    }
}
