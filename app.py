from flask import Flask, g, jsonify, request, render_template, send_from_directory
import sqlite3
import os
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'data.db')
UPLOAD_DIR = os.path.join(BASE_DIR, 'static', 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = Flask(__name__, static_folder='static', template_folder='templates')

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
    return db

def init_db():
    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS columns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            column_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            link TEXT,
            description TEXT,
            icon TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(column_id) REFERENCES columns(id)
        )
    ''')
    db.commit()

    # ensure some default columns exist
    cursor.execute('SELECT COUNT(1) as c FROM columns')
    if cursor.fetchone()['c'] == 0:
        cursor.executemany('INSERT INTO columns(name, position) VALUES(?, ?)',
                           [('Work', 0), ('Personal', 1), ('Tools', 2)])
        db.commit()
    # settings table (single-row)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            dashboard_title TEXT DEFAULT 'Start Dashboard',
            dashboard_bg_image TEXT,
            cols_per_row INTEGER DEFAULT 3,
            column_width INTEGER DEFAULT 320,
            card_height INTEGER DEFAULT 0,
            column_bg_color TEXT DEFAULT '#ffffff',
            column_bg_opacity REAL DEFAULT 1.0,
            card_bg_color TEXT DEFAULT '#ffffff',
            card_bg_opacity REAL DEFAULT 1.0
        )
    ''')
    cursor.execute('SELECT COUNT(1) as c FROM settings')
    if cursor.fetchone()['c'] == 0:
        cursor.execute('INSERT INTO settings(id) VALUES(1)')
        db.commit()
    else:
        # ensure new columns exist in older DBs
        cur = db.cursor()
        cur.execute("PRAGMA table_info(settings)")
        cols = {r['name'] for r in cur.fetchall()}
        adds = []
        if 'column_bg_color' not in cols:
            adds.append("ALTER TABLE settings ADD COLUMN column_bg_color TEXT DEFAULT '#ffffff'")
        if 'column_bg_opacity' not in cols:
            adds.append("ALTER TABLE settings ADD COLUMN column_bg_opacity REAL DEFAULT 1.0")
        if 'card_bg_color' not in cols:
            adds.append("ALTER TABLE settings ADD COLUMN card_bg_color TEXT DEFAULT '#ffffff'")
        if 'card_bg_opacity' not in cols:
            adds.append("ALTER TABLE settings ADD COLUMN card_bg_opacity REAL DEFAULT 1.0")
        for q in adds:
            try:
                cur.execute(q)
            except Exception:
                pass
        if adds:
            db.commit()

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/state')
def api_state():
    db = get_db()
    cur = db.cursor()
    cur.execute('SELECT * FROM columns ORDER BY position')
    cols = []
    for row in cur.fetchall():
        col = dict(row)
        cur2 = db.cursor()
        cur2.execute('SELECT * FROM cards WHERE column_id = ? ORDER BY position', (col['id'],))
        cards = [dict(r) for r in cur2.fetchall()]
        col['cards'] = cards
        cols.append(col)
    return jsonify({'columns': cols})


@app.route('/api/settings')
def api_get_settings():
    db = get_db()
    cur = db.cursor()
    cur.execute('SELECT dashboard_title, dashboard_bg_image, cols_per_row, column_width, card_height, column_bg_color, column_bg_opacity, card_bg_color, card_bg_opacity FROM settings WHERE id = 1')
    row = cur.fetchone()
    if not row:
        return jsonify({}), 404
    return jsonify(dict(row))


@app.route('/api/settings', methods=['PUT'])
def api_update_settings():
    data = request.get_json() or {}
    allowed = ['dashboard_title', 'dashboard_bg_image', 'cols_per_row', 'column_width', 'card_height', 'column_bg_color', 'column_bg_opacity', 'card_bg_color', 'card_bg_opacity']
    fields = []
    values = []
    for k in allowed:
        if k in data:
            fields.append(f"{k} = ?")
            values.append(data[k])
    if not fields:
        return jsonify({'error': 'no fields provided'}), 400
    values.append(1)
    db = get_db()
    cur = db.cursor()
    cur.execute(f"UPDATE settings SET {', '.join(fields)} WHERE id = ?", tuple(values))
    db.commit()
    cur.execute('SELECT dashboard_title, dashboard_bg_image, cols_per_row, column_width, card_height, column_bg_color, column_bg_opacity, card_bg_color, card_bg_opacity FROM settings WHERE id = 1')
    row = cur.fetchone()
    return jsonify(dict(row))

