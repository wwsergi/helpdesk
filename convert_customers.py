import pandas as pd
import json
import os
from datetime import datetime

# Read Excel file
df = pd.read_excel('customers.xlsx')

# Map columns to DB fields
column_map = {
    'UID': 'external_id',
    'Email': 'email',
    'Nombre': 'name',
    'CIF': 'cif',
    'Suscripción': 'subscription_plan',
    'UMax': 'max_users',
    'Modo Cobro': 'billing_mode',
    'Tarifa': 'rate',
    'Alta': 'registration_date'
}

df = df.rename(columns=column_map)

# Select only relevant columns
relevant_columns = list(column_map.values())
df = df[relevant_columns]

# Convert dates to string format (YYYY-MM-DD)
if 'registration_date' in df.columns:
    df['registration_date'] = pd.to_datetime(df['registration_date'], errors='coerce')
    df = df.dropna(subset=['registration_date']) # Drop rows where date is invalid (like TOTAL row)
    df['registration_date'] = df['registration_date'].dt.strftime('%Y-%m-%d')

# Convert NaN to None (null in JSON)
df = df.where(pd.notnull(df), None)

# Convert to list of dicts
data = df.to_dict(orient='records')

# Ensure output directory exists
output_dir = 'backend/database/seeders'
os.makedirs(output_dir, exist_ok=True)

# Save to JSON
output_file = os.path.join(output_dir, 'customers.json')
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=4, ensure_ascii=False)

print(f"Successfully converted {len(data)} records to {output_file}")
