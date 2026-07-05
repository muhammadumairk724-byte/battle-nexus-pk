(function() {
    'use strict';

const API_BASE = 'https://battle-nexus-pk.vercel.app/api';

    function getToken() {
        return localStorage.getItem('battleNexusAccessToken') || sessionStorage.getItem('battleNexusAccessToken');
    }

    const form = document.getElementById('regForm');
    const modeRadios = form.querySelectorAll('input[name="mode"]');
    const teamDetails = document.getElementById('teamDetails');
    const teamNameLabel = document.getElementById('teamNameLabel');
    const teamNameWrap = document.getElementById('teamNameWrap');
    const uid2Wrap = document.getElementById('uid2Wrap');
    const uid3Wrap = document.getElementById('uid3Wrap');
    const uid4Wrap = document.getElementById('uid4Wrap');
    const proofFile = document.getElementById('proofFile');
    const previewWrap = document.getElementById('previewWrap');
    const preview = document.getElementById('preview');
    const uploadText = document.getElementById('uploadText');
    const successStep = document.getElementById('successStep');

    const urlParams = new URLSearchParams(window.location.search);
    const tournamentId = urlParams.get('tournamentId');
    const format = urlParams.get('format');

    if (!tournamentId) {
        alert('No tournament specified. Please go back and try again.');
        window.location.href = 'index.html';
        return;
    }

    // ─── Format lock ───
    const formatContainer = document.getElementById('formatLockContainer');
    const modeGrid = document.getElementById('modeGrid');

    if (format) {
        const display = document.createElement('div');
        display.className = 'format-locked';
        display.textContent = format.toUpperCase();
        formatContainer.appendChild(display);
        modeGrid.style.display = 'none';
        const radio = document.querySelector(`input[name="mode"][value="${format}"]`);
        if (radio) {
            radio.checked = true;
            document.querySelectorAll('input[name="mode"]').forEach(el => el.disabled = true);
        }
        const mode = format;
        if (mode === 'solo') {
            teamDetails.hidden = true;
        } else {
            teamDetails.hidden = false;
            teamNameWrap.hidden = false;
            if (mode === 'duo') {
                teamNameLabel.textContent = 'Team Name (optional)';
                uid2Wrap.hidden = false;
                uid3Wrap.hidden = true;
                uid4Wrap.hidden = true;
            } else {
                teamNameLabel.textContent = 'Squad Name *';
                uid2Wrap.hidden = false;
                uid3Wrap.hidden = false;
                uid4Wrap.hidden = false;
            }
        }
    } else {
        formatContainer.innerHTML = '';
        modeGrid.style.display = 'grid';
        function getMode() { return document.querySelector('input[name="mode"]:checked').value; }
        function updateModeUI() {
            const mode = getMode();
            if (mode === 'solo') {
                teamDetails.hidden = true;
            } else {
                teamDetails.hidden = false;
                teamNameWrap.hidden = false;
                if (mode === 'duo') {
                    teamNameLabel.textContent = 'Team Name (optional)';
                    uid2Wrap.hidden = false;
                    uid3Wrap.hidden = true;
                    uid4Wrap.hidden = true;
                } else {
                    teamNameLabel.textContent = 'Squad Name *';
                    uid2Wrap.hidden = false;
                    uid3Wrap.hidden = false;
                    uid4Wrap.hidden = false;
                }
            }
        }
        modeRadios.forEach(r => r.addEventListener('change', updateModeUI));
        updateModeUI();
    }

    // ─── File preview ───
    proofFile.addEventListener('change', function() {
        const file = this.files && this.files[0];
        if (!file) {
            previewWrap.hidden = true;
            uploadText.textContent = '📷 Upload Screenshot';
            return;
        }
        uploadText.textContent = '✓ ' + file.name;
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            previewWrap.hidden = false;
        };
        reader.readAsDataURL(file);
    });

    // ─── Form submit (with FormData) ───
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const mode = document.querySelector('input[name="mode"]:checked').value;
        const playerName = document.getElementById('playerName').value.trim();
        const uid1 = document.getElementById('uid1').value.trim();
        const whatsapp = document.getElementById('whatsapp').value.trim();
        const email = document.getElementById('email').value.trim();
        const teamName = document.getElementById('teamName').value.trim();
        const txnId = document.getElementById('txnId').value.trim();
        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;

        if (!playerName) { alert('Enter your player name / IGN.'); return; }
        if (!/^\d{6,12}$/.test(uid1)) { alert('UID must be 6–12 digits.'); return; }
        if (!/^03\d{9}$/.test(whatsapp)) { alert('Enter valid WhatsApp (03XXXXXXXXX).'); return; }
        if (!txnId) { alert('Enter the payment transaction ID.'); return; }

        const uids = [uid1];
        if (mode === 'duo') {
            const u2 = document.getElementById('uid2').value.trim();
            if (!/^\d{6,12}$/.test(u2)) { alert('Player 2 UID must be 6–12 digits.'); return; }
            uids.push(u2);
        } else if (mode === 'squad') {
            if (!teamName) { alert('Squad name is required.'); return; }
            const u2 = document.getElementById('uid2').value.trim();
            const u3 = document.getElementById('uid3').value.trim();
            const u4 = document.getElementById('uid4').value.trim();
            if (!/^\d{6,12}$/.test(u2)) { alert('Player 2 UID must be 6–12 digits.'); return; }
            if (!/^\d{6,12}$/.test(u3)) { alert('Player 3 UID must be 6–12 digits.'); return; }
            if (!/^\d{6,12}$/.test(u4)) { alert('Player 4 UID must be 6–12 digits.'); return; }
            uids.push(u2, u3, u4);
        }

        // Build FormData
        const formData = new FormData();
        formData.append('playerName', playerName);
        formData.append('uid', uid1);
        formData.append('uids', JSON.stringify(uids));
        formData.append('teamName', teamName || '');
        formData.append('paymentMethod', paymentMethod);
        formData.append('transactionId', txnId);
        formData.append('whatsapp', whatsapp);
        formData.append('email', email || '');
        // Append file if selected
        const fileInput = document.getElementById('proofFile');
        if (fileInput.files.length > 0) {
            formData.append('screenshot', fileInput.files[0]);
        }

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'SUBMITTING...';
        const messageEl = document.getElementById('registerMessage');
        messageEl.style.display = 'none';
        messageEl.className = '';

        try {
            const response = await fetch(`${API_BASE}/tournaments/${tournamentId}/register`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + getToken()
                    // Do NOT set Content-Type – fetch will set it with the correct boundary
                },
                body: formData
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Registration failed');
            }

            form.style.display = 'none';
            successStep.hidden = false;
            successStep.scrollIntoView({ behavior: 'smooth' });

        } catch (err) {
            messageEl.style.display = 'flex';
            messageEl.className = 'error';
            messageEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + err.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'SUBMIT REGISTRATION';
        }
    });
})();