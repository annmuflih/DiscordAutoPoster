let fullConfig = {
    active_profile: "Main Account",
    profiles: {
        "Main Account": {
            auth_token: "",
            interval_min: 40,
            interval_max: 60,
            interval_unit: "Minutes",
            targets: []
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    checkStatus();
    setInterval(checkStatus, 3000);

    document.getElementById('btn-save').addEventListener('click', saveConfig);
    document.getElementById('btn-start').addEventListener('click', startCurrentBot);
    document.getElementById('btn-stop').addEventListener('click', stopCurrentBot);
    document.getElementById('btn-start-all').addEventListener('click', startAllBots);
    document.getElementById('btn-stop-all').addEventListener('click', stopAllBots);
    document.getElementById('btn-add-target').addEventListener('click', addOrUpdateTarget);
    document.getElementById('profile_select').addEventListener('change', changeProfile);
});

async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (data.profiles) {
            fullConfig = data;
        }
        renderProfileSelect();
        loadActiveProfileData();
    } catch (e) {
        console.error("Failed to load config", e);
    }
}

function renderProfileSelect() {
    const select = document.getElementById('profile_select');
    select.innerHTML = '';
    for (let p in fullConfig.profiles) {
        let opt = document.createElement('option');
        opt.value = p;
        opt.innerText = p;
        if (p === fullConfig.active_profile) opt.selected = true;
        select.appendChild(opt);
    }
}

function loadActiveProfileData() {
    const p = fullConfig.active_profile;
    const profile = fullConfig.profiles[p];
    if (!profile) return;
    
    document.getElementById('auth_token').value = profile.auth_token || '';
    
    let min = profile.interval_min || 40;
    let max = profile.interval_max || 60;
    if (min === max) {
        document.getElementById('interval_range').value = min;
    } else {
        document.getElementById('interval_range').value = `${min}-${max}`;
    }
    document.getElementById('interval_unit').value = profile.interval_unit || 'Minutes';
    
    document.getElementById('webhook_url').value = profile.webhook_url || '';
    document.getElementById('error_ping_id').value = profile.error_ping_id || '';
    
    cancelEdit();
    renderTargets();
    checkStatus(); // Update banner for this profile
}

function saveActiveProfileDataToMemory() {
    const p = fullConfig.active_profile;
    if (!fullConfig.profiles[p]) return;
    
    fullConfig.profiles[p].auth_token = document.getElementById('auth_token').value;
    
    const interval_raw = document.getElementById('interval_range').value;
    let min = 40, max = 60;
    if (interval_raw.includes('-')) {
        const parts = interval_raw.split('-');
        min = parseInt(parts[0]) || 0;
        max = parseInt(parts[1]) || 0;
    } else {
        min = max = parseInt(interval_raw) || 0;
    }
    fullConfig.profiles[p].interval_min = min;
    fullConfig.profiles[p].interval_max = max;
    fullConfig.profiles[p].interval_unit = document.getElementById('interval_unit').value;
    
    fullConfig.profiles[p].webhook_url = document.getElementById('webhook_url').value;
    fullConfig.profiles[p].error_ping_id = document.getElementById('error_ping_id').value;
}

function changeProfile() {
    saveActiveProfileDataToMemory(); // Save old profile data to memory first
    fullConfig.active_profile = document.getElementById('profile_select').value;
    loadActiveProfileData();
}

function addProfile() {
    const name = prompt("Enter new profile name:");
    if (name && name.trim() !== '') {
        if (fullConfig.profiles[name]) {
            alert("Profile already exists!");
            return;
        }
        saveActiveProfileDataToMemory();
        fullConfig.profiles[name] = {
            auth_token: "",
            interval_min: 40,
            interval_max: 60,
            interval_unit: "Minutes",
            targets: []
        };
        fullConfig.active_profile = name;
        renderProfileSelect();
        loadActiveProfileData();
    }
}

function deleteProfile() {
    const p = fullConfig.active_profile;
    const keys = Object.keys(fullConfig.profiles);
    if (keys.length <= 1) {
        alert("Cannot delete the last profile.");
        return;
    }
    if (confirm(`Are you sure you want to delete profile '${p}'?`)) {
        delete fullConfig.profiles[p];
        fullConfig.active_profile = Object.keys(fullConfig.profiles)[0];
        renderProfileSelect();
        loadActiveProfileData();
    }
}

