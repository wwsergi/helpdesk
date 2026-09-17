<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDealRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'contact_id'          => 'required|integer|exists:contacts,id',
            'user_id'             => 'nullable|integer|exists:users,id',
            'title'               => 'required|string|max:255',
            'amount'              => 'nullable|numeric|min:0',
            'stage'               => 'nullable|string|in:lead,contacted,proposal,negotiation,won,lost',
            'expected_close_date' => 'nullable|date',
        ];
    }
}
