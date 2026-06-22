// Global state
let schoolsData = [];
let filteredSchools = [];
let comparisonList = [];
let activeLayout = 'grid'; // 'grid' or 'table' or 'map'
let map = null;
let mapMarkers = [];
let currentFilters = {
    search: '',
    level: 'all', // 'all', 'elementary', 'secondary'
    programs: {
        core: false,
        extended: false,
        immersion: false
    },
    tiers: {
        t1: false,
        t2: false,
        t3: false
    },
    waterlooSpecific: false,
    minMath: 0,
    minLiteracy: 0,
    maxUtilization: 150
};

let currentWeights = {
    math: 20,
    literacy: 20,
    capacity: 30,
    programs: 15,
    demographics: 15
};

const weightPresets = {
    equal: { math: 20, literacy: 20, capacity: 20, programs: 20, demographics: 20 },
    academic: { math: 30, literacy: 30, capacity: 10, programs: 15, demographics: 15 },
    capacity: { math: 7, literacy: 8, capacity: 60, programs: 10, demographics: 15 },
    balanced: { math: 20, literacy: 20, capacity: 30, programs: 15, demographics: 15 }
};

let sortField = 'composite_score';
let sortAscending = false;

// DOM Elements
const searchInput = document.getElementById('search-input');
const layoutGridBtn = document.getElementById('layout-grid-btn');
const layoutTableBtn = document.getElementById('layout-table-btn');
const layoutMapBtn = document.getElementById('layout-map-btn');
const levelAllBtn = document.getElementById('level-all-btn');
const levelElemBtn = document.getElementById('level-elem-btn');
const levelSecBtn = document.getElementById('level-sec-btn');

// Initialize the app
window.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadData();
});

// Load schools data from JSON
async function loadData() {
    try {
        const response = await fetch('./data/schools_data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        schoolsData = await response.json();
        
        // Calculate initial scores
        calculateScores();
        applyFilters();
        renderSummaryStats();
    } catch (error) {
        console.error("Could not load school data:", error);
        document.getElementById('schools-container').innerHTML = `
            <div class="no-schools-found" style="text-align: left; max-width: 600px; margin: 2rem auto; padding: 1.5rem; border: 1px solid var(--danger); background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-md);">
                <p style="color: var(--danger); font-weight: 700; font-size: 1.2rem; margin-bottom: 0.5rem;">Error Loading School Data</p>
                <p style="font-weight: 600; margin-bottom: 0.5rem;">Error Details: <code style="background: rgba(0,0,0,0.2); padding: 0.2rem 0.4rem; border-radius: 4px;">${error.message || error}</code></p>
                <p style="font-size: 0.9rem; margin-bottom: 1rem; color: var(--text-secondary);">If you see a NetworkError or CORS/fetch error, please check that you are opening the app via <a href="http://localhost:8000" style="color: var(--accent); font-weight: 600;">http://localhost:8000</a> (or the correct port) in your browser address bar, and NOT by double-clicking the file (which opens a <code>file://</code> URL).</p>
                ${error.stack ? `<pre style="font-size: 0.8rem; background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 4px; overflow-x: auto; max-height: 200px; color: #f87171;">${error.stack}</pre>` : ''}
            </div>
        `;
    }
}

// Set up UI Event Listeners
function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', (e) => {
        currentFilters.search = e.target.value;
        applyFilters();
    });

    // Level toggles
    levelAllBtn.addEventListener('click', () => setLevelFilter('all'));
    levelElemBtn.addEventListener('click', () => setLevelFilter('elementary'));
    levelSecBtn.addEventListener('click', () => setLevelFilter('secondary'));

    // Layout toggles
    layoutGridBtn.addEventListener('click', () => setLayout('grid'));
    layoutTableBtn.addEventListener('click', () => setLayout('table'));
    layoutMapBtn.addEventListener('click', () => setLayout('map'));

    // Program checkboxes
    document.getElementById('prog-core').addEventListener('change', (e) => {
        currentFilters.programs.core = e.target.checked;
        applyFilters();
    });
    document.getElementById('prog-extended').addEventListener('change', (e) => {
        currentFilters.programs.extended = e.target.checked;
        applyFilters();
    });
    document.getElementById('prog-immersion').addEventListener('change', (e) => {
        currentFilters.programs.immersion = e.target.checked;
        applyFilters();
    });

    // Tier checkboxes
    document.getElementById('tier-1-chk').addEventListener('change', (e) => {
        currentFilters.tiers.t1 = e.target.checked;
        applyFilters();
    });
    document.getElementById('tier-2-chk').addEventListener('change', (e) => {
        currentFilters.tiers.t2 = e.target.checked;
        applyFilters();
    });
    document.getElementById('tier-3-chk').addEventListener('change', (e) => {
        currentFilters.tiers.t3 = e.target.checked;
        applyFilters();
    });

    // Waterloo specific check
    document.getElementById('waterloo-specific-chk').addEventListener('change', (e) => {
        currentFilters.waterlooSpecific = e.target.checked;
        applyFilters();
    });

    // Threshold sliders
    document.getElementById('filter-math').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        currentFilters.minMath = val;
        document.getElementById('filter-math-val').textContent = `${val}%`;
        applyFilters();
    });

    document.getElementById('filter-literacy').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        currentFilters.minLiteracy = val;
        document.getElementById('filter-literacy-val').textContent = `${val}%`;
        applyFilters();
    });

    document.getElementById('filter-utilization').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        currentFilters.maxUtilization = val;
        document.getElementById('filter-utilization-val').textContent = val === 150 ? 'No Limit' : `${val}%`;
        applyFilters();
    });

    // Weight sliders
    const sliders = ['math', 'literacy', 'capacity', 'programs', 'demographics'];
    sliders.forEach(key => {
        const slider = document.getElementById(`weight-${key}`);
        const display = document.getElementById(`weight-${key}-val`);
        
        slider.addEventListener('input', (e) => {
            // Remove active state from preset buttons
            document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
            
            const newVal = parseInt(e.target.value);
            currentWeights[key] = newVal;
            display.textContent = `${newVal}%`;
            
            // Normalize other sliders so they sum to 100
            normalizeWeights(key, newVal);
            calculateScores();
            applyFilters();
        });
    });

    // Preset buttons
    document.getElementById('preset-equal').addEventListener('click', () => applyWeightPreset('equal'));
    document.getElementById('preset-academic').addEventListener('click', () => applyWeightPreset('academic'));
    document.getElementById('preset-capacity').addEventListener('click', () => applyWeightPreset('capacity'));
    document.getElementById('preset-balanced').addEventListener('click', () => applyWeightPreset('balanced'));

    // Close Modal event
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') {
            closeModal();
        }
    });

    // Close Compare Overlay event
    document.getElementById('close-compare-btn').addEventListener('click', closeCompareModal);
    document.getElementById('compare-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'compare-overlay') {
            closeCompareModal();
        }
    });

    // Clear comparison
    document.getElementById('clear-compare-btn').addEventListener('click', () => {
        comparisonList = [];
        updateComparePanel();
        applyFilters(); // Re-render to update comparative state on cards
    });

    // Trigger compare comparison matrix
    document.getElementById('compare-action-btn').addEventListener('click', openCompareModal);
}

