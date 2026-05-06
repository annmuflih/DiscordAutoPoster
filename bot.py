import time
import requests
import json
import os
import random
import threading

CONFIG_FILE = "config.json"
running_bots = {}
bot_threads = {}

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except:
            pass
    return {
        "active_profile": "Main Account",
        "profiles": {
            "Main Account": {
                "auth_token": "",
                "interval_min": 40,
                "interval_max": 60,
                "interval_unit": "Minutes",
                "targets": []
            }
        }
    }

def save_config(config):
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=4)

def fetch_guilds(token):
    url = "https://discord.com/api/v9/users/@me/guilds"
    headers = {"Authorization": token}
    try:
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            return res.json()
        return None
    except Exception:
        return None

def fetch_channels(token, guild_id):
    url = f"https://discord.com/api/v9/guilds/{guild_id}/channels"
    headers = {"Authorization": token}
    try:
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            return res.json()
        return None
    except Exception:
        return None

def send_message(token, channel_id, message):
    url = f"https://discord.com/api/v9/channels/{channel_id}/messages"
    payload = {"content": message}
    headers = {"Authorization": token}
    try:
        res = requests.post(url, json=payload, headers=headers)
        return res.status_code, res.text
    except Exception as e:
        return 0, str(e)

def send_webhook(url, payload):
    try:
        requests.post(url, json=payload, timeout=5)
    except:
        pass

def bot_loop(profile_name):
    global running_bots
    cycle_count = 0
    while running_bots.get(profile_name, False):
        cycle_count += 1
        config = load_config()
        profile = config.get("profiles", {}).get(profile_name)
        if not profile:
            print(f"[{profile_name}] Profile not found. Stopping.")
            running_bots[profile_name] = False
            break

        token = profile.get("auth_token", "")
        targets = profile.get("targets", [])
        interval_min = int(profile.get("interval_min", 40))
        interval_max = int(profile.get("interval_max", 60))
        interval_unit = profile.get("interval_unit", "Minutes")
        webhook_url = profile.get("webhook_url", "")
        error_ping_id = profile.get("error_ping_id", "")

        if not token or not targets:
            print(f"[{profile_name}] Config incomplete or no targets. Stopping bot.")
            running_bots[profile_name] = False
            break

        print(f"[{profile_name}] Starting cycle {cycle_count}. Sending to {len(targets)} targets.")
        
        success_count = 0
        fail_count = 0
        
        for target in targets:
            if not running_bots.get(profile_name, False):
                break
                
            channel_id = target.get("id")
            message = target.get("message")
            
            if not channel_id or not message:
                continue

            status, text = send_message(token, channel_id, message)
            print(f"[{profile_name}] Sent message to {channel_id}. Status: {status}")

            if status == 200:
                success_count += 1
            else:
                fail_count += 1
                if status == 429: # Rate limit
                    try:
                        data = json.loads(text)
                        retry_after = data.get("retry_after", 5)
                        print(f"[{profile_name}] Rate limited. Waiting for {retry_after}s")
                        time.sleep(retry_after)
                    except:
                        time.sleep(5)
            
            if running_bots.get(profile_name, False):
                time.sleep(3)

        if not running_bots.get(profile_name, False):
            break

        # Send Webhook Report
        if webhook_url:
            total = len(targets)
            if fail_count == 0:
                content = f"```\nSemua pesan dari profil {profile_name} telah terkirim (Siklus ke-{cycle_count}).\nBerhasil: {success_count}/{total}\n```"
            else:
                ping = f"<@{error_ping_id}> " if error_ping_id else ""
                content = f"{ping}```\nPeringatan dari profil {profile_name}! (Siklus ke-{cycle_count})\nBerhasil: {success_count}/{total}\nGagal: {fail_count}/{total}\n```"
            send_webhook(webhook_url, {"content": content})

        if interval_min > interval_max:
            interval_min, interval_max = interval_max, interval_min
        
        sleep_amount = random.randint(interval_min, interval_max)
        if interval_unit == "Minutes":
            sleep_amount *= 60
        
        print(f"[{profile_name}] Cycle complete. Sleeping for {sleep_amount} seconds...")
        for _ in range(sleep_amount):
            if not running_bots.get(profile_name, False):
                break
            time.sleep(1)

def start_bot(profile_name):
    global running_bots, bot_threads
    if not running_bots.get(profile_name, False):
        running_bots[profile_name] = True
        t = threading.Thread(target=bot_loop, args=(profile_name,))
        bot_threads[profile_name] = t
        t.start()
        return True
    return False

def stop_bot(profile_name):
    global running_bots
    if running_bots.get(profile_name, False):
        running_bots[profile_name] = False
        return True
    return False

def start_all():
    config = load_config()
    profiles = config.get("profiles", {}).keys()
    started = 0
    for p in profiles:
        if start_bot(p):
            started += 1
    return started

def stop_all():
    global running_bots
    stopped = 0
    for p in running_bots.keys():
        if running_bots[p]:
            running_bots[p] = False
            stopped += 1
    return stopped
