from flask import Flask, request, jsonify, send_from_directory
import requests
from bs4 import BeautifulSoup
from flask_cors import CORS
import os
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor
import time
import re

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

def is_valid_url(url, base_domain):
    """Check if URL belongs to the same domain and is not an anchor"""
    try:
        parsed = urlparse(url)
        return parsed.netloc == base_domain and not url.startswith('#')
    except:
        return False

def get_sitemap(url, visited=None, base_domain=None):
    """Recursively build sitemap"""
    if visited is None:
        visited = set()
        base_domain = urlparse(url).netloc
    
    if url in visited:
        return {}
    
    visited.add(url)
    sitemap = {'url': url, 'children': []}
    
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        for link in soup.find_all('a'):
            href = link.get('href')
            if href:
                full_url = urljoin(url, href)
                if is_valid_url(full_url, base_domain) and full_url not in visited:
                    child_map = get_sitemap(full_url, visited, base_domain)
                    if child_map:
                        sitemap['children'].append(child_map)
        
        return sitemap
    except Exception as e:
        print(f"Error crawling {url}: {str(e)}")
        return {}

def get_page_info(url):
    """Get page title and meta description"""
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        title = soup.title.string if soup.title else url
        meta_desc = soup.find('meta', {'name': 'description'})
        description = meta_desc['content'] if meta_desc else None
        
        return {
            'title': title.strip() if title else url,
            'description': description.strip() if description else 'No description available'
        }
    except:
        return {'title': url, 'description': 'No description available'}

def crawl_page(url, depth=0, max_depth=3, visited=None, base_domain=None):
    """Crawl a page and its links up to max_depth"""
    if visited is None:
        visited = set()
    if base_domain is None:
        base_domain = urlparse(url).netloc
    
    if depth >= max_depth or url in visited:
        return None
    
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        visited.add(url)
        
        # Get page info
        page_info = get_page_info(url)
        
        # Get all links on the page
        links = []
        for link in soup.find_all('a'):
            href = link.get('href')
            if href:
                full_url = urljoin(url, href)
                parsed_url = urlparse(full_url)
                
                if (parsed_url.netloc == base_domain and 
                    full_url not in visited and 
                    not href.startswith('#')):
                    
                    link_info = {
                        'url': full_url,
                        'text': link.get_text().strip() or full_url,
                    }
                    links.append(link_info)
        
        # Create page data structure
        page_data = {
            'url': url,
            'title': page_info['title'],
            'description': page_info['description'],
            'links': links,
            'subpages': []
        }
        
        # Recursively crawl linked pages
        if depth < max_depth - 1:
            with ThreadPoolExecutor(max_workers=5) as executor:
                futures = []
                for link in links[:5]:  # Limit to 5 subpages per page
                    futures.append(
                        executor.submit(
                            crawl_page, 
                            link['url'], 
                            depth + 1, 
                            max_depth, 
                            visited, 
                            base_domain
                        )
                    )
                
                for future in futures:
                    result = future.result()
                    if result:
                        page_data['subpages'].append(result)
        
        return page_data
        
    except Exception as e:
        print(f"Error crawling {url}: {str(e)}")
        return None

def get_website_summary(url):
    """Generate a summary of the website content"""
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Get title
        title = soup.title.string if soup.title else ''
        
        # Get meta description
        meta_desc = soup.find('meta', {'name': 'description'})
        description = meta_desc['content'] if meta_desc else ''
        
        # Get main content
        # Remove script, style elements and hidden elements
        for element in soup(['script', 'style', '[style*="display: none"]', '[hidden]']):
            element.decompose()
        
        # Get text from common content areas
        content_areas = soup.find_all(['main', 'article', 'section', 'div'], 
                                    class_=re.compile(r'content|main|article|text'))
        
        # If no specific content areas found, get all paragraphs
        if not content_areas:
            content_areas = soup.find_all('p')
        
        # Extract and clean text
        content = ' '.join([area.get_text() for area in content_areas])
        content = re.sub(r'\s+', ' ', content).strip()
        
        # Get headings
        headings = [h.get_text().strip() for h in soup.find_all(['h1', 'h2', 'h3'])]
        
        # Count images and links
        images = len(soup.find_all('img'))
        links = len(soup.find_all('a'))
        
        return {
            'title': title,
            'description': description,
            'main_topics': headings[:5],  # Top 5 headings
            'content_summary': content[:500] + '...' if len(content) > 500 else content,
            'stats': {
                'images': images,
                'links': links,
                'word_count': len(content.split()),
            }
        }
        
    except Exception as e:
        print(f"Error summarizing {url}: {str(e)}")
        return None

@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

@app.route('/crawl', methods=['POST'])
def crawl():
    url = request.json.get('url')
    try:
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
            
        result = crawl_page(url, max_depth=3)
        if result:
            return jsonify({'crawl_data': result})
        else:
            return jsonify({'error': 'Failed to crawl website'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/sitemap', methods=['POST'])
def generate_sitemap():
    url = request.json.get('url')
    try:
        # Add http:// if not present
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
            
        sitemap = get_sitemap(url)
        return jsonify({'sitemap': sitemap})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/summary', methods=['POST'])
def generate_summary():
    url = request.json.get('url')
    try:
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
            
        summary = get_website_summary(url)
        if summary:
            return jsonify({'summary': summary})
        else:
            return jsonify({'error': 'Failed to generate summary'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# if __name__ == '__main__':
#     app.run(debug=True) 

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)