// Normalize weight sliders so they always sum to 100%
function normalizeWeights(modifiedKey, modifiedValue) {
    const keys = Object.keys(currentWeights);
    const otherKeys = keys.filter(k => k !== modifiedKey);
    const sumOthers = otherKeys.reduce((sum, k) => sum + currentWeights[k], 0);
    
    const targetOthersSum = 100 - modifiedValue;
    
    if (sumOthers > 0) {
        otherKeys.forEach(k => {
            const ratio = currentWeights[k] / sumOthers;
            currentWeights[k] = Math.round(ratio * targetOthersSum);
        });
    } else {
        // If others were zero, split the remainder equally
        otherKeys.forEach(k => {
            currentWeights[k] = Math.round(targetOthersSum / otherKeys.length);
        });
    }
    
    // Check and resolve rounding errors to make sure they sum to exactly 100
    let finalSum = Object.values(currentWeights).reduce((sum, v) => sum + v, 0);
    if (finalSum !== 100) {
        const adjustment = 100 - finalSum;
        // Apply adjustment to the first other key
        currentWeights[otherKeys[0]] += adjustment;
    }
    
    // Update slider values in UI
    keys.forEach(k => {
        const slider = document.getElementById(`weight-${k}`);
        const display = document.getElementById(`weight-${k}-val`);
        slider.value = currentWeights[k];
        display.textContent = `${currentWeights[k]}%`;
    });
}

// Apply weight preset
function applyWeightPreset(presetName) {
    currentWeights = { ...weightPresets[presetName] };
    
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === `preset-${presetName}`);
    });
    
    Object.keys(currentWeights).forEach(k => {
        const slider = document.getElementById(`weight-${k}`);
        const display = document.getElementById(`weight-${k}-val`);
        slider.value = currentWeights[k];
        display.textContent = `${currentWeights[k]}%`;
    });
    
    calculateScores();
    applyFilters();
}

function setLevelFilter(level) {
    currentFilters.level = level;
    
    levelAllBtn.classList.toggle('active', level === 'all');
    levelElemBtn.classList.toggle('active', level === 'elementary');
    levelSecBtn.classList.toggle('active', level === 'secondary');
    
    // Show Waterloo filter only when Secondary level is selected
    const waterlooWrapper = document.getElementById('waterloo-filter-wrapper');
    if (waterlooWrapper) {
        waterlooWrapper.style.display = level === 'secondary' ? 'block' : 'none';
        if (level !== 'secondary') {
            const chk = document.getElementById('waterloo-specific-chk');
            if (chk) {
                chk.checked = false;
                currentFilters.waterlooSpecific = false;
            }
        }
    }
    
    // Show/hide utilization threshold slider depending on level
    const utilizationWrapper = document.getElementById('filter-utilization-wrapper');
    if (utilizationWrapper) {
        utilizationWrapper.style.display = level === 'secondary' ? 'none' : 'block';
        if (level === 'secondary') {
            const slider = document.getElementById('filter-utilization');
            if (slider) {
                slider.value = 150;
                currentFilters.maxUtilization = 150;
                document.getElementById('filter-utilization-val').textContent = 'No Limit';
            }
        }
    }
    
    applyFilters();
}

function setLayout(layout) {
    activeLayout = layout;
    layoutGridBtn.classList.toggle('active', layout === 'grid');
    layoutTableBtn.classList.toggle('active', layout === 'table');
    layoutMapBtn.classList.toggle('active', layout === 'map');
    
    const schoolsContainer = document.getElementById('schools-container');
    const mapContainer = document.getElementById('map-container');
    
    if (layout === 'map') {
        schoolsContainer.style.display = 'none';
        mapContainer.style.display = 'block';
        initMap();
        renderMapMarkers();
    } else {
        schoolsContainer.style.display = 'block';
        mapContainer.style.display = 'none';
        renderSchoolsList();
    }
}

// Score Calculation Logic
function calculateScores() {
    schoolsData.forEach(school => {
        // 1. Academic Scores
        let academicScore = null;
        if (school.eqao && school.eqao.academic_average !== null) {
            academicScore = school.eqao.academic_average * 100.0;
        }
        
        let mathScore = null;
        if (school.eqao) {
            const mathVals = [];
            if (school.eqao.gr3_math !== null && school.eqao.gr3_math !== undefined) mathVals.push(school.eqao.gr3_math);
            if (school.eqao.gr6_math !== null && school.eqao.gr6_math !== undefined) mathVals.push(school.eqao.gr6_math);
            if (school.eqao.gr9_math !== null && school.eqao.gr9_math !== undefined) mathVals.push(school.eqao.gr9_math);
            if (mathVals.length > 0) {
                mathScore = (mathVals.reduce((sum, v) => sum + v, 0) / mathVals.length) * 100.0;
            }
        }

        let literacyScore = null;
        if (school.eqao) {
            const litVals = [];
            if (school.eqao.gr3_reading !== null && school.eqao.gr3_reading !== undefined) litVals.push(school.eqao.gr3_reading);
            if (school.eqao.gr3_writing !== null && school.eqao.gr3_writing !== undefined) litVals.push(school.eqao.gr3_writing);
            if (school.eqao.gr6_reading !== null && school.eqao.gr6_reading !== undefined) litVals.push(school.eqao.gr6_reading);
            if (school.eqao.gr6_writing !== null && school.eqao.gr6_writing !== undefined) litVals.push(school.eqao.gr6_writing);
            if (school.eqao.osslt !== null && school.eqao.osslt !== undefined) litVals.push(school.eqao.osslt);
            if (litVals.length > 0) {
                literacyScore = (litVals.reduce((sum, v) => sum + v, 0) / litVals.length) * 100.0;
            }
        }
        
        // 2. Capacity Health Score (85-100% utilization = 100 points, penalize extremes)
        let capacityScore = null;
        if (school.capacity && school.capacity.utilization_rate_pct !== null) {
            const uf = school.capacity.utilization_rate_pct;
            if (uf >= 0.85 && uf <= 1.00) {
                capacityScore = 100;
            } else if (uf > 1.00 && uf <= 1.10) {
                capacityScore = 100 - (uf - 1.00) * 200; // 1.05 -> 90, 1.10 -> 80
            } else if (uf > 1.10) {
                capacityScore = Math.max(20, 80 - (uf - 1.10) * 300); // 1.20 -> 50
            } else if (uf >= 0.70 && uf < 0.85) {
                capacityScore = 100 - (0.85 - uf) * 133; // 0.75 -> 86.7, 0.70 -> 80
            } else {
                capacityScore = Math.max(20, 80 - (0.70 - uf) * 150); // 0.50 -> 50
            }
        }
        
        // 3. FSL Programs offerings score (Core=10, Extended=15, Immersion=25)
        let programScore = 0;
        if (school.fsl_programs) {
            if (school.fsl_programs.includes('Core French')) programScore += 10;
            if (school.fsl_programs.includes('Extended French')) programScore += 15;
            if (school.fsl_programs.includes('French Immersion')) programScore += 25;
        }
        // scale to 0-100: programScore max is 40 (Core + Immersion is typical top, is 35), let's cap at 40 and scale
        programScore = Math.min(100, (programScore / 40.0) * 100);
        
        // 4. Demographics/Community Index score (based on low income households and parents no degree)
        let demographicsScore = null;
        if (school.demographics && school.demographics.low_income_pct !== null) {
            const lowInc = school.demographics.low_income_pct;
            const noDeg = school.demographics.parents_no_degree_pct !== null ? school.demographics.parents_no_degree_pct : 0.0;
            // Lower percentage is better/higher score
            demographicsScore = 100 - (lowInc * 100 * 0.7 + noDeg * 100 * 0.3);
            demographicsScore = Math.max(0, Math.min(100, demographicsScore));
        }
        
        // Save component scores
        school.scores = {
            math: mathScore,
            literacy: literacyScore,
            academics: academicScore,
            capacity: capacityScore,
            programs: programScore,
            demographics: demographicsScore
        };
        
        // Calculate weighted composite score
        // Handle cases where some values are null (e.g. secondary schools have no capacity data, some schools have no EQAO)
        // If a dimension is null, we re-scale the weights of the remaining valid dimensions to sum to 100%
        let weightedSum = 0;
        let activeWeightsSum = 0;
        
        if (mathScore !== null) {
            weightedSum += mathScore * currentWeights.math;
            activeWeightsSum += currentWeights.math;
        }
        if (literacyScore !== null) {
            weightedSum += literacyScore * currentWeights.literacy;
            activeWeightsSum += currentWeights.literacy;
        }
        if (capacityScore !== null) {
            weightedSum += capacityScore * currentWeights.capacity;
            activeWeightsSum += currentWeights.capacity;
        }
        if (programScore !== null) {
            weightedSum += programScore * currentWeights.programs;
            activeWeightsSum += currentWeights.programs;
        }
        if (demographicsScore !== null) {
            weightedSum += demographicsScore * currentWeights.demographics;
            activeWeightsSum += currentWeights.demographics;
        }
        
        school.composite_score = activeWeightsSum > 0 ? Math.round(weightedSum / activeWeightsSum) : 0;
    });
    
    // Sort all schools by score to compute tiers
    const sortedByScore = [...schoolsData].sort((a, b) => b.composite_score - a.composite_score);
    const count = sortedByScore.length;
    
    // Tier boundaries: Top 20% = Tier 1, Middle 60% = Tier 2, Bottom 20% = Tier 3
    sortedByScore.forEach((school, index) => {
        const percentile = index / count;
        if (percentile <= 0.20) {
            school.tier = 1;
        } else if (percentile <= 0.80) {
            school.tier = 2;
        } else {
            school.tier = 3;
        }
    });
}

