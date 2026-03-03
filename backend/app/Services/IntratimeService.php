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
        $this->baseUrl = config('services.intratime.url', env('INTRATIME_API_URL'));
        $this->token = config('services.intratime.token', env('INTRATIME_API_TOKEN'));
    }

    /**
     * Fetch all companies (customers) from Intratime API.
     * 
     * @return array
     */
    public function getCompanies()
    {
        try {
            $response = Http::withToken($this->token)
                ->acceptJson()
                ->get($this->baseUrl . '/companies');

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('Intratime API Error: ' . $response->body());
            return [];
        } catch (\Exception $e) {
            Log::error('Intratime API Exception: ' . $e->getMessage());
            return [];
        }
    }
}
