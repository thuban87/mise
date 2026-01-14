import os
import re
import json
import sys
import datetime

# --- CONFIGURATION & SETUP ---
# Determine the absolute path of the script itself
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Calculate Vault Root (Script is in System/Scripts, so go up two levels)
VAULT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
RECIPES_DIR = os.path.join(VAULT_ROOT, "Life", "Household", "Kitchen", "Recipes")
OUTPUT_FILE = os.path.join(RECIPES_DIR, "Recipe_Index.json")
LOG_FILE = os.path.join(SCRIPT_DIR, "recipe_index_log.txt")

def log(message):
    """Writes message to a log file and stdout."""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted_msg = f"[{timestamp}] {message}"
    print(formatted_msg)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(formatted_msg + "\n")
    except Exception as e:
        pass # If we can't log, we can't log.

def parse_frontmatter(content):
    """
    Manually parses simple YAML frontmatter without external libraries.
    """
    fm_match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    metadata = {}
    if fm_match:
        fm_text = fm_match.group(1)
        lines = fm_text.split('\n')
        current_list_key = None
        
        for line in lines:
            line = line.rstrip()
            if not line: continue
            
            # Check for list items (indented hyphen)
            list_match = re.match(r'^\s+-\s+(.*)', line)
            if list_match and current_list_key:
                val = list_match.group(1).strip()
                if current_list_key not in metadata:
                    metadata[current_list_key] = []
                metadata[current_list_key].append(val)
                continue

            # Check for key: value
            key_match = re.match(r'^([\w_]+):\s*(.*)', line)
            if key_match:
                key = key_match.group(1)
                val = key_match.group(2).strip()
                if not val:
                    # Key with empty value, likely starting a list
                    current_list_key = key
                    metadata[key] = [] # Initialize as empty list
                else:
                    current_list_key = None # Reset list context
                    # Handle simple types (int, float)
                    if val.isdigit():
                        metadata[key] = int(val)
                    else:
                        metadata[key] = val
    return metadata

def parse_markdown_file(file_path):
    """
    Parses a markdown recipe file.
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    frontmatter = parse_frontmatter(content)
    
    title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else os.path.basename(file_path).replace('.md', '')

    ingredients = []
    ing_section_match = re.search(r'##\s+.*?Ingredients.*?\n(.*?)(?=\n##|\Z)', content, re.DOTALL | re.IGNORECASE)
    
    if ing_section_match:
        raw_ingredients = ing_section_match.group(1).strip().split('\n')
        for line in raw_ingredients:
            clean_line = re.sub(r'^-\s*\[.\]\s*', '', line) 
            clean_line = re.sub(r'^-\s*', '', clean_line)
            clean_line = clean_line.strip()
            if clean_line: 
                 ingredients.append(clean_line)
    
    return {
        "title": title,
        "filename": os.path.basename(file_path),
        "path": os.path.relpath(file_path, VAULT_ROOT).replace('\\', '/'),
        "category": frontmatter.get('category', 'Uncategorized'),
        "tags": frontmatter.get('tags', []),
        "ingredients": ingredients
    }

def main():
    log("--- Starting Recipe Indexer ---")
    log(f"Root: {VAULT_ROOT}")
    
    recipe_index = []
    
    if not os.path.exists(RECIPES_DIR):
        log(f"Error: Recipe directory not found at {RECIPES_DIR}")
        return

    count = 0
    for root, dirs, files in os.walk(RECIPES_DIR):
        for file in files:
            if file.endswith(".md") and not file.startswith("Recipe_Index") and not file == "desktop.ini":
                file_path = os.path.join(root, file)
                try:
                    recipe_data = parse_markdown_file(file_path)
                    recipe_index.append(recipe_data)
                    count += 1
                except Exception as e:
                    log(f"Failed to parse {file}: {e}")

    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(recipe_index, f, indent=2, ensure_ascii=False)
        log(f"Success! Indexed {count} recipes.")
    except Exception as e:
        log(f"Error writing JSON file: {e}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"Fatal Error: {e}")