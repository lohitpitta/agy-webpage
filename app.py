from flask import Flask, jsonify, render_template
import requests
import xml.etree.ElementTree as ET
import time
from bs4 import BeautifulSoup

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_DURATION = 300  # 5 minutes
cache = {
    "data": None,
    "last_fetched": 0
}

def parse_xml_feed(xml_content):
    root = ET.fromstring(xml_content)
    # Atom feed namespace
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    for entry in root.findall('atom:entry', ns):
        title_el = entry.find('atom:title', ns)
        updated_el = entry.find('atom:updated', ns)
        content_el = entry.find('atom:content', ns)
        id_el = entry.find('atom:id', ns)
        link_el = entry.find('atom:link', ns)
        
        title = title_el.text if title_el is not None else "No Title"
        updated = updated_el.text if updated_el is not None else ""
        content_html = content_el.text if content_el is not None else ""
        entry_id = id_el.text if id_el is not None else ""
        
        # Link in atom feeds is often in href attribute
        link = ""
        if link_el is not None:
            link = link_el.attrib.get('href', '')
            
        entries.append({
            'id': entry_id,
            'title': title,
            'updated': updated,
            'content': content_html,
            'link': link
        })
    return entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    now = time.time()
    # Check cache
    if cache["data"] and (now - cache["last_fetched"]) < CACHE_DURATION:
        return jsonify({
            "source": "cache",
            "notes": cache["data"]
        })
        
    try:
        response = requests.get(FEED_URL, timeout=10)
        if response.status_code == 200:
            notes = parse_xml_feed(response.content)
            cache["data"] = notes
            cache["last_fetched"] = now
            return jsonify({
                "source": "network",
                "notes": notes
            })
        else:
            # If request fails but cache exists, return stale cache
            if cache["data"]:
                return jsonify({
                    "source": "stale_cache",
                    "notes": cache["data"],
                    "warning": "Failed to fetch fresh data. Returning cached version."
                })
            return jsonify({"error": f"Failed to fetch feed: HTTP {response.status_code}"}), 500
    except Exception as e:
        if cache["data"]:
            return jsonify({
                "source": "stale_cache",
                "notes": cache["data"],
                "warning": f"Error fetching feed: {str(e)}. Returning cached version."
            })
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
