<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProjectController extends Controller
{
    public function index(Request $request, $contactId)
    {
        $tenantId = $request->user()->tenant_id;

        Contact::where('id', $contactId)->where('tenant_id', $tenantId)->firstOrFail();

        $projects = Project::where('tenant_id', $tenantId)
            ->where('contact_id', $contactId)
            ->with('category:id,name')
            ->orderBy('status')
            ->orderBy('name')
            ->get();

        return response()->json($projects);
    }

    public function store(Request $request, $contactId)
    {
        $tenantId = $request->user()->tenant_id;

        Contact::where('id', $contactId)->where('tenant_id', $tenantId)->firstOrFail();

        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'category_id' => ['nullable', Rule::exists('categories', 'id')->where('tenant_id', $tenantId)],
            'status'      => 'in:active,inactive',
        ]);

        $project = Project::create([
            'tenant_id'   => $tenantId,
            'contact_id'  => $contactId,
            'name'        => $validated['name'],
            'category_id' => $validated['category_id'] ?? null,
            'status'      => $validated['status'] ?? 'active',
        ]);

        return response()->json($project->load('category:id,name'), 201);
    }

    public function update(Request $request, $contactId, $id)
    {
        $tenantId = $request->user()->tenant_id;

        $project = Project::where('id', $id)
            ->where('tenant_id', $tenantId)
            ->where('contact_id', $contactId)
            ->firstOrFail();

        $validated = $request->validate([
            'name'        => 'sometimes|string|max:255',
            'category_id' => ['nullable', Rule::exists('categories', 'id')->where('tenant_id', $tenantId)],
            'status'      => 'sometimes|in:active,inactive',
        ]);

        $project->update($validated);

        return response()->json($project->load('category:id,name'));
    }

    public function destroy(Request $request, $contactId, $id)
    {
        $tenantId = $request->user()->tenant_id;

        $project = Project::where('id', $id)
            ->where('tenant_id', $tenantId)
            ->where('contact_id', $contactId)
            ->firstOrFail();

        $project->delete();

        return response()->json(null, 204);
    }
}
