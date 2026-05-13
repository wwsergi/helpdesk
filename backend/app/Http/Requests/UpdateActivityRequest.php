<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateActivityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'contact_id'   => 'sometimes|nullable|integer|exists:contacts,id',
            'deal_id'      => 'sometimes|nullable|integer|exists:deals,id',
            'type'         => 'sometimes|string|in:call,email,meeting,note',
            'description'  => 'sometimes|string',
            'due_date'     => 'sometimes|nullable|date',
            'is_completed' => 'sometimes|boolean',
        ];
    }
}
