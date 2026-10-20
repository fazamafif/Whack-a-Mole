from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    # Menjalankan server Flask dalam mode debug
    app.run(debug=True, host='127.0.0.1', port=5000)