function renderTargets() {
    const p = fullConfig.active_profile;
    const targets = fullConfig.profiles[p].targets || [];
    const list = document.getElementById('target-list');
    document.getElementById('target-count').innerText = targets.length;
    list.innerHTML = '';
    
    if (targets.length === 0) {
        list.innerHTML = '<li style="text-align:center; padding:10px; color:#888; font-size:12px;">No targets added yet.</li>';
        return;
    }
    
    targets.forEach((t, index) => {
        let li = document.createElement('li');
        li.className = 'list-item';
        li.style.cursor = 'default';
        const cName = t.name ? t.name : 'Unknown Channel';
        li.innerHTML = `
            <div class="list-item-icon" style="background:var(--bg-input);"><i class="fas fa-hashtag text-accent"></i></div>
            <div class="list-item-content">
                <div class="list-item-title">${cName} <span style="font-size:10px; color:#888;">(${t.id})</span></div>
                <div class="list-item-subtitle" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Msg: ${t.message}</div>
            </div>
            <div style="cursor:pointer; color:var(--accent); padding:10px;" onclick="editTarget(${index})">
                <i class="fas fa-edit"></i>
            </div>
            <div style="cursor:pointer; color:var(--danger); padding:10px;" onclick="removeTarget(${index})">
                <i class="fas fa-trash"></i>
            </div>
        `;
        list.appendChild(li);
    });
}

function addOrUpdateTarget() {
    const p = fullConfig.active_profile;
    const targets = fullConfig.profiles[p].targets || [];
    
    const channel_id = document.getElementById('channel_id').value;
    const channel_name = document.getElementById('channel_name').value;
    const message = document.getElementById('message').value;
    const edit_index = parseInt(document.getElementById('edit_index').value);
    
    if (!channel_id || !message) {
        alert("Please enter both Channel ID and Message.");
        return;
    }
    
    if (edit_index >= 0) {
        targets[edit_index] = {
            id: channel_id,
            name: channel_name || channel_id,
            message: message
        };
    } else {
        targets.push({
            id: channel_id,
            name: channel_name || channel_id,
            message: message
        });
    }
    
    fullConfig.profiles[p].targets = targets;
    renderTargets();
    cancelEdit();
}

function editTarget(index) {
    const p = fullConfig.active_profile;
    const target = fullConfig.profiles[p].targets[index];
    
    document.getElementById('channel_id').value = target.id;
    document.getElementById('channel_name').value = target.name || '';
    document.getElementById('message').value = target.message;
    document.getElementById('edit_index').value = index;
    
    document.getElementById('target_editor_label').innerText = "EDIT TARGET";
    document.getElementById('btn-cancel-edit').style.display = 'block';
    
    // scroll to editor
    document.getElementById('target_editor_label').scrollIntoView({behavior: "smooth", block: "center"});
}

function cancelEdit() {
    document.getElementById('channel_id').value = '';
    document.getElementById('channel_name').value = '';
    document.getElementById('message').value = '';
    document.getElementById('edit_index').value = '-1';
    
    document.getElementById('target_editor_label').innerText = "ADD NEW TARGET";
    document.getElementById('btn-cancel-edit').style.display = 'none';
}

function clearChannelName() {
    // If user manually types ID, clear the stored name so it defaults to ID
    document.getElementById('channel_name').value = '';
}

function removeTarget(index) {
    const p = fullConfig.active_profile;
    fullConfig.profiles[p].targets.splice(index, 1);
    renderTargets();
    if (parseInt(document.getElementById('edit_index').value) === index) {
        cancelEdit();
    }
}

async function saveConfig() {
    saveActiveProfileDataToMemory();
    
    const btn = document.getElementById('btn-save');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(fullConfig)
        });
        const result = await res.json();
        if (result.status === 'success') {
            btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
            setTimeout(() => btn.innerHTML = originalText, 2000);
        }
    } catch (e) {
        console.error("Failed to save config", e);
        btn.innerHTML = '<i class="fas fa-times"></i> Error!';
        setTimeout(() => btn.innerHTML = originalText, 2000);
    }
}

async function checkStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        
        const p = fullConfig.active_profile;
        const isRunning = data.running_bots && data.running_bots[p];
        
        const indicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        const btnStart = document.getElementById('btn-start');
        const btnStop = document.getElementById('btn-stop');

        if (isRunning) {
            indicator.className = 'status-indicator running';
            statusText.innerText = `Status (${p}): Running`;
            btnStart.style.display = 'none';
            btnStop.style.display = 'inline-block';
        } else {
            indicator.className = 'status-indicator stopped';
            statusText.innerText = `Status (${p}): Stopped`;
            btnStart.style.display = 'inline-block';
            btnStop.style.display = 'none';
        }
    } catch (e) {
        console.error("Failed to get status", e);
    }
}

async function startCurrentBot() {
    saveConfig(); // save before starting
    try {
        const res = await fetch('/api/start', { 
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({profile_name: fullConfig.active_profile})
        });
        const data = await res.json();
        if (data.status === 'success') {
            checkStatus();
        } else {
            alert(data.message);
        }
    } catch (e) {
        console.error("Failed to start bot", e);
    }
}

async function stopCurrentBot() {
    try {
        const res = await fetch('/api/stop', { 
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({profile_name: fullConfig.active_profile})
        });
        const data = await res.json();
        if (data.status === 'success') {
            checkStatus();
        }
    } catch (e) {
        console.error("Failed to stop bot", e);
    }
}

async function startAllBots() {
    saveConfig();
    try {
        const res = await fetch('/api/start_all', { method: 'POST' });
        const data = await res.json();
        alert(data.message);
        checkStatus();
    } catch (e) {
        console.error(e);
    }
}

