import os
import re
import json
import urllib.request
import pdfplumber

DATA_DIR = "data"
PDF_PATH = os.path.join(DATA_DIR, "AdjFactors2026.pdf")
JSON_PATH = os.path.join(DATA_DIR, "waterloo_af.json")
PDF_URL = "https://github.com/jdabtieu/Waterloo-Adjustment-Factors/raw/main/AdjFactors2026.pdf"

# List of Ottawa-area municipalities we want to match
OTTAWA_CITIES = {
    "ottawa", "nepean", "kanata", "orleans", "gloucester", 
    "stittsville", "metcalfe", "richmond", "dunrobin"
}

def download_pdf():
    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.exists(PDF_PATH):
        print(f"{PDF_PATH} already exists.")
        return
    print(f"Downloading Waterloo adjustment factors PDF from {PDF_URL}...")
    try:
        req = urllib.request.Request(PDF_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            with open(PDF_PATH, 'wb') as out_file:
                out_file.write(response.read())
        print("Successfully downloaded PDF.")
    except Exception as e:
        print(f"Error downloading PDF: {e}")

def parse_pdf():
    if not os.path.exists(PDF_PATH):
        print(f"PDF file not found at {PDF_PATH}")
        return {}

    schools_data = []
    default_factor = 14.1 # Historical default value

    print("Parsing Waterloo Adjustment Factors PDF...")
    with pdfplumber.open(PDF_PATH) as pdf:
        # Page 1 contains Ontario schools
        page1 = pdf.pages[0]
        text = page1.extract_text()
        
        # Look for default value in text
        default_match = re.search(r'default value of -?(\d+\.\d+) is used', text)
        if default_match:
            default_factor = float(default_match.group(1))
            print(f"Parsed default adjustment factor: {default_factor}%")

        lines = text.split("\n") if text else []
        
        # Regex to parse rows: Org ID, Name, City, Factor
        # e.g., "20048757 Bell High School NEPEAN -9.2"
        # Handles potential side text joined at the end
        pattern = re.compile(r'^(\d{8})\s+(.+?)\s+([A-Z\s]+?)\s+(-?\d+\.\d+)(?:\s|$)')
        
        for line in lines:
            match = pattern.match(line.strip())
            if match:
                org_id = match.group(1)
                name = match.group(2).strip()
                city = match.group(3).strip()
                factor = abs(float(match.group(4))) # Keep as positive number e.g. 9.2
                
                # Check if it's an Ottawa-area city
                if city.lower() in OTTAWA_CITIES:
                    schools_data.append({
                        "org_id": org_id,
                        "school_name": name,
                        "city": city.title(),
                        "factor": factor,
                        "is_default": False
                    })
                    print(f"Found Ottawa School: {name} ({city.title()}) -> {factor}%")

    output_data = {
        "default_factor": default_factor,
        "schools": schools_data
    }

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
    print(f"Saved parsed Waterloo AF data to {JSON_PATH}")

if __name__ == "__main__":
    download_pdf()
    parse_pdf()
