import pandas as pd
import numpy as np
import json
import re
import os

# Define paths
DATA_DIR = "data"
CONTACT_PATH = os.path.join(DATA_DIR, "contact_2026.xlsx")
DEMO_24_PATH = os.path.join(DATA_DIR, "demographics_24_25.xlsx")
DEMO_23_PATH = os.path.join(DATA_DIR, "demographics_23_24.xlsx")
DEMO_22_PATH = os.path.join(DATA_DIR, "demographics_22_23.xlsx")
FSL_PATH = os.path.join(DATA_DIR, "fsl_programs.xlsx")
CAP_PATH = os.path.join(DATA_DIR, "elementary_capacity.csv")
OUTPUT_PATH = os.path.join(DATA_DIR, "schools_data.json")

def normalize_name(name):
    if not isinstance(name, str):
        return ''
    name = name.lower()
    name = re.sub(r'[^a-z0-9]', ' ', name)
    name = re.sub(r'\b(public|elementary|secondary|high|school|collegiate|institute|ci|ps|hs|es|c\s*i|p\s*s|h\s*s|e\s*s)\b', '', name)
    name = ' '.join(name.split())
    return name

# Manual mappings from capacity school names (normalized) to OnSIS school numbers
# Note: we found these in checking:
#   671207: Crystal Bay Centre for Special
#   294012: East Urban Centre (Elementary) School
#   197211: Fisher Park/Summit AS Public School
NAME_TO_NUMBER_MAPPING = {
    normalize_name("crystal bay centre for special education"): "671207",
    normalize_name("east urban community"): "294012",
    normalize_name("fisher park public school/summit alternative school"): "197211"
}

def clean_percentage_col(df, col):
    """Convert percentage columns to numeric, mapping non-numeric values to NaN."""
    if col not in df.columns:
        return pd.Series(np.nan, index=df.index)
    
    vals = df[col].copy()
    # Map typical strings to NaN
    vals = vals.replace(['N/D', 'N/R', 'SP', 'N/A', 'nan'], np.nan)
    numeric_vals = pd.to_numeric(vals, errors='coerce')
    # If the column was already values in range [0, 100], divide by 100.
    # OnSIS uses float range [0.0, 1.0] for demographics and EQAO usually, let's verify.
    # Let's write code that maps values > 1.0 down if needed, but normally they are already decimals in OnSIS.
    # In demographics_24_25, we saw 0.67 representing 67%. So they are indeed decimals [0, 1.0].
    # But let's make sure that if a value is > 1.0, we keep it or divide it.
    # In some tables, they might be listed as 67.0. Let's handle it gracefully:
    # If the max value is > 1.0, divide by 100 to make it 0.0 - 1.0.
    if numeric_vals.max() > 1.0:
        numeric_vals = numeric_vals / 100.0
    return numeric_vals

