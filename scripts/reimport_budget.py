"""
Reimport budget data from Excel showroom sheets.
Reads T1-T6 KH (plan) and T1-T3 TH (actual monthly, NOT cumulative) from each showroom sheet.
"""
import sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

XL_PATH = r'E:\ANTIGRAVITY\01_WORKSPACE_LAM_VIEC\projects\THACO_MKT_BUDGET\23042026 THACO AUTO HN - QUẢN TRỊ NGÂN SÁCH MARKETING THÁNG 2026.xlsx'
OUTPUT_PATH = r'E:\ANTIGRAVITY\01_WORKSPACE_LAM_VIEC\projects\THACO_MKT_BUDGET\app\budget_reimport.json'

UNIT_ID = '17f6686e-e201-4967-8b73-a8cedc56d921'
YEAR = 2026

SHOWROOM_MAP = {
    '1. PVĐ':        '0dd0f279-3f37-4245-9521-18d1db29877a',
    '2. Đông Trù':   '0821399e-ddd4-48aa-984d-efde5f51a503',
    '3. NVC':        'bf591d92-3216-421a-94c8-18a50af06340',
    '4. GPhong':     'e147520c-f7a7-4458-acf2-5c58c13a686b',
    '5. BĐ.TKC':    '4d6ce85d-468a-4b90-b7ec-536ec755ac3a',
    '6. Hà Nam':     'eca571ce-d533-482b-8005-efb7e5c121f6',
    '7. Đài Tư.':   'a1af6815-38c4-43f4-bdfc-2de3a19422f1',
    '8. BMW LB':     'fc30fd9f-fd3c-452d-9780-4322fe9d9348',
    '9. SR LVL':     '223fbad9-0fb4-479e-b0c2-17ac80e714a1',
    '10. Chương Mỹ': 'dd7cd396-d88a-41f1-a490-d475c908178e',
    '11.Ninh Bình':  'bd348ebb-930a-41a5-8390-7946552b8c50',
}

# Period bases (0-indexed column): (month, mode) -> base_col
KH_BASES = {1: 3, 2: 77, 3: 151, 4: 225, 5: 299, 6: 373}
TH_BASES = {1: 39, 2: 113, 3: 187}  # T4-T6 TH are cumulative (LŨY KẾ), skip

# Channel: (code, ns_off, khqt_off, gdtd_off, khd_off)
CHANNELS = [
    ('google',        0,  1,  2,  3),
    ('facebook',      6,  7,  8,  9),
    ('digital_other', 12, 13, 14, 15),
    ('su_kien',       22, 23, 24, 25),
    ('cskh',          26, 27, 28, 29),
]

SKIP_BRANDS = {'DVPT XDL', 'DVPT Tải Bus', 'BMW MTR', 'TỔNG CỘNG', 'TỔNG CỘNG (CHƯA VAT)', 'II. LỊCH SỰ KIỆN THÁNG …:'}
SKIP_MODELS = {'Tổng', 'Key Showroom', 'Tổng Tải', 'Tổng Bus', 'Mini Bus', 'Tổng (Chưa VAT)', 'Post'}

# Map QC post chung theo brand → tên model trong DB
QC_MODEL_MAP = {
    'KIA':   'Quảng cáo chung KIA',
    'Mazda': 'Quảng cáo chung Mazda',
    'MAZDA': 'Quảng cáo chung Mazda',
}

def normalize_brand(b):
    if b == 'MAZDA':
        return 'Mazda'
    return b

def normalize_model(m):
    if m is None:
        return None
    m = str(m).strip().replace('\xa0', '').strip()
    if m == 'New Canrival':
        m = 'New Carnival'
    if m in ('Carens ', 'Carens'):
        m = 'Carens'
    if m.startswith('Mazda CX-8'):
        m = 'Mazda CX-8'
    if m.startswith('Mazda CX-5'):
        m = 'Mazda CX-5'
    if m.startswith('Đầu kéo'):
        m = 'Đầu kéo- Tải nặng- Ben nặng'
    return m

def safe_val(v, is_int=False):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return 0
    try:
        f = float(v)
        if is_int:
            return int(round(f))
        return round(f, 2)
    except:
        return 0

