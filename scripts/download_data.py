import os
import urllib.request

DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)

urls = {
    "contact_2026.xlsx": "https://data.ontario.ca/dataset/fb3a7c18-90af-453e-bc0a-a76ecc471862/resource/0576efbc-df5f-4ebb-9379-406cb838c99d/download/public_school_contact_list_may2026_en.xlsx",
    "demographics_24_25.xlsx": "https://data.ontario.ca/dataset/d85f68c5-fcb0-4b4d-aec5-3047db47dcd5/resource/1e604bf9-49c5-49a1-a8b7-297147c771d0/download/new_sif_data_table_2024_25prelim_en_april2026.xlsx",
    "demographics_23_24.xlsx": "https://data.ontario.ca/dataset/d85f68c5-fcb0-4b4d-aec5-3047db47dcd5/resource/f381e1de-3aa8-4ae9-826a-20009a6f4a01/download/new_sif_data_table_2023_24prelim_en_january2026.xlsx",
    "demographics_22_23.xlsx": "https://data.ontario.ca/dataset/d85f68c5-fcb0-4b4d-aec5-3047db47dcd5/resource/f95fc955-b1f0-4a2e-9b7f-cfa6eda37e0b/download/sif_data_table_2022_2023_en.xlsx",
    "enrollment_by_grade_2024_2025.xlsx": "https://data.ontario.ca/dataset/502b8125-e48b-443a-b463-a5b76eda8c25/resource/feb08655-93c2-42c8-a29e-cabd7cf449fd/download/enrolment_by_grade_2024-2025_en.xlsx"
}

def download_file(filename, url):
    path = os.path.join(DATA_DIR, filename)
    if os.path.exists(path):
        print(f"{filename} already exists, skipping.")
        return
    print(f"Downloading {filename} from {url}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            with open(path, 'wb') as out_file:
                out_file.write(response.read())
        print(f"Successfully downloaded {filename}")
    except Exception as e:
        print(f"Error downloading {filename}: {e}")

if __name__ == "__main__":
    for name, url in urls.items():
        download_file(name, url)