// Filter and Sort Data
function applyFilters() {
    filteredSchools = schoolsData.filter(school => {
        // Search filter
        if (currentFilters.search) {
            const query = currentFilters.search.toLowerCase();
            const nameMatch = school.school_name.toLowerCase().includes(query);
            const cityMatch = school.city.toLowerCase().includes(query);
            const postalMatch = school.postal_code.toLowerCase().includes(query);
            if (!nameMatch && !cityMatch && !postalMatch) return false;
        }
        
        // Level filter
        if (currentFilters.level !== 'all') {
            if (school.level.toLowerCase() !== currentFilters.level) return false;
        }
        
        // Program filters (AND logic: if checked, school must offer it)
        if (currentFilters.programs.core && !school.fsl_programs.includes('Core French')) return false;
        if (currentFilters.programs.extended && !school.fsl_programs.includes('Extended French')) return false;
        if (currentFilters.programs.immersion && !school.fsl_programs.includes('French Immersion')) return false;
        
        // Tier filters (OR logic: if any are checked, show only matching tiers)
        const anyTierChecked = currentFilters.tiers.t1 || currentFilters.tiers.t2 || currentFilters.tiers.t3;
        if (anyTierChecked) {
            if (school.tier === 1 && !currentFilters.tiers.t1) return false;
            if (school.tier === 2 && !currentFilters.tiers.t2) return false;
            if (school.tier === 3 && !currentFilters.tiers.t3) return false;
        }

        // Waterloo specific filter (only show schools with a specific, non-default adjustment factor)
        if (currentFilters.waterlooSpecific) {
            if (!school.waterloo_af || school.waterloo_af.is_default) return false;
        }

        // Threshold filters
        if (currentFilters.minMath > 0) {
            if (school.scores.math === null || school.scores.math < currentFilters.minMath) return false;
        }
        if (currentFilters.minLiteracy > 0) {
            if (school.scores.literacy === null || school.scores.literacy < currentFilters.minLiteracy) return false;
        }
        if (currentFilters.maxUtilization < 150) {
            if (school.capacity && school.capacity.utilization_rate_pct !== null) {
                const ratePct = school.capacity.utilization_rate_pct * 100;
                if (ratePct > currentFilters.maxUtilization) return false;
            }
        }
        
        return true;
    });
    
    // Sort
    sortFilteredData();
    if (activeLayout === 'map') {
        renderMapMarkers();
    } else {
        renderSchoolsList();
    }
}

function sortFilteredData() {
    filteredSchools.sort((a, b) => {
        let valA, valB;
        
        if (sortField === 'composite_score') {
            valA = a.composite_score;
            valB = b.composite_score;
        } else if (sortField === 'school_name') {
            valA = a.school_name.toLowerCase();
            valB = b.school_name.toLowerCase();
        } else if (sortField === 'enrolment') {
            valA = a.enrolment || 0;
            valB = b.enrolment || 0;
        } else if (sortField === 'eqao_math') {
            valA = a.scores.math !== null ? a.scores.math : -1;
            valB = b.scores.math !== null ? b.scores.math : -1;
        } else if (sortField === 'eqao_lit') {
            valA = a.scores.literacy !== null ? a.scores.literacy : -1;
            valB = b.scores.literacy !== null ? b.scores.literacy : -1;
        } else if (sortField === 'utilization') {
            valA = a.capacity ? (a.capacity.utilization_rate_pct || 0) : 0;
            valB = b.capacity ? (b.capacity.utilization_rate_pct || 0) : 0;
        } else if (sortField === 'tier') {
            valA = a.tier;
            valB = b.tier;
        } else if (sortField === 'waterloo_af') {
            valA = a.waterloo_af ? a.waterloo_af.factor : 999;
            valB = b.waterloo_af ? b.waterloo_af.factor : 999;
        }
        
        if (valA < valB) return sortAscending ? -1 : 1;
        if (valA > valB) return sortAscending ? 1 : -1;
        return 0;
    });
}

function handleSort(field) {
    if (sortField === field) {
        sortAscending = !sortAscending;
    } else {
        sortField = field;
        sortAscending = false;
    }
    
    // Update headers indicators in table view
    if (activeLayout === 'table') {
        document.querySelectorAll('.school-table th').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
            if (th.dataset.sort === field) {
                th.classList.add(sortAscending ? 'sorted-asc' : 'sorted-desc');
            }
        });
    }
    
    sortFilteredData();
    renderSchoolsList();
}

// Render schools list (card grid or table view)
function renderSchoolsList() {
    const container = document.getElementById('schools-container');
    
    if (filteredSchools.length === 0) {
        container.innerHTML = `
            <div class="no-schools-found">
                <p>No schools match your filters.</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Try adjusting the search query or level filters.</p>
            </div>
        `;
        return;
    }
    
    if (activeLayout === 'grid') {
        container.innerHTML = `<div class="school-grid"></div>`;
        const grid = container.querySelector('.school-grid');
        
        filteredSchools.forEach(school => {
            const card = createSchoolCard(school);
            grid.appendChild(card);
        });
    } else {
        // Table view
        container.innerHTML = createSchoolTableHTML();
        
        // Add click events for sorting
        container.querySelectorAll('.school-table th').forEach(th => {
            th.addEventListener('click', () => {
                handleSort(th.dataset.sort);
            });
            // highlight active sort column
            if (th.dataset.sort === sortField) {
                th.style.color = 'var(--text-primary)';
                th.style.borderBottom = '2px solid var(--accent)';
            }
        });
        
        // Add row clicks
        container.querySelectorAll('.school-table tbody tr').forEach(row => {
            row.addEventListener('click', (e) => {
                // If clicked comparison checkbox, don't open details modal
                if (e.target.type === 'checkbox' || e.target.classList.contains('compare-chk-label')) {
                    return;
                }
                const number = row.dataset.number;
                const school = schoolsData.find(s => s.school_number === number);
                openDetailsModal(school);
            });
        });
        
        // Add checkbox listener
        container.querySelectorAll('.table-compare-chk').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const number = e.target.dataset.number;
                handleCompareToggle(number, e.target.checked);
            });
        });
    }
}

