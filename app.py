from flask import Flask, render_template, request, jsonify
import bot

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/config', methods=['GET', 'POST'])
def config():
    if request.method == 'POST':
        data = request.json
        bot.save_config(data)
        return jsonify({"status": "success", "message": "Config saved successfully"})
    else:
        return jsonify(bot.load_config())

@app.route('/api/discord/guilds', methods=['POST'])
def get_guilds():
    data = request.json
    token = data.get("auth_token")
    if not token:
        return jsonify({"status": "error", "message": "No token provided"})
    
    guilds = bot.fetch_guilds(token)
    if guilds is None:
        return jsonify({"status": "error", "message": "Failed to fetch guilds or invalid token"})
    
    return jsonify({"status": "success", "data": guilds})

@app.route('/api/discord/channels', methods=['POST'])
def get_channels():
    data = request.json
    token = data.get("auth_token")
    guild_id = data.get("guild_id")
    if not token or not guild_id:
        return jsonify({"status": "error", "message": "Missing token or guild_id"})
    
    channels = bot.fetch_channels(token, guild_id)
    if channels is None:
        return jsonify({"status": "error", "message": "Failed to fetch channels"})
    
    # Filter text (0) and announcement (5) channels
    valid_channels = [c for c in channels if c.get('type') in (0, 5)]
    return jsonify({"status": "success", "data": valid_channels})

@app.route('/api/start', methods=['POST'])
def start():
    data = request.json or {}
    profile_name = data.get("profile_name")
    if not profile_name:
        return jsonify({"status": "error", "message": "Profile name required"})
    if bot.start_bot(profile_name):
        return jsonify({"status": "success", "message": f"Bot started for {profile_name}"})
    else:
        return jsonify({"status": "error", "message": f"Bot already running for {profile_name}"})

@app.route('/api/stop', methods=['POST'])
def stop():
    data = request.json or {}
    profile_name = data.get("profile_name")
    if not profile_name:
        return jsonify({"status": "error", "message": "Profile name required"})
    bot.stop_bot(profile_name)
    return jsonify({"status": "success", "message": f"Bot stopping for {profile_name}"})

@app.route('/api/start_all', methods=['POST'])
def start_all():
    started = bot.start_all()
    return jsonify({"status": "success", "message": f"Started {started} bots"})

@app.route('/api/stop_all', methods=['POST'])
def stop_all():
    stopped = bot.stop_all()
    return jsonify({"status": "success", "message": f"Stopped {stopped} bots"})

@app.route('/api/status', methods=['GET'])
def status():
    return jsonify({"running_bots": bot.running_bots})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
