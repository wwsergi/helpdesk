<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDealRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'contact_id'          => 'sometimes|integer|exists:contacts,id',
            'user_id'             => 'sometimes|nullable|integer|exists:users,id',
            'title'               => 'sometimes|string|max:255',
            'amount'              => 'sometimes|numeric|min:0',
            'stage'               => 'sometimes|string|in:lead,contacted,proposal,negotiation,won,lost',
            'expected_close_date' => 'sometimes|nullable|date',
        ];
    }
}