def process_sheet(df, showroom_id):
    entries = []
    current_brand = None

    for row_idx in range(9, len(df)):
        row = df.iloc[row_idx]
        c0 = row[0]; c1 = row[1]; c2 = row[2]

        # Detect end of data section
        c0_str = str(c0).strip() if not (isinstance(c0, float) and np.isnan(c0)) else ''
        if c0_str.startswith('II.') or c0_str.startswith('TỔNG CỘNG') or 'LỊCH SỰ KIỆN' in c0_str:
            break

        # Update current brand
        if c0_str and c0_str not in ('nan', ''):
            current_brand = normalize_brand(c0_str)

        if not current_brand or current_brand in SKIP_BRANDS:
            continue

        # Determine model
        c1_str = '' if (isinstance(c1, float) and np.isnan(c1)) else str(c1).strip().replace('\xa0', '')
        c2_str = '' if (isinstance(c2, float) and np.isnan(c2)) else str(c2).strip().replace('\xa0', '')

        if c1_str and c1_str not in ('nan', ''):
            raw_model = c1_str
        elif c2_str and c2_str not in ('nan', ''):
            raw_model = c2_str
        else:
            continue

        # Map QC post chung → tên model chính thức theo brand
        if raw_model == 'QC post chung':
            if current_brand in QC_MODEL_MAP:
                raw_model = QC_MODEL_MAP[current_brand]
            else:
                continue  # brand không hỗ trợ QC post chung

        model = normalize_model(raw_model)
        if not model or model in SKIP_MODELS:
            continue

        # For each period and mode, collect metrics by channel
        row_vals = list(row)

        # Build entries per (month, mode)
        period_data = {}

        for month, base in KH_BASES.items():
            period_data[(month, 'plan')] = base
        for month, base in TH_BASES.items():
            period_data[(month, 'actual')] = base

        # Group by (month): one entry per (showroom, brand, model, channel, year, month)
        month_channel_plan = {}  # (month, channel_code) -> {plan_ns, plan_khqt, ...}
        month_channel_actual = {}  # (month, channel_code) -> {actual_ns, ...}

        for (month, mode), base in period_data.items():
            if base + 29 >= len(row_vals):
                continue
            for ch_code, ns_off, khqt_off, gdtd_off, khd_off in CHANNELS:
                ns   = safe_val(row_vals[base + ns_off], is_int=False)
                khqt = safe_val(row_vals[base + khqt_off], is_int=True)
                gdtd = safe_val(row_vals[base + gdtd_off], is_int=True)
                khd  = safe_val(row_vals[base + khd_off], is_int=True)

                if ns == 0 and khqt == 0 and gdtd == 0 and khd == 0:
                    continue

                key = (month, ch_code)
                if mode == 'plan':
                    month_channel_plan[key] = {'plan_ns': ns, 'plan_khqt': khqt, 'plan_gdtd': gdtd, 'plan_khd': khd}
                else:
                    month_channel_actual[key] = {'actual_ns': ns, 'actual_khqt': khqt, 'actual_gdtd': gdtd, 'actual_khd': khd}

        # Merge plan + actual by (month, channel)
        all_keys = set(month_channel_plan.keys()) | set(month_channel_actual.keys())
        for (month, ch_code) in all_keys:
            plan = month_channel_plan.get((month, ch_code), {})
            actual = month_channel_actual.get((month, ch_code), {})
            entry = {
                'unit_id': UNIT_ID,
                'showroom_id': showroom_id,
                'brand_name': current_brand,
                'model_name': model,
                'channel_code': ch_code,
                'year': YEAR,
                'month': month,
                'plan_ns':   plan.get('plan_ns', 0),
                'plan_khqt': plan.get('plan_khqt', 0),
                'plan_gdtd': plan.get('plan_gdtd', 0),
                'plan_khd':  plan.get('plan_khd', 0),
                'actual_ns':   actual.get('actual_ns', 0),
                'actual_khqt': actual.get('actual_khqt', 0),
                'actual_gdtd': actual.get('actual_gdtd', 0),
                'actual_khd':  actual.get('actual_khd', 0),
            }
            entries.append(entry)

    return entries

def main():
    all_entries = []

    for sheet_name, showroom_id in SHOWROOM_MAP.items():
        print(f'Processing: {sheet_name} -> {showroom_id[:8]}...', file=sys.stderr)
        df = pd.read_excel(XL_PATH, sheet_name=sheet_name, header=None)
        entries = process_sheet(df, showroom_id)
        print(f'  -> {len(entries)} entries', file=sys.stderr)
        all_entries.extend(entries)

    print(f'\nTotal entries: {len(all_entries)}', file=sys.stderr)

    # Verify: sum plan_ns by month
    by_month = {}
    for e in all_entries:
        m = e['month']
        by_month[m] = by_month.get(m, 0) + e['plan_ns']
    for m in sorted(by_month.keys()):
        print(f'  T{m} KH NS: {by_month[m]:.1f}', file=sys.stderr)

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(all_entries, f, ensure_ascii=False, indent=2)

    print(f'\nSaved to {OUTPUT_PATH}', file=sys.stderr)

if __name__ == '__main__':
    main()