@app.route('/api/card', methods=['POST'])
def api_add_card():
    data = request.get_json() or {}
    title = data.get('title')
    column_id = data.get('column_id')
    link = data.get('link', '')
    description = data.get('description', '')
    icon = data.get('icon', '')

    if not title or not column_id:
        return jsonify({'error': 'missing title or column_id'}), 400

    db = get_db()
    cur = db.cursor()
    cur.execute('SELECT IFNULL(MAX(position), -1) + 1 as nextpos FROM cards WHERE column_id = ?', (column_id,))
    nextpos = cur.fetchone()['nextpos']
    cur.execute('INSERT INTO cards(column_id, title, link, description, icon, position) VALUES(?,?,?,?,?,?)',
                (column_id, title, link, description, icon, nextpos))
    db.commit()
    card_id = cur.lastrowid
    cur.execute('SELECT * FROM cards WHERE id = ?', (card_id,))
    card = dict(cur.fetchone())
    return jsonify(card), 201


@app.route('/api/card/<int:card_id>', methods=['PUT', 'DELETE'])
def api_modify_card(card_id):
    db = get_db()
    cur = db.cursor()
    if request.method == 'DELETE':
        cur.execute('DELETE FROM cards WHERE id = ?', (card_id,))
        db.commit()
        return ('', 204)

    # PUT - update
    data = request.get_json() or {}
    title = data.get('title')
    column_id = data.get('column_id')
    link = data.get('link', '')
    description = data.get('description', '')
    icon = data.get('icon', '')

    # fetch existing
    cur.execute('SELECT * FROM cards WHERE id = ?', (card_id,))
    existing = cur.fetchone()
    if not existing:
        return jsonify({'error': 'not found'}), 404

    # if column changed, move to end of new column
    if column_id is not None and int(column_id) != existing['column_id']:
        cur.execute('SELECT IFNULL(MAX(position), -1) + 1 as nextpos FROM cards WHERE column_id = ?', (column_id,))
        nextpos = cur.fetchone()['nextpos']
    else:
        nextpos = existing['position']

    cur.execute('''
        UPDATE cards SET title = ?, link = ?, description = ?, icon = ?, column_id = ?, position = ? WHERE id = ?
    ''', (title or existing['title'], link, description, icon, column_id or existing['column_id'], nextpos, card_id))
    db.commit()
    cur.execute('SELECT * FROM cards WHERE id = ?', (card_id,))
    card = dict(cur.fetchone())
    return jsonify(card)

@app.route('/api/column', methods=['POST'])
def api_add_column():
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({'error': 'missing name'}), 400
    db = get_db()
    cur = db.cursor()
    cur.execute('SELECT IFNULL(MAX(position), -1) + 1 as nextpos FROM columns')
    nextpos = cur.fetchone()['nextpos']
    cur.execute('INSERT INTO columns(name, position) VALUES(?, ?)', (name, nextpos))
    db.commit()
    col_id = cur.lastrowid
    cur.execute('SELECT * FROM columns WHERE id = ?', (col_id,))
    col = dict(cur.fetchone())
    col['cards'] = []
    return jsonify(col), 201


