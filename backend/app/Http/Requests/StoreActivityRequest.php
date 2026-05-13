<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreActivityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'contact_id'   => 'nullable|integer|exists:contacts,id',
            'deal_id'      => 'nullable|integer|exists:deals,id',
            'type'         => 'required|string|in:call,email,meeting,note',
            'description'  => 'required|string',
            'due_date'     => 'nullable|date',
            'is_completed' => 'nullable|boolean',
        ];
    }
}
