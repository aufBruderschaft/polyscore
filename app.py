from flask import Flask, render_template, request
from werkzeug.exceptions import HTTPException
import sqlite3
import pandas as pd
import os

app = Flask(__name__)
BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE, 'poly.db')

segments = {
    'all': {'group': 'all crypto', 'noun': 'crypto'},
    'TGE': {'group': 'TGE', 'noun': 'TGE'},
}

ERRORS = {
    400: ("that request didn't make sense", 'Was this request valid?'),
    404: ("this page doesn't exist", None),
    405: ("this action isn't allowed here", 'Is this method allowed here?'),
    500: ('something broke on our side', 'Will the server hold up?'),
}

def query(sql, params=()):
    conn = sqlite3.connect(DB)
    df = pd.read_sql(sql, conn, params=params)
    conn.close()
    return df
def build_dashboard(seg):
    info = segments[seg]
    group = query('SELECT * FROM groups WHERE "group" = ?', (info['group'],)).iloc[0]
    data = {
            'seg': seg,
            'title': info['group'],
            'noun': info['noun'],
            'n': int(group['n']),
            'yes_rate': float(group['yes_rate']),
            'difficulty': int(group['difficulty']),
            'horizons': {},
            }
    for d in [30, 7 ,1]:
        buckets = query('''SELECT bucket, n, mean_price, yes_rate, ci_low, ci_high, gap, inrangeCI
        FROM big_table WHERE seg = ? AND days = ? AND n > 0''', (seg, d))
        p = float(group[f'p{d}'])
        gap = (p - group['yes_rate']) * 100
        day_word = 'day' if d == 1  else 'days'

        if gap > 1:
            verdict = f'The crowd overpaid for YES by {gap:.1f} points.'
        elif gap < -1:
            verdict = f'The crowd was too pessimistic, {abs(gap):.1f} points under.'
        else:
            verdict = f'The crowd was almost exactly right on average.'
        desc = (f"Across {data['n']:,} closed {info['noun']} markets (volume > $100k, open 30+ days), "
                f"the crowd gave YES a {p:.1%} chance on average {d} {day_word} before close, "
                f"and {data['yes_rate']:.1%} resolved YES. {verdict}")
        data['horizons'][d] = {
        'p': p,
        'gap': round(gap, 1),
        'desc': desc,
        'brier': float(group[f'brier{d}']),
        'buckets': buckets.to_dict(orient='records'),
    }
    top_markets = 'SELECT question, volumeNum, p30, p7, p1, yes_won FROM markets'
    if seg == 'TGE':
        top_markets +=' WHERE istge =1'
    top_markets += ' ORDER BY volumeNum DESC LIMIT 5'
    data['top'] = query(top_markets).to_dict(orient='records')
    data['groups'] = query('SELECT * FROM groups').to_dict(orient='records')
    return data
def market_stats():
    return query('SELECT COUNT(*) AS markets, COUNT(DISTINCT event_id) AS events, SUM(istge) AS tge FROM markets').iloc[0]
def methodology_data(name):
    row = query('SELECT * FROM groups WHERE "group" = ?', (name,)).iloc[0]
    return {
        30: float(row['brier30']),
        7: float(row['brier7']),
        1: float(row['brier1']),
        'difficulty': int(row['difficulty']),
    }



@app.route('/')
def index():
    return render_template('index.html', data=build_dashboard('all'))

@app.route('/tge')
def tge():
    return render_template('index.html', data=build_dashboard('TGE'))

@app.route('/info')
def info():
    meta = query('SELECT name, value FROM meta').set_index('name')['value']
    stats = market_stats()
    allcrypto = methodology_data('all crypto')
    tge = methodology_data('TGE')
    smallbucket = int(query("SELECT COUNT(*) AS k FROM big_table WHERE seg = 'TGE' AND days = 1 AND n < 5").iloc[0]['k'])
    biggestm = int(query("SELECT COUNT(*) AS k FROM markets GROUP BY event_id ORDER BY k DESC LIMIT 1").iloc[0]['k'])

    steps = [
        (meta['fetched'], 'closed crypto markets with volume over $100k'),
        (meta['valid_dates'], 'with valid open and close dates'),
        (meta['open30d'], 'open for at least 30 days'),
        (stats['markets'], 'with prices at 30, 7 and 1 day and a clean outcome'),
        (stats['tge'], 'token-launch markets around a TGE: FDV, launch, airdrop, sale'),
    ]
    top = steps[0][0]
    funnel = []
    for n, label in steps:
        funnel.append({'n': int(n), 'label': label, 'width': n / top * 100})
    return render_template('info.html', funnel= funnel, events=int(stats['events']),
                           markets=int(stats['markets']), allcrypto=allcrypto, tge=tge, smallbucket=smallbucket, biggestm=biggestm)

@app.route('/contacts')
def contacts():
    stats = market_stats()

    return render_template('contacts.html',
                           markets=int(stats['markets']),
                           events=int(stats['events']),
                           tge=int(stats['tge'])
                           )

@app.errorhandler(HTTPException)
def error(e):
    text, market = ERRORS.get(e.code, ('smt. went. wrong.', None))
    if market is None:
        market = f'Will {request.path} exist?'
    return render_template('error.html', code=e.code, text=text,market=market), e.code


if __name__ == '__main__':
    app.run(debug=True, port=5001)