@app.route('/api/column/<int:col_id>', methods=['PUT', 'DELETE'])
def api_modify_column(col_id):
    db = get_db()
    cur = db.cursor()
    if request.method == 'DELETE':
        # delete cards in column, then delete column
        cur.execute('DELETE FROM cards WHERE column_id = ?', (col_id,))
        cur.execute('DELETE FROM columns WHERE id = ?', (col_id,))
        db.commit()
        return ('', 204)

    # PUT - update name
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({'error': 'missing name'}), 400
    cur.execute('UPDATE columns SET name = ? WHERE id = ?', (name, col_id))
    db.commit()
    cur.execute('SELECT * FROM columns WHERE id = ?', (col_id,))
    row = cur.fetchone()
    if not row:
        return jsonify({'error': 'not found'}), 404
    col = dict(row)
    col['cards'] = []
    return jsonify(col)


@app.route('/api/column/<int:col_id>/reorder-cards', methods=['POST'])
def api_reorder_cards(col_id):
    data = request.get_json() or {}
    order = data.get('order')
    if not isinstance(order, list):
        return jsonify({'error': 'order must be a list of card ids'}), 400
    db = get_db()
    cur = db.cursor()
    # set position based on order array; ignore ids not present
    pos = 0
    for cid in order:
        try:
            cid_int = int(cid)
        except Exception:
            continue
        cur.execute('UPDATE cards SET position = ?, column_id = ? WHERE id = ?', (pos, col_id, cid_int))
        pos += 1
    db.commit()
    return ('', 204)


@app.route('/api/column/reorder', methods=['POST'])
def api_reorder_columns():
    data = request.get_json() or {}
    order = data.get('order')
    if not isinstance(order, list):
        return jsonify({'error': 'order must be a list of column ids'}), 400
    db = get_db()
    cur = db.cursor()
    pos = 0
    for cid in order:
        try:
            cid_int = int(cid)
        except Exception:
            continue
        cur.execute('UPDATE columns SET position = ? WHERE id = ?', (pos, cid_int))
        pos += 1
    db.commit()
    return ('', 204)


@app.route('/api/upload-bg', methods=['POST'])
def api_upload_bg():
    if 'file' not in request.files:
        return jsonify({'error': 'no file'}), 400
    f = request.files['file']
    if f.filename == '':
        return jsonify({'error': 'empty filename'}), 400
    filename = secure_filename(f.filename)
    # avoid collisions
    name, ext = os.path.splitext(filename)
    filename = f"{name}_{int(os.times()[4])}{ext}"
    dest = os.path.join(UPLOAD_DIR, filename)
    f.save(dest)
    url = f"/static/uploads/{filename}"
    # replace previous background in settings (and delete old file if uploaded)
    db = get_db()
    cur = db.cursor()
    cur.execute('SELECT dashboard_bg_image FROM settings WHERE id = 1')
    prev = cur.fetchone()
    prev_url = prev['dashboard_bg_image'] if prev and 'dashboard_bg_image' in prev.keys() else None
    # update DB
    cur.execute('UPDATE settings SET dashboard_bg_image = ? WHERE id = 1', (url,))
    db.commit()
    # attempt to remove previous uploaded file if it was in uploads
    try:
        if prev_url and prev_url.startswith('/static/uploads/'):
            prev_path = os.path.join(BASE_DIR, prev_url.lstrip('/'))
            if os.path.exists(prev_path):
                os.remove(prev_path)
    except Exception:
        pass
    return jsonify({'url': url})


@app.route('/api/settings/bg', methods=['DELETE'])
def api_reset_bg():
    db = get_db()
    cur = db.cursor()
    cur.execute('SELECT dashboard_bg_image FROM settings WHERE id = 1')
    prev = cur.fetchone()
    prev_url = prev['dashboard_bg_image'] if prev and 'dashboard_bg_image' in prev.keys() else None
    # clear DB
    cur.execute('UPDATE settings SET dashboard_bg_image = NULL WHERE id = 1')
    db.commit()
    # delete file if it was in uploads
    try:
        if prev_url and prev_url.startswith('/static/uploads/'):
            prev_path = os.path.join(BASE_DIR, prev_url.lstrip('/'))
            if os.path.exists(prev_path):
                os.remove(prev_path)
    except Exception:
        pass
    return ('', 204)

if __name__ == '__main__':
    with app.app_context():
        init_db()
    app.run(host='0.0.0.0', port=5001, debug=True)
