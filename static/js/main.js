document.addEventListener('DOMContentLoaded', () => {
    // State management
    let releaseNotes = [];
    let activeFilter = 'all';
    let searchQuery = '';
    let selectedText = '';
    let selectedLink = '';
    
    // Elements
    const feedContainer = document.getElementById('release-notes-feed');
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshSpinner = document.getElementById('refresh-spinner');
    const totalCountEl = document.getElementById('total-count');
    const lastUpdatedEl = document.getElementById('last-updated');
    const searchInput = document.getElementById('search-input');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const feedStatusMsg = document.getElementById('feed-status-msg');
    
    // Error & Warning Banners
    const errorContainer = document.getElementById('error-container');
    const errorText = document.getElementById('error-text');
    const errorRetryBtn = document.getElementById('error-retry-btn');
    const warningContainer = document.getElementById('warning-container');
    const warningText = document.getElementById('warning-text');
    
    // Tweet Drawer Elements
    const tweetDrawer = document.getElementById('tweet-drawer');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');
    const selectedSnippetText = document.getElementById('selected-snippet-text');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCountEl = document.getElementById('char-count');
    const copyTweetBtn = document.getElementById('copy-tweet-btn');
    const publishTweetBtn = document.getElementById('publish-tweet-btn');
    const progressRingCircle = document.querySelector('.progress-ring__circle');
    
    // Progress Ring Constants
    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    if (progressRingCircle) {
        progressRingCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        progressRingCircle.style.strokeDashoffset = circumference;
    }

    // Initialize Page
    fetchNotes();
    
    // Event Listeners
    refreshBtn.addEventListener('click', fetchNotes);
    errorRetryBtn.addEventListener('click', fetchNotes);
    
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderFeed();
    });
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.type;
            renderFeed();
        });
    });
    
    closeDrawerBtn.addEventListener('click', closeDrawer);
    
    tweetTextarea.addEventListener('input', updateCharCount);
    
    copyTweetBtn.addEventListener('click', () => {
        tweetTextarea.select();
        navigator.clipboard.writeText(tweetTextarea.value)
            .then(() => {
                const originalText = copyTweetBtn.innerHTML;
                copyTweetBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                setTimeout(() => {
                    copyTweetBtn.innerHTML = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
            });
    });

    // Fetch Release Notes from API
    function fetchNotes() {
        setLoadingState(true);
        errorContainer.classList.add('hidden');
        warningContainer.classList.add('hidden');
        
        fetch('/api/release-notes')
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! Status: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                
                releaseNotes = data.notes || [];
                
                // Show warning if returning stale cache due to failure
                if (data.warning) {
                    warningContainer.classList.remove('hidden');
                    warningText.textContent = data.warning;
                }
                
                // Set stats
                totalCountEl.textContent = releaseNotes.length;
                lastUpdatedEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                feedStatusMsg.textContent = `Feed loaded (Source: ${data.source})`;
                renderFeed();
            })
            .catch(err => {
                console.error('Error fetching release notes:', err);
                errorContainer.classList.remove('hidden');
                errorText.textContent = err.message || 'Check your internet connection and try again.';
                feedStatusMsg.textContent = 'Failed to load updates';
                feedContainer.innerHTML = '<div class="release-card"><div class="card-inner">Failed to load feed entries. Please retry.</div></div>';
            })
            .finally(() => {
                setLoadingState(false);
            });
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            refreshBtn.disabled = true;
            refreshSpinner.classList.add('show');
            if (releaseNotes.length === 0) {
                renderSkeletons();
            }
        } else {
            refreshBtn.disabled = false;
            refreshSpinner.classList.remove('show');
        }
    }

    function renderSkeletons() {
        feedContainer.innerHTML = `
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        `;
    }

    // Check entry type (Feature, Announcement, Deprecation, etc.) based on inner HTML headings
    function getEntryType(htmlContent) {
        const lower = htmlContent.toLowerCase();
        if (lower.includes('<h3>feature</h3>') || lower.includes('<h3>features</h3>')) return 'feature';
        if (lower.includes('<h3>announcement</h3>') || lower.includes('<h3>announcements</h3>')) return 'announcement';
        if (lower.includes('<h3>deprecation</h3>') || lower.includes('<h3>deprecations</h3>')) return 'deprecation';
        return 'other';
    }

    // Match search query against release notes entry details
    function matchesSearch(note) {
        if (!searchQuery) return true;
        
        const titleMatch = note.title.toLowerCase().includes(searchQuery);
        const contentMatch = note.content.toLowerCase().includes(searchQuery);
        
        return titleMatch || contentMatch;
    }

    // Render Feed Entries to the DOM
    function renderFeed() {
        if (releaseNotes.length === 0) {
            feedContainer.innerHTML = '<div class="release-card"><div class="card-inner">No release notes available.</div></div>';
            return;
        }

        // Apply filters
        const filtered = releaseNotes.filter(note => {
            // Search filter
            if (!matchesSearch(note)) return false;
            
            // Category filter
            if (activeFilter === 'all') return true;
            const type = getEntryType(note.content);
            return type === activeFilter;
        });

        if (filtered.length === 0) {
            feedContainer.innerHTML = '<div class="release-card"><div class="card-inner"><p style="text-align:center;color:var(--text-muted);">No matches found for active search and filters.</p></div></div>';
            return;
        }

        feedContainer.innerHTML = '';
        
        filtered.forEach((note, index) => {
            const card = document.createElement('div');
            card.className = 'release-card';
            card.style.animationDelay = `${index * 0.05}s`;
            
            // Parse and modify the content HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = note.content;
            
            // Make all links open in a new tab
            tempDiv.querySelectorAll('a').forEach(link => {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            });
            
            // Format headers nicely and wrap segments
            const headings = tempDiv.querySelectorAll('h3');
            headings.forEach(h3 => {
                const headerText = h3.textContent.trim().toLowerCase();
                h3.classList.add(`${headerText}-header`);
                
                // Add icon to header
                let iconClass = 'fa-circle-info';
                if (headerText.includes('feature')) iconClass = 'fa-star';
                if (headerText.includes('announcement')) iconClass = 'fa-bullhorn';
                if (headerText.includes('deprecation')) iconClass = 'fa-triangle-exclamation';
                
                h3.innerHTML = `<i class="fa-solid ${iconClass}"></i> ${h3.textContent}`;
            });

            // Find all content chunks: p, li, blockquote to bind selector triggers
            const interactiveElements = tempDiv.querySelectorAll('p, li');
            interactiveElements.forEach(el => {
                // Ignore elements that are empty or have no readable text
                if (!el.textContent.trim()) return;
                
                // Bind select trigger
                el.addEventListener('click', (e) => {
                    // Prevent trigger if they are clicking a link inside the text
                    if (e.target.tagName === 'A') return;
                    
                    selectSnippet(el, note.link || note.id);
                });
            });

            const updatedDate = new Date(note.updated).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            card.innerHTML = `
                <div class="timeline-dot"></div>
                <div class="card-inner">
                    <div class="card-header">
                        <div class="card-title">${note.title}</div>
                        <a href="${note.link}" target="_blank" rel="noopener noreferrer" class="card-link" title="Open official notes">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                    </div>
                    <div class="card-content">
                        ${tempDiv.innerHTML}
                    </div>
                </div>
            `;
            
            feedContainer.appendChild(card);
        });

        // Re-highlight if the selected element is still visible in the current view
        restoreSelection();
    }

    // Handle Selecting a Specific Snippet
    function selectSnippet(element, link) {
        // Clear previous selected state
        document.querySelectorAll('.card-content .selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Add selected class to current element
        element.classList.add('selected');
        
        // Populate State
        selectedText = element.textContent.trim();
        // Remove multiple spaces and newlines
        selectedText = selectedText.replace(/\s+/g, ' ');
        selectedLink = link;
        
        // Update Drawer Content
        selectedSnippetText.textContent = `"${selectedText}"`;
        
        // Compose Tweet template
        composeTweetText();
        
        // Open the slide drawer
        openDrawer();
    }

    function composeTweetText() {
        // Compose standard tweet:
        // Snippet (truncated) + Link + Hashtags
        const hashtags = "#BigQuery #GoogleCloud";
        const citation = selectedLink ? `\n\nMore: ${selectedLink}` : '';
        const baseBoilerplate = `${citation}\n${hashtags}`;
        
        // Max characters for snippet
        const maxSnippetLen = 280 - baseBoilerplate.length - 6; // 6 for quotes and ellipses
        
        let truncatedSnippet = selectedText;
        if (selectedText.length > maxSnippetLen) {
            truncatedSnippet = selectedText.slice(0, maxSnippetLen - 3) + '...';
        }
        
        tweetTextarea.value = `"${truncatedSnippet}"${citation}\n${hashtags}`;
        updateCharCount();
    }

    function openDrawer() {
        tweetDrawer.classList.add('open');
    }

    function closeDrawer() {
        tweetDrawer.classList.remove('open');
        // Clear active highlighting
        document.querySelectorAll('.card-content .selected').forEach(el => {
            el.classList.remove('selected');
        });
    }

    function restoreSelection() {
        if (!selectedText) return;
        
        // Scan rendered feed elements for matching text to maintain visual active state
        const items = feedContainer.querySelectorAll('.card-content p, .card-content li');
        for (let item of items) {
            if (item.textContent.trim().replace(/\s+/g, ' ') === selectedText) {
                item.classList.add('selected');
                break;
            }
        }
    }

    // Update character counter and Tweet button link/status
    function updateCharCount() {
        const text = tweetTextarea.value;
        const count = text.length;
        const remaining = 280 - count;
        
        charCountEl.textContent = remaining;
        
        // Style character counter based on remaining characters
        const charContainer = document.querySelector('.char-count-container');
        charContainer.classList.remove('warning', 'error');
        
        if (remaining <= 20 && remaining >= 0) {
            charContainer.classList.add('warning');
        } else if (remaining < 0) {
            charContainer.classList.add('error');
        }
        
        // Update Progress Ring
        if (progressRingCircle) {
            const percentage = Math.max(0, Math.min(100, (count / 280) * 100));
            const offset = circumference - (percentage / 100) * circumference;
            progressRingCircle.style.strokeDashoffset = offset;
            
            // Set ring color
            if (remaining < 0) {
                progressRingCircle.style.stroke = 'var(--accent-deprecation)';
            } else if (remaining <= 20) {
                progressRingCircle.style.stroke = '#eab308';
            } else {
                progressRingCircle.style.stroke = 'var(--twitter-blue)';
            }
        }
        
        // Enable/Disable Publish Button
        if (count > 0 && count <= 280) {
            publishTweetBtn.classList.remove('disabled');
            const encodedText = encodeURIComponent(text);
            publishTweetBtn.href = `https://twitter.com/intent/tweet?text=${encodedText}`;
        } else {
            publishTweetBtn.classList.add('disabled');
            publishTweetBtn.href = '#';
        }
    }
});