async function stopAllBots() {
    try {
        const res = await fetch('/api/stop_all', { method: 'POST' });
        const data = await res.json();
        alert(data.message);
        checkStatus();
    } catch (e) {
        console.error(e);
    }
}

function insertFormat(format) {
    const textarea = document.getElementById('message');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const replacement = format + selectedText + format;
    
    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    textarea.focus();
    
    if (selectedText.length === 0) {
        textarea.selectionEnd = start + format.length;
    } else {
        textarea.selectionEnd = start + replacement.length;
    }
}

// Modal Logic
let currentModalStep = 'guilds';

function closeModal() {
    document.getElementById('selection-modal').style.display = 'none';
}

async function openChannelSelector() {
    const token = document.getElementById('auth_token').value;
    if (!token) {
        alert("Please enter your AUTH TOKEN first.");
        return;
    }
    
    document.getElementById('selection-modal').style.display = 'block';
    document.getElementById('modal-title').innerText = "Select Server";
    document.getElementById('modal-list').innerHTML = '';
    document.getElementById('modal-loading').style.display = 'block';
    
    try {
        const res = await fetch('/api/discord/guilds', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({auth_token: token})
        });
        const data = await res.json();
        document.getElementById('modal-loading').style.display = 'none';
        
        if (data.status === 'success') {
            const guilds = data.data;
            const list = document.getElementById('modal-list');
            
            if (guilds.length === 0) {
                list.innerHTML = '<li style="text-align:center; padding:20px; color:#888;">No servers found.</li>';
                return;
            }
            
            // Add DMs Option
            let dmItem = document.createElement('li');
            dmItem.className = 'list-item';
            dmItem.innerHTML = `
                <div class="list-item-icon"><i class="fas fa-user-friends"></i></div>
                <div class="list-item-content">
                    <div class="list-item-title">Direct Messages</div>
                </div>
            `;
            dmItem.onclick = () => alert("Direct messages fetching not implemented yet in this version.");
            list.appendChild(dmItem);
            
            guilds.forEach(g => {
                let li = document.createElement('li');
                li.className = 'list-item';
                
                let iconHtml = '';
                if (g.icon) {
                    iconHtml = `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png" alt="${g.name}">`;
                } else {
                    iconHtml = `<div class="list-item-icon">${g.name.charAt(0)}</div>`;
                }
                
                li.innerHTML = `
                    ${iconHtml}
                    <div class="list-item-content">
                        <div class="list-item-title">${g.name}</div>
                    </div>
                `;
                li.onclick = () => fetchChannelsForGuild(token, g.id, g.name);
                list.appendChild(li);
            });
        } else {
            alert(data.message);
            closeModal();
        }
    } catch (e) {
        console.error("Failed to fetch guilds", e);
        document.getElementById('modal-loading').style.display = 'none';
    }
}

async function fetchChannelsForGuild(token, guild_id, guild_name) {
    document.getElementById('modal-title').innerText = `Channels in ${guild_name}`;
    document.getElementById('modal-list').innerHTML = '';
    document.getElementById('modal-loading').style.display = 'block';
    
    try {
        const res = await fetch('/api/discord/channels', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({auth_token: token, guild_id: guild_id})
        });
        const data = await res.json();
        document.getElementById('modal-loading').style.display = 'none';
        
        if (data.status === 'success') {
            const channels = data.data;
            const list = document.getElementById('modal-list');
            
            if (channels.length === 0) {
                list.innerHTML = '<li style="text-align:center; padding:20px; color:#888;">No text channels found.</li>';
                return;
            }
            
            channels.forEach(c => {
                let li = document.createElement('li');
                li.className = 'list-item';
                
                let icon = c.type === 5 ? 'fa-bullhorn' : 'fa-hashtag';
                
                li.innerHTML = `
                    <div class="list-item-icon" style="background:transparent; color:#888;"><i class="fas ${icon}"></i></div>
                    <div class="list-item-content">
                        <div class="list-item-title">${c.name}</div>
                        <div class="list-item-subtitle">ID: ${c.id}</div>
                    </div>
                `;
                li.onclick = () => {
                    document.getElementById('channel_id').value = c.id;
                    document.getElementById('channel_name').value = '#' + c.name;
                    closeModal();
                };
                list.appendChild(li);
            });
        } else {
            alert(data.message);
        }
    } catch (e) {
        console.error("Failed to fetch channels", e);
        document.getElementById('modal-loading').style.display = 'none';
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('selection-modal');
    if (event.target == modal) {
        closeModal();
    }
}

// Advanced Settings Toggle
function toggleAdvanced() {
    const adv = document.getElementById('advanced-settings');
    const arrow = document.getElementById('adv-arrow');
    if (adv.style.display === 'none') {
        adv.style.display = 'block';
        arrow.className = 'fas fa-chevron-up';
    } else {
        adv.style.display = 'none';
        arrow.className = 'fas fa-chevron-down';
    }
}