function getTrendArrowHTML(trend) {
    if (!trend) return '';
    if (trend === 'improving') {
        return `<span class="trend-arrow trend-improving" title="Improving EQAO Trend">↑</span>`;
    } else if (trend === 'declining') {
        return `<span class="trend-arrow trend-declining" title="Declining EQAO Trend">↓</span>`;
    } else {
        return `<span class="trend-arrow trend-stable" title="Stable EQAO Trend">→</span>`;
    }
}

// HTML Component: School Card
function createSchoolCard(school) {
    const div = document.createElement('div');
    div.className = 'school-card';
    div.dataset.number = school.school_number;
    
    // Tier styling
    let tierClass = `tier-${school.tier}`;
    
    // Math & Literacy display
    const mathVal = school.scores.math !== null 
        ? `${Math.round(school.scores.math)}%` 
        : 'N/A';
    const literacyVal = school.scores.literacy !== null 
        ? `${Math.round(school.scores.literacy)}%` 
        : 'N/A';
        
    // Capacity / Utilization display
    let capVal = 'N/A';
    let capBadgeClass = 'yellow';
    if (school.capacity && school.capacity.utilization_rate_pct !== null) {
        const pct = Math.round(school.capacity.utilization_rate_pct * 100);
        capVal = `${pct}%`;
        if (pct >= 85 && pct <= 100) {
            capBadgeClass = 'green';
        } else if (pct > 100 && pct <= 110) {
            capBadgeClass = 'yellow';
        } else {
            capBadgeClass = 'red';
        }
    }
    
    // Programs pill tags
    const progTags = school.fsl_programs.map(p => `<span class="program-pill">${p}</span>`).join('');
    
    // Check if in comparison list
    const inCompare = comparisonList.includes(school.school_number);
    
    div.innerHTML = `
        <div class="card-header">
            <div class="card-title-group">
                <span class="card-level-badge">${school.level} • ${school.grade_range}</span>
                <h3 class="card-title">${school.school_name}</h3>
            </div>
            <div class="score-badge ${tierClass}">${school.composite_score}</div>
        </div>
        <div class="card-meta-info">
            <span class="meta-item"><span class="search-icon" style="position:static; transform:none; font-size:0.75rem;">📍</span> ${school.city}</span>
            <span class="meta-item" style="color: var(--text-muted); font-size: 0.75rem;">ID: ${school.school_number}</span>
        </div>
        <div class="card-divider"></div>
        <div class="card-stats" style="grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
            <div class="stat-item">
                <span class="stat-item-label">EQAO Math</span>
                <span class="stat-item-value">${mathVal}${getTrendArrowHTML(school.eqao_trend ? school.eqao_trend.math : null)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-item-label">EQAO Lit</span>
                <span class="stat-item-value">${literacyVal}${getTrendArrowHTML(school.eqao_trend ? school.eqao_trend.literacy : null)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-item-label">Utilization</span>
                <span class="stat-item-value" style="flex-wrap: wrap;">
                    ${capVal} 
                    ${school.capacity && school.capacity.utilization_rate_pct !== null ? `<span class="badge-tag ${capBadgeClass}" style="padding: 0.05rem 0.2rem; font-size: 0.6rem; margin-top: 2px;">${capVal >= '100%' ? 'Full' : (capBadgeClass === 'green' ? 'Ideal' : 'Under')}</span>` : ''}
                </span>
            </div>
        </div>
        <div class="card-divider"></div>
        <div class="card-programs">
            ${progTags || '<span class="program-pill" style="color: var(--text-muted);">No FSL programs list</span>'}
        </div>
        <div style="display:flex; justify-content: space-between; align-items:center; margin-top:0.5rem; font-size:0.8rem;">
            <label class="checkbox-label" style="font-size:0.75rem;">
                <input type="checkbox" class="card-compare-chk" data-number="${school.school_number}" ${inCompare ? 'checked' : ''}>
                Compare
            </label>
            <span style="color: var(--accent); font-weight:600;">Details →</span>
        </div>
    `;
    
    // Add event listeners
    div.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox' || e.target.closest('.checkbox-label')) {
            return;
        }
        openDetailsModal(school);
    });
    
    const chk = div.querySelector('.card-compare-chk');
    chk.addEventListener('change', (e) => {
        handleCompareToggle(school.school_number, e.target.checked);
    });
    
    return div;
}

function createSchoolTableHTML() {
    const showWaterlooCol = currentFilters.level === 'secondary';
    let tbody = '';
    
    filteredSchools.forEach(school => {
        const inCompare = comparisonList.includes(school.school_number);
        const mathVal = school.scores.math !== null 
            ? `${Math.round(school.scores.math)}%${getTrendArrowHTML(school.eqao_trend ? school.eqao_trend.math : null)}` 
            : 'N/A';
        const literacyVal = school.scores.literacy !== null 
            ? `${Math.round(school.scores.literacy)}%${getTrendArrowHTML(school.eqao_trend ? school.eqao_trend.literacy : null)}` 
            : 'N/A';
            
        let capVal = 'N/A';
        if (school.capacity && school.capacity.utilization_rate_pct !== null) {
            capVal = `${Math.round(school.capacity.utilization_rate_pct * 100)}%`;
        }
        
        let tierClass = `tier-${school.tier}`;
        
        let waterlooTd = '';
        if (showWaterlooCol) {
            if (school.waterloo_af) {
                const isDef = school.waterloo_af.is_default;
                const factor = school.waterloo_af.factor;
                const colorClass = isDef ? 'trend-stable' : (factor <= 11.5 ? 'trend-improving' : 'trend-declining');
                waterlooTd = `<td style="text-align: center;"><span class="${colorClass}" style="font-weight:700;">${factor.toFixed(1)}%</span>${isDef ? '<span style="font-size:0.65rem; color:var(--text-muted); display:block; line-height:1;">(Default)</span>' : ''}</td>`;
            } else {
                waterlooTd = `<td style="text-align: center; color: var(--text-muted);">N/A</td>`;
            }
        }
        
        tbody += `
            <tr data-number="${school.school_number}">
                <td style="width: 50px; text-align: center;">
                    <input type="checkbox" class="table-compare-chk" data-number="${school.school_number}" ${inCompare ? 'checked' : ''}>
                </td>
                <td style="font-weight: 700;">${school.school_name}</td>
                <td>${school.level}</td>
                <td style="text-align: center;"><span class="badge-tag ${tierClass}">Tier ${school.tier}</span></td>
                <td style="font-weight: 700; text-align: center; color: var(--accent);">${school.composite_score}</td>
                <td style="text-align: center;">${mathVal}</td>
                <td style="text-align: center;">${literacyVal}</td>
                <td style="text-align: center;">${capVal}</td>
                ${waterlooTd}
                <td>${school.grade_range}</td>
                <td>${school.city}</td>
            </tr>
        `;
    });
    
    const waterlooTh = showWaterlooCol 
        ? `<th data-sort="waterloo_af" style="text-align: center;">Waterloo AF</th>` 
        : '';
        
    return `
        <div class="table-container">
            <table class="school-table">
                <thead>
                    <tr>
                        <th style="width: 50px; text-align: center;">Compare</th>
                        <th data-sort="school_name" style="width: 30%;">School Name</th>
                        <th data-sort="level">Level</th>
                        <th data-sort="tier" style="text-align: center;">Tier</th>
                        <th data-sort="composite_score" style="text-align: center;">Score</th>
                        <th data-sort="eqao_math" style="text-align: center;">Math Avg</th>
                        <th data-sort="eqao_lit" style="text-align: center;">Lit Avg</th>
                        <th data-sort="utilization" style="text-align: center;">Utilization</th>
                        ${waterlooTh}
                        <th>Grades</th>
                        <th data-sort="school_name">City</th>
                    </tr>
                </thead>
                <tbody>
                    ${tbody}
                </tbody>
            </table>
        </div>
    `;
}

