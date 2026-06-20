<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class IntratimeService
{
    protected $baseUrl;
    protected $token;

    public function __construct()
    {
        $this->baseUrl = rtrim((string) config('services.intratime.admin_url'), '/');
        $this->token = (string) config('services.intratime.admin_token');
    }

    /**
     * Fetch one page of companies from the Intratime admin API.
     *
     * Endpoint: GET {baseUrl}/api/companies?page=&per_page=
     * Returns the decoded payload { success, message, data[], meta } or null on error.
     */
    public function getCompaniesPage(int $page, int $perPage = 1000): ?array
    {
        try {
            $response = Http::withToken($this->token)
                ->acceptJson()
                ->timeout(60)
                ->retry(2, 1000)
                ->get($this->baseUrl . '/api/companies', [
                    'page' => $page,
                    'per_page' => $perPage,
                ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::error("Intratime API error (page {$page}): {$response->status()} {$response->body()}");
            return null;
        } catch (\Throwable $e) {
            Log::error("Intratime API exception (page {$page}): " . $e->getMessage());
            return null;
        }
    }
}
