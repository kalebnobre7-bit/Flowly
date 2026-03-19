#!/usr/bin/env python3
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

CONFIG_PATHS = [
    Path('/home/cupincha/.openclaw/flowly.env'),
    Path('/home/cupincha/.openclaw/workspace/.flowly.env'),
]


def load_env_file(path: Path):
    if not path.exists():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())


def load_config():
    for p in CONFIG_PATHS:
        load_env_file(p)
    base = os.environ.get('FLOWLY_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
    key = os.environ.get('FLOWLY_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not base or not key:
        raise SystemExit('Missing FLOWLY_SUPABASE_URL/FLOWLY_SERVICE_ROLE_KEY')
    return base.rstrip('/'), key


def request(method, path, body=None, extra_headers=None):
    base, key = load_config()
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Accept-Profile': 'public',
    }
    if extra_headers:
        headers.update(extra_headers)
    data = None if body is None else json.dumps(body).encode('utf-8')
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read().decode('utf-8', 'replace')


def infer_user_id():
    query = urllib.parse.urlencode({'select': 'user_id', 'limit': '1'})
    _, body = request('GET', f'/rest/v1/tasks?{query}')
    rows = json.loads(body)
    if not rows:
        raise SystemExit('Could not infer user_id from tasks; pass explicit user_id in JSON payload')
    return rows[0]['user_id']


def ensure_date(value):
    if not value:
        return datetime.now().strftime('%Y-%m-%d')
    return value[:10]


def cmd_import_json(path):
    payload = json.loads(Path(path).read_text(encoding='utf-8'))
    user_id = payload.get('user_id') or infer_user_id()
    settings = payload.get('settings') or {}
    transactions = payload.get('transactions') or []
    import_row = payload.get('import') or {}

    if settings:
        request('POST', '/rest/v1/finance_settings', {
            'user_id': user_id,
            'monthly_goal': settings.get('monthly_goal', 10000),
            'default_income_category': settings.get('default_income_category', 'Receita'),
            'default_expense_category': settings.get('default_expense_category', 'Operacional'),
            'updated_at': datetime.utcnow().isoformat() + 'Z',
        }, {'Prefer': 'resolution=merge-duplicates,return=representation'})

    tx_rows = []
    for item in transactions:
        tx_rows.append({
            'id': item.get('id') or f"txn_{int(datetime.utcnow().timestamp() * 1000)}_{len(tx_rows)}",
            'user_id': user_id,
            'entry_type': item.get('type', 'income'),
            'amount': item.get('amount', 0),
            'description': item.get('description', ''),
            'category': item.get('category', 'Geral'),
            'occurred_on': ensure_date(item.get('date')),
            'source': item.get('source', 'sexta-import'),
            'task_supabase_id': item.get('task_supabase_id'),
            'task_text': item.get('task_text'),
            'notes': item.get('notes'),
            'metadata': item.get('metadata') or {},
            'created_at': item.get('created_at') or (datetime.utcnow().isoformat() + 'Z'),
            'updated_at': datetime.utcnow().isoformat() + 'Z',
        })
    if tx_rows:
        request('POST', '/rest/v1/finance_transactions', tx_rows, {'Prefer': 'resolution=merge-duplicates,return=representation'})

    if import_row:
        row = {
            'id': import_row.get('id') or f"import_{int(datetime.utcnow().timestamp() * 1000)}",
            'user_id': user_id,
            'source': import_row.get('source', 'sexta'),
            'status': import_row.get('status', 'processed'),
            'summary': import_row.get('summary', 'Importação registrada pela Sexta'),
            'transaction_count': import_row.get('transaction_count', len(tx_rows)),
            'metadata': import_row.get('metadata') or {},
            'imported_at': import_row.get('imported_at') or (datetime.utcnow().isoformat() + 'Z'),
            'updated_at': datetime.utcnow().isoformat() + 'Z',
        }
        request('POST', '/rest/v1/finance_imports', row, {'Prefer': 'resolution=merge-duplicates,return=representation'})

    print(json.dumps({'ok': True, 'user_id': user_id, 'transactions': len(tx_rows)}, ensure_ascii=False))


def cmd_month(month=None):
    month = month or datetime.now().strftime('%Y-%m')
    query = urllib.parse.urlencode({
        'select': 'id,entry_type,amount,description,category,occurred_on,source,task_text',
        'occurred_on': f'gte.{month}-01',
        'order': 'occurred_on.desc',
        'limit': '200'
    })
    _, body = request('GET', f'/rest/v1/finance_transactions?{query}')
    print(body)


def main():
    if len(sys.argv) < 2:
        raise SystemExit('usage: flowly_finance.py <import-json|month> [arg]')
    cmd = sys.argv[1]
    if cmd == 'import-json':
        if len(sys.argv) < 3:
            raise SystemExit('usage: flowly_finance.py import-json <payload.json>')
        cmd_import_json(sys.argv[2])
    elif cmd == 'month':
        cmd_month(sys.argv[2] if len(sys.argv) > 2 else None)
    else:
        raise SystemExit(f'unknown command: {cmd}')


if __name__ == '__main__':
    main()
