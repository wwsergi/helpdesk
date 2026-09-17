<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDealRequest;
use App\Http\Requests\UpdateDealRequest;
use App\Models\Deal;
use Illuminate\Http\Request;

class DealController extends Controller
{
    public function index(Request $request)
    {
        $query = Deal::with(['contact:id,name', 'user:id,name'])
            ->where('tenant_id', $request->user()->tenant_id);

        if ($request->filled('contact_id')) {
            $query->where('contact_id', $request->contact_id);
        }

        if ($request->filled('stage')) {
            $query->where('stage', $request->stage);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function pipeline(Request $request)
    {
        $stages = ['lead', 'contacted', 'proposal', 'negotiation', 'won', 'lost'];

        $deals = Deal::with(['contact:id,name', 'user:id,name'])
            ->where('tenant_id', $request->user()->tenant_id)
            ->whereNull('deleted_at')
            ->get();

        $grouped = collect($stages)->mapWithKeys(fn($stage) => [
            $stage => $deals->where('stage', $stage)->values(),
        ]);

        return response()->json($grouped);
    }

    public function store(StoreDealRequest $request)
    {
        $deal = Deal::create(array_merge(
            $request->validated(),
            ['tenant_id' => $request->user()->tenant_id]
        ));

        return response()->json($deal->load(['contact:id,name', 'user:id,name']), 201);
    }

    public function show(Deal $deal)
    {
        $this->authorizeTenant($deal);
        return response()->json($deal->load(['contact:id,name', 'user:id,name', 'activities']));
    }

    public function update(UpdateDealRequest $request, Deal $deal)
    {
        $this->authorizeTenant($deal);
        $deal->update($request->validated());
        return response()->json($deal->load(['contact:id,name', 'user:id,name']));
    }

    public function destroy(Deal $deal)
    {
        $this->authorizeTenant($deal);
        $deal->delete();
        return response()->json(null, 204);
    }

    private function authorizeTenant(Deal $deal): void
    {
        if ($deal->tenant_id !== auth()->user()->tenant_id) {
            abort(403);
        }
    }
}