// Render summary stats on top cards
function renderSummaryStats() {
    document.getElementById('stat-total-count').textContent = schoolsData.length;
    
    const elemCount = schoolsData.filter(s => s.level === 'Elementary').length;
    const secCount = schoolsData.filter(s => s.level === 'Secondary').length;
    document.getElementById('stat-total-desc').textContent = `${elemCount} Elementary, ${secCount} Secondary`;
    
    // Average EQAO Math
    const mathScores = schoolsData
        .map(s => s.scores.math)
        .filter(v => v !== null && v !== undefined);
    const avgMath = mathScores.length > 0 ? Math.round(mathScores.reduce((sum, v) => sum + v, 0) / mathScores.length) : 0;
    document.getElementById('stat-avg-eqao-math').textContent = `${avgMath}%`;
    
    // Average EQAO Literacy
    const literacyScores = schoolsData
        .map(s => s.scores.literacy)
        .filter(v => v !== null && v !== undefined);
    const avgLit = literacyScores.length > 0 ? Math.round(literacyScores.reduce((sum, v) => sum + v, 0) / literacyScores.length) : 0;
    document.getElementById('stat-avg-eqao-lit').textContent = `${avgLit}%`;
    
    // Average utilization (elementary only)
    const utilizations = schoolsData
        .filter(s => s.capacity && s.capacity.utilization_rate_pct !== null)
        .map(s => s.capacity.utilization_rate_pct);
    const avgUtil = utilizations.length > 0 ? Math.round(utilizations.reduce((sum, v) => sum + v, 0) / utilizations.length * 100) : 0;
    document.getElementById('stat-avg-capacity').textContent = `${avgUtil}%`;
}

// Compare List Management
function handleCompareToggle(schoolNumber, checked) {
    if (checked) {
        if (!comparisonList.includes(schoolNumber)) {
            if (comparisonList.length >= 4) {
                alert("You can compare a maximum of 4 schools at once.");
                // uncheck in UI
                document.querySelectorAll(`input[data-number="${schoolNumber}"]`).forEach(chk => {
                    chk.checked = false;
                });
                return;
            }
            comparisonList.push(schoolNumber);
        }
    } else {
        comparisonList = comparisonList.filter(n => n !== schoolNumber);
    }
    
    updateComparePanel();
    
    // Update checking on cards/table rows that are rendered
    document.querySelectorAll(`input[data-number="${schoolNumber}"]`).forEach(chk => {
        chk.checked = checked;
    });
}

function updateComparePanel() {
    const panel = document.getElementById('compare-panel');
    const chipsContainer = document.getElementById('compare-chips');
    const actionBtn = document.getElementById('compare-action-btn');
    
    if (comparisonList.length === 0) {
        panel.style.display = 'none';
        return;
    }
    
    panel.style.display = 'flex';
    chipsContainer.innerHTML = '';
    
    comparisonList.forEach(sn => {
        const school = schoolsData.find(s => s.school_number === sn);
        if (!school) return;
        
        const chip = document.createElement('div');
        chip.className = 'compare-chip';
        chip.innerHTML = `
            <span>${school.school_name}</span>
            <span class="compare-chip-close" data-number="${school.school_number}">×</span>
        `;
        
        chip.querySelector('.compare-chip-close').addEventListener('click', (e) => {
            handleCompareToggle(e.target.dataset.number, false);
        });
        
        chipsContainer.appendChild(chip);
    });
    
    actionBtn.disabled = comparisonList.length < 2;
    actionBtn.textContent = comparisonList.length < 2 
        ? `Select ${2 - comparisonList.length} more to Compare` 
        : `Compare (${comparisonList.length}) Schools`;
}