def process():
    print("Loading datasets...")
    df_contact = pd.read_excel(CONTACT_PATH)
    df_demo_24 = pd.read_excel(DEMO_24_PATH)
    df_demo_23 = pd.read_excel(DEMO_23_PATH)
    df_demo_22 = pd.read_excel(DEMO_22_PATH)
    df_fsl = pd.read_excel(FSL_PATH)
    df_cap = pd.read_csv(CAP_PATH)
    
    # Filter for OCDSB (B66184)
    print("Filtering for Ottawa-Carleton District School Board...")
    df_contact = df_contact[df_contact['Board Number'] == 'B66184'].copy()
    df_demo_24 = df_demo_24[df_demo_24['Board Number'] == 'B66184'].copy()
    df_demo_23 = df_demo_23[df_demo_23['Board Number'] == 'B66184'].copy()
    df_demo_22 = df_demo_22[df_demo_22['Board Number'] == 'B66184'].copy()
    df_fsl = df_fsl[df_fsl['Board Number'] == 'B66184'].copy()
    
    # Convert school numbers to string for joining
    df_contact['School Number'] = df_contact['School Number'].astype(str).str.strip()
    df_demo_24['School Number'] = df_demo_24['School Number'].astype(str).str.strip()
    df_demo_23['School Number'] = df_demo_23['School Number'].astype(str).str.strip()
    df_demo_22['School Number'] = df_demo_22['School Number'].astype(str).str.strip()
    df_fsl['School Number'] = df_fsl['School Number'].astype(str).str.strip()
    
    # Map capacity names to school numbers
    # We will build a mapping of normalized school names to school numbers from demographics_24_25
    demo_name_map = {}
    for _, r in df_demo_24.iterrows():
        norm = normalize_name(r['School Name'])
        demo_name_map[norm] = r['School Number']
        
    df_cap['School Number'] = None
    matched_count = 0
    for idx, r in df_cap.iterrows():
        norm = normalize_name(r['School'])
        # Try manual mapping first
        if norm in NAME_TO_NUMBER_MAPPING:
            df_cap.at[idx, 'School Number'] = NAME_TO_NUMBER_MAPPING[norm]
            matched_count += 1
        elif norm in demo_name_map:
            df_cap.at[idx, 'School Number'] = demo_name_map[norm]
            matched_count += 1
        else:
            print(f"Warning: Could not match capacity school: '{r['School']}' (normalized: '{norm}')")
            
    print(f"Matched {matched_count} out of {len(df_cap)} capacity schools.")
    
    # Standardize columns to convert to float/numeric
    eqao_columns = [
        ('gr3_reading', 'Percentage of Grade 3 Students Achieving the Provincial Standard in Reading'),
        ('gr3_writing', 'Percentage of Grade 3 Students Achieving the Provincial Standard in Writing'),
        ('gr3_math', 'Percentage of Grade 3 Students Achieving the Provincial Standard in Mathematics'),
        ('gr6_reading', 'Percentage of Grade 6 Students Achieving the Provincial Standard in Reading'),
        ('gr6_writing', 'Percentage of Grade 6 Students Achieving the Provincial Standard in Writing'),
        ('gr6_math', 'Percentage of Grade 6 Students Achieving the Provincial Standard in Mathematics'),
        ('gr9_math', 'Percentage of Grade 9 Students Achieving the Provincial Standard in Mathematics'),
        ('osslt', 'Percentage of Students That Passed the Grade 10 OSSLT on Their First Attempt')
    ]
    
    demo_columns = [
        ('low_income_pct', 'Percentage of School-Aged Children Who Live in Low-Income Households'),
        ('parents_no_degree_pct', 'Percentage of Students Whose Parents Have No Degree, Diploma or Certificate'),
        ('special_ed_pct', 'Percentage of Students Receiving Special Education Services'),
        ('gifted_pct', 'Percentage of Students Identified as Gifted'),
        ('ell_pct', 'Percentage of Students Whose First Language Is Not English'),
        ('newcomer_pct', 'Percentage of Students Who Are New to Canada from a Non-English Speaking Country')
    ]
    
    # Process EQAO averages over 22-23, 23-24, 24-25
    print("Processing EQAO scores over 3 years...")
    eqao_data = {}
    for col_key, original_col in eqao_columns:
        # Convert each year to numeric
        s_24 = clean_percentage_col(df_demo_24, original_col)
        s_23 = clean_percentage_col(df_demo_23, original_col)
        s_22 = clean_percentage_col(df_demo_22, original_col)
        
        # Create a dataframe to compute row averages
        temp_df = pd.DataFrame({
            'School Number': df_demo_24['School Number'],
            'val_24': s_24,
            'val_23': s_23,
            'val_22': s_22
        })
        
        # Calculate mean ignoring NaN
        temp_df['mean_val'] = temp_df[['val_24', 'val_23', 'val_22']].mean(axis=1)
        
        # Map back to a dict of school number -> average
        for _, r in temp_df.iterrows():
            sn = r['School Number']
            if sn not in eqao_data:
                eqao_data[sn] = {}
            val = r['mean_val']
            eqao_data[sn][col_key] = float(val) if not pd.isna(val) else None
            
    # Process demographics for 24-25
    print("Processing demographics...")
    demo_data = {}
    for col_key, original_col in demo_columns:
        s_24 = clean_percentage_col(df_demo_24, original_col)
        temp_df = pd.DataFrame({
            'School Number': df_demo_24['School Number'],
            'val_24': s_24
        })
        for _, r in temp_df.iterrows():
            sn = r['School Number']
            if sn not in demo_data:
                demo_data[sn] = {}
            val = r['val_24']
            demo_data[sn][col_key] = float(val) if not pd.isna(val) else None
            
    # FSL Programs map
    print("Processing French Second Language (FSL) programs...")
    fsl_programs_map = {}
    for _, r in df_fsl.iterrows():
        sn = r['School Number']
        progs = []
        if r.get('FSL Core') == 'YES':
            progs.append('Core French')
        if r.get('FSL Extended') == 'YES':
            progs.append('Extended French')
        if r.get('FSL Immersion') == 'YES':
            progs.append('French Immersion')
        fsl_programs_map[sn] = progs
        
    # Capacity map
    print("Processing capacity data...")
    capacity_map = {}
    for _, r in df_cap.iterrows():
        sn = r['School Number']
        if not sn:
            continue
            
        try:
            otg = int(float(r['Capacity'])) if not pd.isna(r['Capacity']) else None
        except Exception:
            otg = None
            
        try:
            enr23 = int(float(r["Oct '23* Enrolment"])) if not pd.isna(r["Oct '23* Enrolment"]) else None
        except Exception:
            enr23 = None
            
        try:
            uf_str = str(r["Oct '23 UF (%)"]).replace('%', '').strip()
            uf = float(uf_str) / 100.0 if uf_str else None
        except Exception:
            uf = None
            
        capacity_map[sn] = {
            'otg_capacity': otg,
            'enrolment_oct23': enr23,
            'utilization_rate_pct': uf
        }
        
    # Build final combined school JSON
    print("Building final school objects...")
    schools = []
    
    # We use df_demo_24 as the main list of schools since it covers both levels
    for _, r in df_demo_24.iterrows():
        sn = r['School Number']
        name = r['School Name']
        level = r['School Level']
        
        # Get contact info from contact dataset if available, else from demo
        contact_row = df_contact[df_contact['School Number'] == sn]
        if not contact_row.empty:
            c = contact_row.iloc[0]
            address = str(c.get('Street', '')).strip()
            city = str(c.get('City', '')).strip()
            postal_code = str(c.get('Postal Code', '')).strip()
            phone = str(c.get('Phone', '')).strip()
            website = str(c.get('Website', '')).strip()
            email = str(c.get('Email', '')).strip()
            grade_range = str(c.get('Grade Range', '')).strip()
            date_open = str(c.get('Date Open', ''))
        else:
            address = str(r.get('Street', '')).strip()
            city = str(r.get('City', '')).strip()
            postal_code = str(r.get('Postal Code', '')).strip()
            phone = str(r.get('Phone Number', '')).strip()
            website = str(r.get('School Website', '')).strip()
            email = ''
            grade_range = str(r.get('Grade Range', '')).strip()
            date_open = ''
            
        enrolment = None
        try:
            enrol_str = str(r.get('Enrolment', ''))
            if enrol_str not in ['SP', 'N/D', 'N/R', 'nan', '']:
                enrolment = int(float(enrol_str))
        except Exception:
            pass
            
        lat = float(r['Latitude']) if not pd.isna(r['Latitude']) else None
        lng = float(r['Longitude']) if not pd.isna(r['Longitude']) else None
        
        # Get FSL, demographics, capacity, eqao
        fsl = fsl_programs_map.get(sn, [])
        # If capacity data lists programs, let's merge or use that for elementary
        cap_info = capacity_map.get(sn)
        if cap_info is None and level == 'Elementary' and not pd.isna(r.get('School Name')):
            # check if it exists by normalized name in capacity sheet
            norm_name = normalize_name(name)
            for _, cap_row in df_cap.iterrows():
                if normalize_name(cap_row['School']) == norm_name:
                    # found
                    try:
                        otg = int(float(cap_row['Capacity'])) if not pd.isna(cap_row['Capacity']) else None
                        enr23 = int(float(cap_row["Oct '23* Enrolment"])) if not pd.isna(cap_row["Oct '23* Enrolment"]) else None
                        uf_str = str(cap_row["Oct '23 UF (%)"]).replace('%', '').strip()
                        uf = float(uf_str) / 100.0 if uf_str else None
                        cap_info = {
                            'otg_capacity': otg,
                            'enrolment_oct23': enr23,
                            'utilization_rate_pct': uf
                        }
                    except Exception:
                        pass
                    break
                    
        school_demo = demo_data.get(sn, {k: None for k, _ in demo_columns})
        school_eqao = eqao_data.get(sn, {k: None for k, _ in eqao_columns})
        
        # Calculate academic average from EQAO scores
        eqao_scores = [v for k, v in school_eqao.items() if v is not None]
        academic_average = float(np.mean(eqao_scores)) if eqao_scores else None
        school_eqao['academic_average'] = academic_average
        
        school_obj = {
            'school_number': sn,
            'school_name': name,
            'level': level,
            'address': address,
            'city': city,
            'postal_code': postal_code,
            'latitude': lat,
            'longitude': lng,
            'phone': phone,
            'email': email,
            'website': website,
            'grade_range': grade_range,
            'date_open': date_open,
            'enrolment': enrolment,
            'fsl_programs': fsl,
            'demographics': school_demo,
            'capacity': cap_info,
            'eqao': school_eqao
        }
        schools.append(school_obj)
        
    print(f"Processed {len(schools)} schools total.")
    
    def sanitize_data(obj):
        if isinstance(obj, dict):
            return {k: sanitize_data(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [sanitize_data(v) for v in obj]
        elif isinstance(obj, float):
            if np.isnan(obj) or np.isinf(obj):
                return None
            return obj
        return obj

    sanitized_schools = sanitize_data(schools)
    
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(sanitized_schools, f, indent=2)
    print(f"Exported processed data to {OUTPUT_PATH}")

if __name__ == "__main__":
    process()
