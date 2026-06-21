import json
import re
from html.parser import HTMLParser

# Paths
SCHOOLS_JSON = "data/schools_data.json"

class BoundaryParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.documents = []
        self.document_depth = 0
        self.in_h2 = False
        self.in_strong = False
        self.current_doc = None
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'div':
            if attrs_dict.get('class') == 'document':
                self.document_depth = 1
                self.current_doc = {'title': '', 'link': '', 'school_strong': ''}
            elif self.document_depth > 0:
                self.document_depth += 1
        elif self.document_depth > 0:
            if tag == 'h2':
                self.in_h2 = True
            elif tag == 'a' and attrs_dict.get('class') == 'download':
                self.current_doc['link'] = attrs_dict.get('href', '')
            elif tag == 'strong':
                self.in_strong = True
                
    def handle_endtag(self, tag):
        if tag == 'div' and self.document_depth > 0:
            self.document_depth -= 1
            if self.document_depth == 0:
                self.current_doc['title'] = ' '.join(self.current_doc['title'].split())
                self.current_doc['school_strong'] = ' '.join(self.current_doc['school_strong'].split())
                self.documents.append(self.current_doc)
        elif self.document_depth > 0:
            if tag == 'h2':
                self.in_h2 = False
            elif tag == 'strong':
                self.in_strong = False
                
    def handle_data(self, data):
        if self.document_depth > 0:
            if self.in_h2:
                self.current_doc['title'] += data
            elif self.in_strong:
                self.current_doc['school_strong'] += data

def normalize_name(name):
    if not isinstance(name, str):
        return ''
    name = name.lower()
    name = re.sub(r'[^a-z0-9]', ' ', name)
    # Remove common school designations
    name = re.sub(r'\b(public|elementary|secondary|high|school|collegiate|institute|ci|ps|hs|es|c\s*i|p\s*s|h\s*s|e\s*s)\b', '', name)
    name = ' '.join(name.split())
    return name

def main():
    # 1. Load schools data
    print("Loading schools_data.json...")
    with open(SCHOOLS_JSON, 'r', encoding='utf-8') as f:
        schools = json.load(f)
        
    # Build maps lookup
    school_map = {}
    for s in schools:
        norm = normalize_name(s['school_name'])
        s['boundary_maps'] = [] # initialize empty list
        school_map[norm] = s

    # 2. Parse Elementary HTML pages
    all_elem_docs = []
    for p in range(1, 5):
        path = f"data/elementary_boundary_p{p}.html"
        print(f"Parsing elementary boundaries from {path}...")
        with open(path, 'r', encoding='utf-8') as f:
            elem_html = f.read()
        elem_parser = BoundaryParser()
        elem_parser.feed(elem_html)
        print(f"Found {len(elem_parser.documents)} elementary document links on page {p}.")
        all_elem_docs.extend(elem_parser.documents)

    # 3. Parse Secondary HTML pages
    all_sec_docs = []
    path = "data/secondary_boundary_p1.html"
    print(f"Parsing secondary boundaries from {path}...")
    with open(path, 'r', encoding='utf-8') as f:
        sec_html = f.read()
    sec_parser = BoundaryParser()
    sec_parser.feed(sec_html)
    print(f"Found {len(sec_parser.documents)} secondary document links.")
    all_sec_docs.extend(sec_parser.documents)

    # Combined documents
    all_docs = all_elem_docs + all_sec_docs
    matched_count = 0
    unmatched_schools = {}

    for doc in all_docs:
        title = doc['title']
        link = doc['link']
        strong_name = doc['school_strong']
        
        # Clean URL if it's relative
        if link.startswith('/'):
            link = "https://www.ocdsb.ca" + link
            
        # Try matching by strong_name first, then extract name from title if strong_name is empty
        source_name = strong_name if strong_name else title.split('-')[0].strip()
        norm_source = normalize_name(source_name)
        
        # Manual mapping exceptions
        if "ay jackson" in norm_source:
            norm_source = "a y jackson"
        elif "summit alternative" in norm_source:
            norm_source = "fisher park summit as"
        
        # Exact/normalize match
        match_school = school_map.get(norm_source)
        
        # Fallback partial matching if exact normalize match fails
        if not match_school:
            # Let's search if any normalized source name is contained in normalized school names
            for norm_key, school_obj in school_map.items():
                if norm_source and (norm_source in norm_key or norm_key in norm_source):
                    match_school = school_obj
                    break
                    
        if match_school:
            # Clean title name by removing school prefix
            clean_title = title
            # e.g., "A.Lorne Cassidy Elementary School - JK To 6 English Program..." -> "JK To 6 English Program..."
            # Remove school name prefix
            prefix_pattern = re.compile(re.escape(match_school['school_name']), re.IGNORECASE)
            clean_title = prefix_pattern.sub('', clean_title).strip()
            # Also clean leading hyphens, spaces, "Attendance Boundary"
            clean_title = re.sub(r'^[\s\-\:]+', '', clean_title)
            clean_title = re.sub(r'\s+Attendance\s+Boundary$', '', clean_title, flags=re.IGNORECASE)
            
            match_school['boundary_maps'].append({
                'title': clean_title if clean_title else "Boundary Map",
                'url': link
            })
            matched_count += 1
        else:
            unmatched_schools[source_name] = unmatched_schools.get(source_name, 0) + 1

    print(f"\nSuccessfully matched {matched_count} boundary maps.")
    if unmatched_schools:
        print(f"Warning: {len(unmatched_schools)} unique source names could not be matched. Examples:")
        for name, cnt in list(unmatched_schools.items())[:10]:
            print(f"  - '{name}' ({cnt} maps)")

    # 4. Save updated schools data
    with open(SCHOOLS_JSON, 'w', encoding='utf-8') as f:
        json.dump(schools, f, indent=2)
    print(f"\nSaved updated school data with boundary maps to {SCHOOLS_JSON}")

if __name__ == "__main__":
    main()
