import pdfplumber
import csv

pdf_path = "data/appendix_a_22901.pdf"
csv_path = "data/elementary_capacity.csv"

all_data = []
headers = None

with pdfplumber.open(pdf_path) as pdf:
    for page_idx, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        for table in tables:
            if not table:
                continue
            
            # The first page table contains headers
            if page_idx == 0:
                headers = [h.replace("\n", " ").strip() for h in table[0]]
                start_row = 1
            else:
                start_row = 0
                
            for row in table[start_row:]:
                # Some rows might be empty or footer
                if not row or len(row) < 2 or not row[0]:
                    continue
                # Clean elements
                cleaned_row = [cell.replace("\n", " ").strip() if cell else "" for cell in row]
                all_data.append(cleaned_row)

print(f"Extracted {len(all_data)} school rows from PDF.")
print(f"Headers: {headers}")

with open(csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(headers)
    writer.writerows(all_data)

print(f"Saved extracted capacity data to {csv_path}")
