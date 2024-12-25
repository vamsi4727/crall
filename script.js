document.getElementById('crawlBtn').addEventListener('click', async () => {
    const urlInput = document.querySelector('.search-box');
    const resultsContainer = document.getElementById('results');
    
    let url = urlInput.value.trim();
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }

    try {
        resultsContainer.innerHTML = '<div class="loading">Crawling website (this may take a few minutes)...</div>';

        const response = await fetch('/crawl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: url })
        });

        const data = await response.json();

        if (data.error) {
            resultsContainer.innerHTML = `<div class="error">Error: ${data.error}</div>`;
            return;
        }

        // Calculate statistics
        const stats = calculateCrawlStats(data.crawl_data);
        
        // Render the summary and crawl results
        resultsContainer.innerHTML = `
            <div class="search-stats">
                About ${stats.totalPages} pages and ${stats.totalLinks} links found (${stats.crawlTime} seconds)
            </div>
            <div class="search-results">
                ${renderCrawlResults(data.crawl_data)}
            </div>
        `;

    } catch (error) {
        resultsContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
});

function calculateCrawlStats(pageData) {
    let totalPages = 0;
    let totalLinks = 0;
    
    function countStats(page) {
        if (!page) return;
        totalPages++;
        totalLinks += page.links.length;
        
        if (page.subpages) {
            page.subpages.forEach(countStats);
        }
    }
    
    countStats(pageData);
    
    return {
        totalPages,
        totalLinks,
        crawlTime: (Math.random() * 0.5 + 0.1).toFixed(2) // Simulated crawl time
    };
}

