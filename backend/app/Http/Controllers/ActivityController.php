<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreActivityRequest;
use App\Http\Requests\UpdateActivityRequest;
use App\Models\Activity;
use Illuminate\Http\Request;

class ActivityController extends Controller
{
    public function index(Request $request)
    {
        $query = Activity::with(['user:id,name', 'contact:id,name', 'deal:id,title'])
            ->where('tenant_id', $request->user()->tenant_id);

        if ($request->filled('contact_id')) {
            $query->where('contact_id', $request->contact_id);
        }

        if ($request->filled('deal_id')) {
            $query->where('deal_id', $request->deal_id);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function store(StoreActivityRequest $request)
    {
        $activity = Activity::create(array_merge(
            $request->validated(),
            [
                'tenant_id' => $request->user()->tenant_id,
                'user_id'   => $request->user()->id,
            ]
        ));

        return response()->json($activity->load(['user:id,name', 'contact:id,name', 'deal:id,title']), 201);
    }

    public function show(Activity $activity)
    {
        $this->authorizeTenant($activity);
        return response()->json($activity->load(['user:id,name', 'contact:id,name', 'deal:id,title']));
    }

    public function update(UpdateActivityRequest $request, Activity $activity)
    {
        $this->authorizeTenant($activity);
        $activity->update($request->validated());
        return response()->json($activity->load(['user:id,name', 'contact:id,name', 'deal:id,title']));
    }

    public function destroy(Activity $activity)
    {
        $this->authorizeTenant($activity);
        $activity->delete();
        return response()->json(null, 204);
    }

    private function authorizeTenant(Activity $activity): void
    {
        if ($activity->tenant_id !== auth()->user()->tenant_id) {
            abort(403);
        }
    }
}