// Details Modal
function openDetailsModal(school) {
    const overlay = document.getElementById('modal-overlay');
    
    document.getElementById('modal-school-name').textContent = school.school_name;
    document.getElementById('modal-level').textContent = `${school.level} School • Grade Range: ${school.grade_range}`;
    document.getElementById('modal-score-badge').className = `score-badge tier-${school.tier}`;
    document.getElementById('modal-score-badge').textContent = school.composite_score;
    
    // Info details
    document.getElementById('detail-address').textContent = school.address || 'N/A';
    document.getElementById('detail-city').textContent = school.city || 'N/A';
    document.getElementById('detail-postal').textContent = school.postal_code || 'N/A';
    document.getElementById('detail-phone').textContent = school.phone || 'N/A';
    document.getElementById('detail-website').innerHTML = school.website ? `<a href="${school.website}" target="_blank">${school.website}</a>` : 'N/A';
    document.getElementById('detail-email').textContent = school.email || 'N/A';
    document.getElementById('detail-enrolment').textContent = school.enrolment ? school.enrolment.toLocaleString() : 'N/A';
    document.getElementById('detail-programs').textContent = school.fsl_programs.length > 0 ? school.fsl_programs.join(', ') : 'Core French';
    
    // Render boundary maps
    const boundaryMapsContainer = document.getElementById('detail-boundary-maps');
    boundaryMapsContainer.innerHTML = '';
    if (school.boundary_maps && school.boundary_maps.length > 0) {
        document.getElementById('detail-boundary-maps-wrapper').style.display = 'block';
        school.boundary_maps.forEach(mapInfo => {
            const linkTag = document.createElement('a');
            linkTag.href = mapInfo.url;
            linkTag.target = '_blank';
            linkTag.className = 'program-pill';
            linkTag.style.textDecoration = 'none';
            linkTag.style.color = 'var(--accent)';
            linkTag.style.borderColor = 'var(--accent)';
            linkTag.style.background = 'rgba(99, 102, 241, 0.05)';
            linkTag.style.transition = 'var(--transition-fast)';
            linkTag.innerHTML = `🗺️ ${mapInfo.title} ↗`;
            
            // Hover effect
            linkTag.addEventListener('mouseenter', () => {
                linkTag.style.background = 'rgba(99, 102, 241, 0.15)';
            });
            linkTag.addEventListener('mouseleave', () => {
                linkTag.style.background = 'rgba(99, 102, 241, 0.05)';
            });
            
            boundaryMapsContainer.appendChild(linkTag);
        });
    } else {
        document.getElementById('detail-boundary-maps-wrapper').style.display = 'none';
    }
    
    // Google Maps and Locator links
    const mapsLink = document.getElementById('link-google-maps');
    if (school.latitude && school.longitude) {
        mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${school.latitude},${school.longitude}`;
        mapsLink.style.display = 'inline-block';
    } else {
        mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(school.school_name + ' ' + school.city)}`;
        mapsLink.style.display = 'inline-block';
    }
    
    // EQAO Chart renders
    renderEqaoChart(school.eqao, school.level, school.eqao_trend);
    
    // Capacity section renders
    renderCapacityDetails(school.capacity, school.level);
    
    // Demographics section renders
    renderDemographicsDetails(school.demographics);

    // Waterloo section renders
    renderWaterlooDetails(school.waterloo_af, school.level);

    overlay.classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

function renderEqaoChart(eqao, level, eqao_trend) {
    const chart = document.getElementById('modal-eqao-chart');
    chart.innerHTML = '';
    
    if (!eqao || eqao.academic_average === null) {
        chart.innerHTML = '<p class="no-schools-found" style="padding:1rem; font-size:0.9rem;">No EQAO assessment data available for this school.</p>';
        return;
    }
    
    let subjects = [];
    if (level === 'Elementary') {
        subjects = [
            { key: 'gr3_reading', label: 'Grade 3 Reading' },
            { key: 'gr3_writing', label: 'Grade 3 Writing' },
            { key: 'gr3_math', label: 'Grade 3 Math' },
            { key: 'gr6_reading', label: 'Grade 6 Reading' },
            { key: 'gr6_writing', label: 'Grade 6 Writing' },
            { key: 'gr6_math', label: 'Grade 6 Math' }
        ];
    } else {
        subjects = [
            { key: 'gr9_math', label: 'Grade 9 Math' },
            { key: 'osslt', label: 'Grade 10 OSSLT (Literacy)' }
        ];
    }
    
    subjects.forEach(sub => {
        const val = eqao[sub.key];
        let trend = null;
        if (eqao_trend) {
            if (sub.key.includes('math')) {
                trend = eqao_trend.math;
            } else {
                trend = eqao_trend.literacy;
            }
        }
        const trendArrowHTML = getTrendArrowHTML(trend);
        const displayVal = val !== null ? `${Math.round(val * 100)}% ${trendArrowHTML}` : 'No Data';
        const pctFill = val !== null ? val * 100 : 0;
        
        let colorClass = 'success';
        if (pctFill < 50) {
            colorClass = 'danger';
        } else if (pctFill < 75) {
            colorClass = 'warning';
        }
        
        const barItem = document.createElement('div');
        barItem.className = 'chart-bar-item';
        barItem.innerHTML = `
            <div class="chart-bar-header">
                <span class="chart-bar-label">${sub.label}</span>
                <span class="chart-bar-value">${displayVal}</span>
            </div>
            <div class="progress-bar-wrapper">
                <div class="progress-bar-fill ${colorClass}" style="width: 0%"></div>
            </div>
        `;
        chart.appendChild(barItem);
        
        // Trigger animation
        setTimeout(() => {
            barItem.querySelector('.progress-bar-fill').style.width = `${pctFill}%`;
        }, 100);
    });
}

function renderWaterlooDetails(waterloo_af, level) {
    const section = document.getElementById('modal-waterloo-section');
    const content = document.getElementById('modal-waterloo-content');
    
    if (level !== 'Secondary' || !waterloo_af) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    content.innerHTML = '';
    
    const factor = waterloo_af.factor;
    const isDefault = waterloo_af.is_default;
    
    let colorClass = 'success';
    let descText = 'Excellent alignment between high school grades and university engineering performance.';
    
    if (factor > 13.5) {
        colorClass = 'danger';
        descText = 'Historical performance drop is higher than average, requiring stronger admission averages.';
    } else if (factor > 11.5) {
        colorClass = 'warning';
        descText = 'Moderate alignment between high school grades and university engineering performance.';
    }
    
    const pct = Math.max(0, Math.min(100, ((20 - factor) / 12.0) * 100));
    
    content.innerHTML = `
        <div class="waterloo-factor-container ${isDefault ? 'default-factor' : 'specific-factor'}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                <div>
                    <span class="waterloo-factor-value ${colorClass}">${factor.toFixed(1)}%</span>
                    <span class="badge-tag ${isDefault ? 'yellow' : 'green'}" style="margin-left: 0.5rem; font-size: 0.7rem;">
                        ${isDefault ? 'Default Value' : 'Specific School Value'}
                    </span>
                </div>
            </div>
            <div class="progress-bar-wrapper" style="height: 8px;">
                <div class="progress-bar-fill ${colorClass}" style="width: 0%"></div>
            </div>
            <p class="waterloo-desc" style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.5rem; line-height:1.3;">
                ${isDefault 
                    ? 'This school uses the general Ontario default adjustment factor due to insufficient cohort size sending students to Waterloo Engineering. A default factor is typically less favorable than a specific school factor.' 
                    : descText}
            </p>
            <p class="waterloo-note" style="font-size:0.7rem; color:var(--text-muted); margin-top:0.25rem; font-style:italic;">
                *The UW Engineering Adjustment Factor measures the historical drop between Grade 12 admission averages and 1st year Engineering GPA. A lower number indicates more rigorous grading alignment.
            </p>
        </div>
    `;
    
    setTimeout(() => {
        const fill = content.querySelector('.progress-bar-fill');
        if (fill) fill.style.width = `${pct}%`;
    }, 100);
}

function renderCapacityDetails(capacity, level) {
    const container = document.getElementById('modal-capacity-section');
    container.innerHTML = '';
    
    if (level === 'Secondary') {
        container.innerHTML = `
            <div class="capacity-gauge-container" style="border-left: 4px solid var(--text-muted);">
                <div class="capacity-percent-large" style="color: var(--text-muted); font-size: 1.5rem;">N/A</div>
                <div class="capacity-text-summary">
                    <div style="font-weight:700;">Capacity Data Not Centralized</div>
                    <div class="capacity-description">High school capacity varies significantly by specialized program offerings. Check OCDSB planning documents for specific boundary reviews.</div>
                </div>
            </div>
        `;
        return;
    }
    
    if (!capacity || capacity.utilization_rate_pct === null) {
        container.innerHTML = '<p class="no-schools-found" style="padding:1rem; font-size:0.9rem;">No capacity or utilization reports available for this elementary school.</p>';
        return;
    }
    
    const pct = Math.round(capacity.utilization_rate_pct * 100);
    let borderStyle = '';
    let statusText = '';
    let statusDesc = '';
    let colorClass = '';
    
    if (pct >= 85 && pct <= 100) {
        borderStyle = 'border-left: 4px solid var(--success);';
        colorClass = 'var(--success)';
        statusText = 'Ideal Capacity Utilization';
        statusDesc = 'Stable building operations, efficient classroom allocation, and lower risk of school closures or boundary restrictions.';
    } else if (pct > 100 && pct <= 110) {
        borderStyle = 'border-left: 4px solid var(--warning);';
        colorClass = 'var(--warning)';
        statusText = 'Slightly Overcrowded';
        statusDesc = 'Operating slightly above official classroom capacity. Likely using a small number of portables. High occupancy constraints on gym and common facilities.';
    } else if (pct > 110) {
        borderStyle = 'border-left: 4px solid var(--danger);';
        colorClass = 'var(--danger)';
        statusText = 'Severely Overcrowded';
        statusDesc = 'High volume of portable classrooms on-site. Gym, libraries, and lunch rooms face severe logistical scheduling constraints. High risk of boundary restrictions.';
    } else if (pct >= 70 && pct < 85) {
        borderStyle = 'border-left: 4px solid var(--warning);';
        colorClass = 'var(--warning)';
        statusText = 'Underutilized';
        statusDesc = 'Operating with spare classroom space. Low risk of overcrowding, but potential candidate for program consolidations or boundary expansions.';
    } else {
        borderStyle = 'border-left: 4px solid var(--danger);';
        colorClass = 'var(--danger)';
        statusText = 'Severely Underutilized';
        statusDesc = 'Operating far below capacity. High risk of school consolidation, program redirection, or potential pupil accommodation review closures.';
    }
    
    container.innerHTML = `
        <div class="capacity-gauge-container" style="${borderStyle}">
            <div class="capacity-percent-large" style="color: ${colorClass};">${pct}%</div>
            <div class="capacity-text-summary">
                <div style="font-weight:700; color: ${colorClass};">${statusText}</div>
                <div class="capacity-description">${statusDesc}</div>
            </div>
        </div>
        <div class="detail-grid" style="margin-top: 1rem;">
            <div class="detail-item">
                <span class="detail-label">On-The-Ground Capacity</span>
                <span class="detail-value" style="font-weight:700;">${capacity.otg_capacity || 'N/A'} student slots</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Oct 2023 Enrolment</span>
                <span class="detail-value" style="font-weight:700;">${capacity.enrolment_oct23 || 'N/A'} students</span>
            </div>
        </div>
    `;
}

function renderDemographicsDetails(demo) {
    const container = document.getElementById('modal-demographics-section');
    container.innerHTML = '';
    
    if (!demo || demo.low_income_pct === null) {
        container.innerHTML = '<p class="no-schools-found" style="padding:1rem; font-size:0.9rem;">Demographics metrics not available.</p>';
        return;
    }
    
    const list = [
        { label: 'Low-Income Households', val: demo.low_income_pct, desc: 'Proportion of students from families under the Low-Income Measure.' },
        { label: 'Special Education Services', val: demo.special_ed_pct, desc: 'Students receiving special education support (includes individual education plans).' },
        { label: 'Gifted Identification', val: demo.gifted_pct, desc: 'Students officially identified as gifted.' },
        { label: 'English Language Learners', val: demo.ell_pct, desc: 'Students whose first language is not English.' },
        { label: 'Newcomers to Canada', val: demo.newcomer_pct, desc: 'Students who arrived in Canada from non-English speaking countries in the last 3-4 years.' }
    ];
    
    list.forEach(item => {
        const valPct = item.val !== null ? Math.round(item.val * 100) : 0;
        const displayVal = item.val !== null ? `${valPct}%` : 'N/A';
        
        const row = document.createElement('div');
        row.className = 'chart-bar-item';
        row.style.marginBottom = '0.5rem';
        row.innerHTML = `
            <div class="chart-bar-header">
                <span class="chart-bar-label" style="font-weight:600; color:var(--text-primary);">${item.label}</span>
                <span class="chart-bar-value">${displayVal}</span>
            </div>
            <div class="progress-bar-wrapper" style="height:6px;">
                <div class="progress-bar-fill" style="background-color: var(--text-secondary); width: 0%;"></div>
            </div>
            <span style="font-size:0.7rem; color:var(--text-muted);">${item.desc}</span>
        `;
        container.appendChild(row);
        
        setTimeout(() => {
            row.querySelector('.progress-bar-fill').style.width = `${valPct}%`;
        }, 100);
    });
}

// Compare Overlay Matrix modal
function openCompareModal() {
    if (comparisonList.length < 2) return;
    
    const overlay = document.getElementById('compare-overlay');
    const tableContainer = document.getElementById('compare-matrix-container');
    tableContainer.innerHTML = '';
    
    const schools = comparisonList.map(sn => schoolsData.find(s => s.school_number === sn)).filter(Boolean);
    
    let headersHTML = '<th>Metric / Dimension</th>';
    schools.forEach(s => {
        headersHTML += `
            <th style="width: 22%;">
                <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">${s.level}</div>
                <div style="font-size:1rem; font-weight:800; line-height:1.2; margin: 0.25rem 0;">${s.school_name}</div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">${s.grade_range} • ${s.city}</div>
            </th>
        `;
    });
    
    // Helper to generate a matrix row
    const makeRow = (label, extractor, formatFn) => {
        let cells = `<td><strong>${label}</strong></td>`;
        schools.forEach(s => {
            const val = extractor(s);
            cells += `<td>${formatFn(val, s)}</td>`;
        });
        return `<tr>${cells}</tr>`;
    };
    
    const formatPercent = (val) => val !== null && val !== undefined ? `${Math.round(val * 100)}%` : 'N/A';
    
    let tableBodyHTML = '';
    
    // 1. Scores
    tableBodyHTML += makeRow('Composite Rank Score', s => s.composite_score, (val, s) => {
        let tierClass = `tier-${s.tier}`;
        return `<span class="badge-tag ${tierClass}" style="font-size:0.9rem; padding:0.25rem 0.5rem;">${val} (Tier ${s.tier})</span>`;
    });
    
    tableBodyHTML += makeRow('Math Score (EQAO)', s => s.scores.math, (val) => val !== null ? `${Math.round(val)}/100` : 'N/A');
    tableBodyHTML += makeRow('Literacy Score (EQAO)', s => s.scores.literacy, (val) => val !== null ? `${Math.round(val)}/100` : 'N/A');
    tableBodyHTML += makeRow('Capacity Score', s => s.scores.capacity, (val) => val !== null ? `${Math.round(val)}/100` : 'N/A (Secondary)');
    tableBodyHTML += makeRow('Programs Score', s => s.scores.programs, (val) => `${Math.round(val)}/100`);
    tableBodyHTML += makeRow('Socio-Economic Index Score', s => s.scores.demographics, (val) => val !== null ? `${Math.round(val)}/100` : 'N/A');
    
    // 2. Capacity Details
    tableBodyHTML += `<tr><td colspan="${schools.length + 1}" style="background-color:rgba(0,0,0,0.02); font-weight:700; font-size:0.8rem; text-transform:uppercase; color:var(--accent);">Enrollment & Capacity</td></tr>`;
    tableBodyHTML += makeRow('Total Enrolment', s => s.enrolment, (val) => val ? val.toLocaleString() : 'N/A');
    tableBodyHTML += makeRow('On-The-Ground Capacity', s => s.capacity ? s.capacity.otg_capacity : null, (val) => val ? val.toLocaleString() : 'N/A');
    tableBodyHTML += makeRow('Utilization Rate', s => s.capacity ? s.capacity.utilization_rate_pct : null, (val) => formatPercent(val));
    
    // 3. EQAO Breakdown
    tableBodyHTML += `<tr><td colspan="${schools.length + 1}" style="background-color:rgba(0,0,0,0.02); font-weight:700; font-size:0.8rem; text-transform:uppercase; color:var(--accent);">EQAO Achievements (3-Year Avg)</td></tr>`;
    tableBodyHTML += makeRow('Grade 3 Reading', s => s.eqao ? s.eqao.gr3_reading : null, formatPercent);
    tableBodyHTML += makeRow('Grade 3 Writing', s => s.eqao ? s.eqao.gr3_writing : null, formatPercent);
    tableBodyHTML += makeRow('Grade 3 Math', s => s.eqao ? s.eqao.gr3_math : null, formatPercent);
    tableBodyHTML += makeRow('Grade 6 Reading', s => s.eqao ? s.eqao.gr6_reading : null, formatPercent);
    tableBodyHTML += makeRow('Grade 6 Writing', s => s.eqao ? s.eqao.gr6_writing : null, formatPercent);
    tableBodyHTML += makeRow('Grade 6 Math', s => s.eqao ? s.eqao.gr6_math : null, formatPercent);
    tableBodyHTML += makeRow('Grade 9 Math', s => s.eqao ? s.eqao.gr9_math : null, formatPercent);
    tableBodyHTML += makeRow('Grade 10 OSSLT (Literacy)', s => s.eqao ? s.eqao.osslt : null, formatPercent);
    tableBodyHTML += makeRow('Academic EQAO Trend (Overall)', s => s.eqao_trend ? s.eqao_trend.overall : null, (val) => {
        if (!val) return 'N/A';
        const label = val.charAt(0).toUpperCase() + val.slice(1);
        let arrow = '→';
        let colorClass = 'trend-stable';
        if (val === 'improving') { arrow = '↑'; colorClass = 'trend-improving'; }
        else if (val === 'declining') { arrow = '↓'; colorClass = 'trend-declining'; }
        return `<span class="trend-arrow ${colorClass}">${arrow}</span> ${label}`;
    });
    
    // 4. Demographics
    tableBodyHTML += `<tr><td colspan="${schools.length + 1}" style="background-color:rgba(0,0,0,0.02); font-weight:700; font-size:0.8rem; text-transform:uppercase; color:var(--accent);">Demographics & Community</td></tr>`;
    tableBodyHTML += makeRow('Low-Income Households', s => s.demographics ? s.demographics.low_income_pct : null, formatPercent);
    tableBodyHTML += makeRow('Parents with No Degree', s => s.demographics ? s.demographics.parents_no_degree_pct : null, formatPercent);
    tableBodyHTML += makeRow('Special Education Services', s => s.demographics ? s.demographics.special_ed_pct : null, formatPercent);
    tableBodyHTML += makeRow('Gifted Students', s => s.demographics ? s.demographics.gifted_pct : null, formatPercent);
    tableBodyHTML += makeRow('English Language Learners', s => s.demographics ? s.demographics.ell_pct : null, formatPercent);
    
    // 5. University Admissions (Waterloo AF)
    tableBodyHTML += `<tr><td colspan="${schools.length + 1}" style="background-color:rgba(0,0,0,0.02); font-weight:700; font-size:0.8rem; text-transform:uppercase; color:var(--accent);">University Admissions</td></tr>`;
    tableBodyHTML += makeRow('UW Engineering Adjustment Factor', s => s.waterloo_af, (val) => {
        if (!val) return 'N/A (Elementary)';
        const factor = val.factor;
        const isDefault = val.is_default;
        
        let colorClass = 'success';
        if (factor > 13.5) colorClass = 'danger';
        else if (factor > 11.5) colorClass = 'warning';
        
        return `
            <span class="waterloo-factor-value ${colorClass}" style="font-size:1.1rem; display:block;">${factor.toFixed(1)}%</span>
            <span class="badge-tag ${isDefault ? 'yellow' : 'green'}" style="font-size:0.6rem; padding: 0.05rem 0.2rem; margin-top:2px; display:inline-block;">
                ${isDefault ? 'Default' : 'Specific'}
            </span>
        `;
    });
    
    // 6. General Info
    tableBodyHTML += `<tr><td colspan="${schools.length + 1}" style="background-color:rgba(0,0,0,0.02); font-weight:700; font-size:0.8rem; text-transform:uppercase; color:var(--accent);">School Information</td></tr>`;
    tableBodyHTML += makeRow('FSL Programs Offered', s => s.fsl_programs, (val) => val.length > 0 ? val.join('<br>') : 'Core French');
    tableBodyHTML += makeRow('Address', s => `${s.address}, ${s.city}`, (val) => val);
    tableBodyHTML += makeRow('Website Link', s => s.website, (val) => val ? `<a href="${val}" target="_blank" style="color:var(--accent); text-decoration:none;">Visit Website ↗</a>` : 'N/A');
    
    tableContainer.innerHTML = `
        <table class="compare-matrix-table">
            <thead>
                <tr>${headersHTML}</tr>
            </thead>
            <tbody>
                ${tableBodyHTML}
            </tbody>
        </table>
    `;
    
    overlay.classList.add('active');
}

function closeCompareModal() {
    document.getElementById('compare-overlay').classList.remove('active');
}

// Leaflet Map Integration Functions
function initMap() {
    if (map !== null) {
        // Map already exists, just trigger resize update
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
        return;
    }
    
    // Initialize map centered on Ottawa
    map = L.map('map').setView([45.38, -75.7], 11);
    
    // Add CartoDB Positron (light) tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);
    
    // Trigger map resize update
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}

function renderMapMarkers() {
    if (!map) return;
    
    // Clear old markers
    mapMarkers.forEach(marker => map.removeLayer(marker));
    mapMarkers = [];
    
    const validSchools = filteredSchools.filter(school => school.latitude && school.longitude);
    
    if (validSchools.length === 0) {
        return;
    }
    
    validSchools.forEach(school => {
        const lat = school.latitude;
        const lng = school.longitude;
        const tier = school.tier;
        const score = school.composite_score;
        
        let color = 'var(--tier-2)'; // Blue
        if (tier === 1) color = 'var(--tier-1)'; // Green
        if (tier === 3) color = 'var(--tier-3)'; // Orange/Yellow
        
        // Custom Leaflet DivIcon containing SVG marker colored by tier and labeled with score
        const markerIcon = L.divIcon({
            className: 'custom-map-marker',
            html: `
                <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 5px rgba(0,0,0,0.5));">
                        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
                    </svg>
                    <span style="position: absolute; top: 7px; font-size: 0.75rem; font-weight: 800; color: #ffffff; font-family: var(--font-display);">${score}</span>
                </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 36],
            popupAnchor: [0, -32]
        });
        
        const marker = L.marker([lat, lng], { icon: markerIcon });
        
        // Create popup card content
        const eqaoVal = school.eqao && school.eqao.academic_average !== null 
            ? `${Math.round(school.eqao.academic_average * 100)}%${getTrendArrowHTML(school.eqao_trend ? school.eqao_trend.overall : null)}` 
            : 'N/A';
        const utilizationVal = school.capacity && school.capacity.utilization_rate_pct !== null
            ? `${Math.round(school.capacity.utilization_rate_pct * 100)}%`
            : 'N/A';
            
        const popupContent = document.createElement('div');
        popupContent.className = 'map-popup-card';
        popupContent.innerHTML = `
            <div class="map-popup-title">${school.school_name}</div>
            <div class="map-popup-meta">${school.level} School • Grades ${school.grade_range}</div>
            <div class="card-divider" style="margin: 0.25rem 0; height: 1px; background-color: var(--border-color); width: 100%;"></div>
            <div class="map-popup-meta" style="margin-bottom: 0.25rem;">📍 ${school.address}, ${school.city}</div>
            <div class="map-popup-score-row" style="font-size:0.8rem; margin-bottom: 0.2rem;">
                <span style="color:var(--text-secondary);">Rank Score:</span>
                <span class="badge-tag tier-${school.tier}" style="font-weight: 700;">${score} (Tier ${school.tier})</span>
            </div>
            <div class="map-popup-score-row" style="font-size:0.75rem; margin-bottom: 0.2rem;">
                <span style="color:var(--text-secondary);">EQAO Average:</span>
                <span style="font-weight: 600;">${eqaoVal}</span>
            </div>
            <div class="map-popup-score-row" style="font-size:0.75rem; margin-bottom: 0.4rem;">
                <span style="color:var(--text-secondary);">Utilization:</span>
                <span style="font-weight: 600;">${utilizationVal}</span>
            </div>
            <button class="map-popup-btn">View Full Details</button>
        `;
        
        // Add click listener inside popup
        popupContent.querySelector('.map-popup-btn').addEventListener('click', () => {
            openDetailsModal(school);
        });
        
        marker.bindPopup(popupContent);
        marker.addTo(map);
        mapMarkers.push(marker);
    });
    
    // Auto-fit bounds to active markers
    const group = new L.featureGroup(mapMarkers);
    map.fitBounds(group.getBounds().pad(0.1));
}