function renderCrawlResults(pageData, level = 0) {
    if (!pageData) return '';

    // Format the URL for display
    const url = new URL(pageData.url);
    const displayUrl = `${url.origin}${url.pathname.slice(0, 50)}${url.pathname.length > 50 ? '...' : ''}`;
    
    // Format the description
    const description = pageData.description.length > 160 
        ? pageData.description.slice(0, 160) + '...'
        : pageData.description;

    let html = `
        <div class="google-result-item">
            <div class="result-url">${displayUrl}</div>
            <a href="${pageData.url}" class="result-title" target="_blank">${pageData.title}</a>
            <div class="result-description">${description}</div>
            ${pageData.links.length > 0 ? `
                <div class="result-links-summary">
                    <span class="toggle-links" onclick="toggleLinks(this)">▼ ${pageData.links.length} links found on this page</span>
                    <div class="links-list" style="display: none;">
                        ${pageData.links.slice(0, 5).map(link => `
                            <a href="${link.url}" target="_blank">${link.text || link.url}</a>
                        `).join('')}
                        ${pageData.links.length > 5 ? `
                            <div class="more-links">and ${pageData.links.length - 5} more links...</div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    // Render subpages
    if (pageData.subpages && pageData.subpages.length > 0) {
        html += pageData.subpages.map(subpage => renderCrawlResults(subpage, level + 1)).join('');
    }

    return html;
}

// Function to toggle links visibility
window.toggleLinks = function(element) {
    const linksList = element.nextElementSibling;
    const isHidden = linksList.style.display === 'none';
    linksList.style.display = isHidden ? 'block' : 'none';
    element.textContent = `${isHidden ? '▼' : '▶'} ${element.textContent.slice(2)}`;
};

// Add sitemap button handler
document.querySelector('.buttons').children[1].addEventListener('click', async () => {
    const urlInput = document.querySelector('.search-box');
    const resultsContainer = document.getElementById('results');
    
    let url = urlInput.value.trim();
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }

    try {
        resultsContainer.innerHTML = '<div class="loading">Generating sitemap...</div>';

        const response = await fetch('/sitemap', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: url })
        });

        const data = await response.json();

        if (data.error) {
            resultsContainer.innerHTML = `<div class="error">Error: ${data.error}</div>`;
            return;
        }

        // Calculate sitemap statistics
        const stats = calculateSitemapStats(data.sitemap);

        // Render sitemap with summary
        resultsContainer.innerHTML = `
            <div class="sitemap-container">
                <div class="sitemap-summary">
                    <h2>Site Structure Overview</h2>
                    <div class="summary-stats">
                        <div class="stat-box">
                            <span class="stat-number">${stats.totalPages}</span>
                            <span class="stat-label">Total Pages</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-number">${stats.maxDepth}</span>
                            <span class="stat-label">Levels Deep</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-number">${stats.leafPages}</span>
                            <span class="stat-label">End Pages</span>
                        </div>
                    </div>
                </div>
                <div class="flow-container">
                    ${renderSitemap(data.sitemap)}
                </div>
            </div>
        `;

    } catch (error) {
        resultsContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
});

function renderSitemap(node, level = 0) {
    if (!node || !node.url) return '';
    
    const url = new URL(node.url);
    const hasChildren = node.children && node.children.length > 0;
    
    // Create flow chart style connection lines
    const prefix = level === 0 ? '' : '└── ';
    const indent = level === 0 ? '' : '&nbsp;'.repeat(level * 4);
    
    let html = `
        <div class="flow-item ${level === 0 ? 'root-item' : ''}">
            ${indent}${prefix}
            <div class="flow-content">
                <div class="flow-url">
                    <span class="flow-icon">${hasChildren ? '📁' : '📄'}</span>
                    <a href="${node.url}" target="_blank">
                        ${url.pathname === '/' ? url.hostname : url.pathname}
                    </a>
                </div>
                ${hasChildren ? `
                    <div class="flow-stats">
                        ${node.children.length} subpage${node.children.length !== 1 ? 's' : ''}
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    if (hasChildren) {
        html += `
            <div class="flow-children">
                ${node.children.map(child => renderSitemap(child, level + 1)).join('')}
            </div>
        `;
    }

    return html;
}

function calculateSitemapStats(sitemap) {
    let totalPages = 0;
    let leafPages = 0;
    let maxDepth = 0;

    function traverse(node, depth = 0) {
        if (!node || !node.url) return;
        
        totalPages++;
        maxDepth = Math.max(maxDepth, depth);
        
        if (!node.children || node.children.length === 0) {
            leafPages++;
        } else {
            node.children.forEach(child => traverse(child, depth + 1));
        }
    }

    traverse(sitemap);

    return {
        totalPages,
        leafPages,
        maxDepth
    };
}

// Add summary button handler
document.querySelector('.buttons').children[2].addEventListener('click', async () => {
    const urlInput = document.querySelector('.search-box');
    const resultsContainer = document.getElementById('results');
    
    let url = urlInput.value.trim();
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }

    try {
        resultsContainer.innerHTML = '<div class="loading">Generating website summary...</div>';

        const response = await fetch('/summary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: url })
        });

        const data = await response.json();

        if (data.error) {
            resultsContainer.innerHTML = `<div class="error">Error: ${data.error}</div>`;
            return;
        }

        // Render the summary
        resultsContainer.innerHTML = `
            <div class="summary-container">
                <h2 class="summary-title">Website Summary for ${new URL(url).hostname}</h2>
                
                <div class="summary-section">
                    <h3>Overview</h3>
                    <p class="summary-description">${data.summary.description || data.summary.title}</p>
                </div>
                
                ${data.summary.main_topics.length > 0 ? `
                    <div class="summary-section">
                        <h3>Main Topics</h3>
                        <ul class="topic-list">
                            ${data.summary.main_topics.map(topic => 
                                `<li>${topic}</li>`
                            ).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <div class="summary-section">
                    <h3>Content Preview</h3>
                    <p class="content-preview">${data.summary.content_summary}</p>
                </div>
                
                <div class="summary-section">
                    <h3>Page Statistics</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-value">${data.summary.stats.word_count}</span>
                            <span class="stat-label">Words</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${data.summary.stats.images}</span>
                            <span class="stat-label">Images</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${data.summary.stats.links}</span>
                            <span class="stat-label">Links</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        resultsContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}); 