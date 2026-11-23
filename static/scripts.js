history.scrollRestoration = 'manual';
const state = { days: 30 };
function css(name){
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};
function axis(title) {
    return {
        title: {text: title, font: { size: 12, color: css('--muted') } },
        range: [-0.02, 1.02],
        tickformat: '.0%',
        dtick: 0.2,
        gridcolor: css('--border'),
        linecolor: css('--border'),
        zeroline: false,
        fixedrange: true,
        tickfont: { family: 'JetBrains Mono', size: 11, color: css('--muted') },
    };
}
function percent(x) {
    return (x * 100).toFixed(1) + '%';
};
function render_chart() {
    const buckets = DATA.horizons[state.days].buckets;
    const zone = {
        x: [0, 1, 1],
        y: [0, 1, 0],
        fill: 'toself',
        mode: 'none',
        fillcolor: css('--accent-soft'),
        hoverinfo: 'skip',
    };
    const diagonal = {
        x: [0, 1],
        y: [0, 1],
        mode: 'lines',
        line: { color: css('--muted'), width: 1.5, dash: 'dash'},
        hoverinfo: 'skip',
    }
    const points = {
        x: buckets.map(function(b) { return b.mean_price; }),
        y: buckets.map(function(b) { return b.yes_rate}),
        mode: 'markers',
        marker: {
            size: buckets.map(function(b) { return Math.sqrt(b.n) + 8}),
            color: css('--accent'),
            line: { color: css('--surface'), width: 2 },
        },
        error_y: {
            type: 'data',
            symmetric: false,
            array: buckets.map(function(b) { return b.ci_high - b.yes_rate; }),
            arrayminus: buckets.map(function(b) { return b.yes_rate - b.ci_low; }),
            color: css('--accent'),
            thickness: 1.5,
            width: 0,
        },
        customdata: buckets.map(function (b) { return [b.bucket, b.n, b.ci_low, b.ci_high]; }),
        hovertemplate: '<b>%{customdata[0]}</b><br>' +
                        'said %{x:.1%}<br>' +
                        'happened %{y:.1%}<br>' +
                        '95% CI %{customdata[2]:.0%}-%{customdata[3]:.0%}<br>' +
                        'n = %{customdata[1]}' +
                        '<extra></extra>',
    };
    const layout = {
    margin: { t: 8, r: 8, b: 52, l: 56 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    showlegend: false,
    hoverlabel: {
        bgcolor: css('--text'),
        bordercolor: css('--text'),
        font: { family: 'JetBrains Mono', size: 11, color: css('--bg') },
    },
    font: { family: 'Inter', color: css('--text-2') },
    xaxis: axis(`market price ${state.days} ${state.days === 1 ? 'day': 'days'} before close`),
    yaxis: axis('share that resolved YES'),
    annotations: [
        {
            x: 0.97, y: 0.05,
            text: 'overpriced YES',
            showarrow: false,
            xanchor: 'right',
            font: { family: 'JetBrains Mono', size: 11, color: css('--accent') },
        },
        {
            x: 0.03, y: 0.95,
            text: 'underpriced YES',
            showarrow: false,
            xanchor: 'left',
            font: { family: 'JetBrains Mono', size: 11, color: css('--muted') },
        },
    ]
    };
    Plotly.react('chart', [zone, diagonal, points], layout, {displayModeBar: false, responsive: true, staticPlot: matchMedia('(pointer: coarse)').matches });
};

function render_buckets() {
    const buckets = DATA.horizons[state.days].buckets;
    let offDiagonal = 0;

    const rows = buckets.map(function(b) {
        const crossesDiagonal = b.inrangeCI === 1;
        if (!crossesDiagonal) offDiagonal++;
        const sign = b.gap > 0 ? '+': '';
        return `<tr>
            <td class='strong'><span class='${crossesDiagonal ? 'nomiss': 'miss'}'></span>${b.bucket}</td>
            <td>${b.n}</td>
            <td>${percent(b.mean_price)}</td>
            <td>${percent(b.yes_rate)}</td>
            <td class='${crossesDiagonal ? '' : 'strong'}'>${sign}${b.gap.toFixed(1)}</td>
        </tr>`
        ;
    });
    document.getElementById('bucket-body').innerHTML = rows.join('')
    document.getElementById('ci-count').textContent = `${offDiagonal}/${buckets.length} off the diagonal.`
    let worst = null;
    for (const b of buckets) {
        if (b.n < 10) continue;
        if (worst === null || Math.abs(b.gap) > Math.abs(worst.gap)) worst = b;
    }
    const note = document.getElementById('bucket-note');
    if (worst === null) {
        note.textContent = '';
        return;
    }
    const word = worst.gap > 0 ? 'overpriced' : 'underpriced';
    note.textContent = `Biggest miss (n ≥ 10): in the ${worst.bucket} bucket the crowd gave YES a ${percent(worst.mean_price)} chance, but ${percent(worst.yes_rate)} resolved YES (n = ${worst.n}) — ${word} by ${Math.abs(worst.gap).toFixed(1)} points.`
};

function render_hero() {
    const d = state.days;
    const h = DATA.horizons[d];
    const dayWord = d === 1 ? 'day': 'days';
    const sign = h.gap > 0 ? '+': '';

    animate_percents(document.getElementById('hero-p'), h.p);
    document.getElementById('hero-kicker').textContent = `${DATA.title} · n = ${DATA.n.toLocaleString('en-US')} · ${d} ${dayWord} before close`;
    document.getElementById('hero-desc').textContent = h.desc;

    const gapEl = document.getElementById('st-gap');
    gapEl.textContent = `${sign}${h.gap.toFixed(1)} points`;
    gapEl.classList.toggle('hot', Math.abs(h.gap) > 1);

    document.getElementById('st-brier').textContent = h.brier.toFixed(3)
};
function highlight_brier() {
    const cells = document.querySelectorAll('[data-col]');
    for (const el of cells) {
        el.classList.toggle('hl', Number(el.dataset.col) === state.days);
    }
};



function render() {
    render_hero();
    render_chart();
    render_buckets();
    highlight_brier();
}
render();

const buttons = document.querySelectorAll('[data-days]');
for (const btn of buttons) {
    btn.addEventListener('click', function() {
        state.days = Number(btn.dataset.days);
        for (const b of buttons) {
            b.classList.toggle('active', b === btn);
        }
        render();
    })
}
document.getElementById('theme-btn').addEventListener('click', render_chart);
function on_scroll() {
    const p = Math.min(window.scrollY / window.innerHeight, 1);
    document.documentElement.style.setProperty('--p', p.toFixed(3));
}
window.addEventListener('scroll', on_scroll)
on_scroll();

function animate_percents(el, to) {
    const from = el.dataset.value ? Number(el.dataset.value): to;
    const start = performance.now();
    cancelAnimationFrame(Number(el.dataset.raf));
    
    function frame(now) {
        const t = Math.min((now - start) / 600, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const value = from + (to - from) * eased;
        el.textContent = percent(value);
        el.dataset.value = value;
        if (t < 1) el.dataset.raf = requestAnimationFrame(frame);
    }
    el.dataset.raf = requestAnimationFrame(frame);
}
function json_regex(json) {
    const safe = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const pattern = /("(?:\\.|[^"\\])*")(\s*:)?|-?\d+(?:\.\d+)?/g;
    return safe.replace(pattern, function(match, str, colon) {
        if(str && colon) return `<span class="j-key">${str}</span>${colon}`;
        if(str) return `<span class="j-str">${str}</span>`;
        return `<span class="j-num">${match}</span>`;
    });
}
function highlight_json() { 
    const json = JSON.stringify(DATA, null, 2);
    document.getElementById('hero-bg').innerHTML = json_regex(json);
}
function place_fade() {
    const logo = document.querySelector('.header .logo').getBoundingClientRect();
    const bg = document.getElementById('hero-bg');
    bg.style.setProperty('--fx', (logo.left + logo.width / 2) + 'px');
    bg.style.setProperty('--fy', (logo.bottom + 60) + 'px');
}
highlight_json();
place_fade();
window.addEventListener('resize', place_fade);