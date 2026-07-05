(function() {
    'use strict';

    // ============================================================
    // ===== CONFIGURATION =====
    // ============================================================
   const API_BASE = 'https://battle-nexus-pk.vercel.app/api';
    // ===== TOKEN MANAGEMENT =====
    // ============================================================
    function getAccessToken() {
        return localStorage.getItem('battleNexusAccessToken') || sessionStorage.getItem('battleNexusAccessToken');
    }

    function setAccessToken(token, remember) {
        if (remember) {
            localStorage.setItem('battleNexusAccessToken', token);
            sessionStorage.removeItem('battleNexusAccessToken');
        } else {
            sessionStorage.setItem('battleNexusAccessToken', token);
            localStorage.removeItem('battleNexusAccessToken');
        }
    }

    function getRefreshToken() {
        return localStorage.getItem('battleNexusRefreshToken') || sessionStorage.getItem('battleNexusRefreshToken');
    }

    function setRefreshToken(token, remember) {
        if (remember) {
            localStorage.setItem('battleNexusRefreshToken', token);
            sessionStorage.removeItem('battleNexusRefreshToken');
        } else {
            sessionStorage.setItem('battleNexusRefreshToken', token);
            localStorage.removeItem('battleNexusRefreshToken');
        }
    }

    function clearTokens() {
        localStorage.removeItem('battleNexusAccessToken');
        localStorage.removeItem('battleNexusRefreshToken');
        sessionStorage.removeItem('battleNexusAccessToken');
        sessionStorage.removeItem('battleNexusRefreshToken');
        localStorage.removeItem('battleNexusUser');
        sessionStorage.removeItem('battleNexusUser');
    }

    function getStoredUser() {
        try {
            return JSON.parse(localStorage.getItem('battleNexusUser') || sessionStorage.getItem('battleNexusUser') || 'null');
        } catch (_) { return null; }
    }

    function setStoredUser(user, remember) {
        const data = JSON.stringify(user);
        if (remember) {
            localStorage.setItem('battleNexusUser', data);
            sessionStorage.removeItem('battleNexusUser');
        } else {
            sessionStorage.setItem('battleNexusUser', data);
            localStorage.removeItem('battleNexusUser');
        }
    }

    // ============================================================
    // ===== API HELPERS =====
    // ============================================================
    async function apiFetch(endpoint, options = {}) {
        const url = API_BASE + endpoint;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        const token = getAccessToken();
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        const config = {
            ...options,
            headers,
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401 && endpoint !== '/auth/refresh') {
                    const refreshed = await refreshToken();
                    if (refreshed) {
                        const newHeaders = {
                            'Content-Type': 'application/json',
                            ...options.headers,
                            'Authorization': 'Bearer ' + getAccessToken(),
                        };
                        const retryResponse = await fetch(url, {
                            ...config,
                            headers: newHeaders,
                        });
                        const retryData = await retryResponse.json();
                        if (!retryResponse.ok) {
                            throw new Error(retryData.error || 'Request failed');
                        }
                        return retryData;
                    }
                }
                throw new Error(data.error || 'Request failed');
            }
            return data;
        } catch (err) {
            if (err.message === 'Invalid token' || err.message === 'Token expired') {
                clearTokens();
                updateAuthUI();
                if (window.location.pathname.includes('dashboard') ||
                    window.location.pathname.includes('profile') ||
                    window.location.pathname.includes('settings') ||
                    window.location.pathname.includes('my-tournaments') ||
                    window.location.pathname.includes('wallet') ||
                    window.location.pathname.includes('admin-panel')) {
                    window.location.href = 'login.html';
                }
            }
            throw err;
        }
    }

    async function refreshToken() {
        const refreshToken = getRefreshToken();
        if (!refreshToken) return false;
        try {
            const response = await fetch(API_BASE + '/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
            });
            const data = await response.json();
            if (response.ok) {
                const remember = !!localStorage.getItem('battleNexusRefreshToken');
                setAccessToken(data.accessToken, remember);
                setRefreshToken(data.refreshToken, remember);
                return true;
            }
            return false;
        } catch (_) {
            return false;
        }
    }

    // ============================================================
    // ===== AUTH FUNCTIONS =====
    // ============================================================
    function checkLoginStatus() {
        return !!getAccessToken() && !!getStoredUser();
    }

    async function loginUser(email, password, remember) {
        try {
            const data = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });
            setAccessToken(data.accessToken, remember);
            setRefreshToken(data.refreshToken, remember);
            setStoredUser(data.user, remember);
            return { success: true, user: data.user };
        } catch (err) {
            return { success: false, message: err.message };
        }
    }

    async function registerUser(username, email, password, fullName, phone) {
        try {
            const data = await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, email, password, fullName, phone }),
            });
            return { success: true, message: data.message, user: data.user };
        } catch (err) {
            return { success: false, message: err.message };
        }
    }

    function logoutUser() {
        clearTokens();
        updateAuthUI();
        window.location.href = 'index.html';
    }

    async function getCurrentUser() {
        try {
            const data = await apiFetch('/user/profile');
            return data.user;
        } catch (_) {
            return null;
        }
    }

    // ============================================================
    // ===== NOTIFICATIONS =====
    // ============================================================
    let notificationData = [];
    let lastUnreadCount = 0;
    let isFirstLoad = true;

    function playNotificationSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.3);
        } catch (e) {
            console.log('Sound not supported');
        }
    }

    async function loadNotifications() {
        if (!checkLoginStatus()) return;
        try {
            const data = await apiFetch('/notifications');
            notificationData = data.notifications || [];
            const unreadCount = notificationData.filter(n => !n.read).length;

            if (!isFirstLoad && unreadCount > lastUnreadCount) {
                playNotificationSound();
            }
            lastUnreadCount = unreadCount;
            isFirstLoad = false;

            renderNotifications();
            updateUnreadCount();
        } catch (_) {}
    }

    async function updateUnreadCount() {
        if (!checkLoginStatus()) return;
        try {
            const data = await apiFetch('/notifications/unread-count');
            const dot = document.querySelector('.status-dot');
            if (dot) {
                if (data.unread > 0) {
                    dot.style.display = 'block';
                    dot.textContent = data.unread;
                } else {
                    dot.style.display = 'none';
                }
            }
            lastUnreadCount = data.unread;
        } catch (_) {}
    }

    function renderNotifications() {
        var list = document.getElementById('notificationList');
        if (!list) return;
        if (notificationData.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#6c6e75;">No notifications</div>';
            return;
        }
        list.innerHTML = notificationData.map(function(notif) {
            var icon = 'fa-bell';
            var title = notif.title || 'Notification';
            var message = notif.message || '';
            var time = notif.created_at ? new Date(notif.created_at).toLocaleString() : '';
            var isRead = notif.read ? 'style="opacity:0.6;"' : '';
            return `
                <div class="notification-item" ${isRead} data-id="${notif.id}">
                    <div class="notif-icon"><i class="fas ${icon}"></i></div>
                    <div class="notif-content">
                        <div class="notif-title">${title}</div>
                        <div class="notif-message">${message}</div>
                        <div class="notif-time">${time}</div>
                    </div>
                    <div class="notif-actions" style="display:flex; gap:6px; align-items:center;">
                        ${!notif.read ? `<button class="notif-mark-read" data-id="${notif.id}" style="background:none; border:none; color:#00e5ff; cursor:pointer; font-size:12px;" title="Mark as read">✓</button>` : ''}
                        <button class="notif-delete" data-id="${notif.id}" style="background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:14px;" title="Delete">&times;</button>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.notif-mark-read').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var id = this.dataset.id;
                if (id) {
                    apiFetch('/notifications/read/' + id, { method: 'PUT' })
                        .then(function() {
                            var notif = notificationData.find(n => n.id == id);
                            if (notif) notif.read = true;
                            var unreadCount = notificationData.filter(n => !n.read).length;
                            lastUnreadCount = unreadCount;
                            renderNotifications();
                            updateUnreadCount();
                        })
                        .catch(function(err) { console.error('Mark read error:', err); });
                }
            });
        });

        list.querySelectorAll('.notif-delete').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var id = this.dataset.id;
                if (id) {
                    apiFetch('/notifications/' + id, { method: 'DELETE' })
                        .then(function() {
                            notificationData = notificationData.filter(n => n.id != id);
                            var unreadCount = notificationData.filter(n => !n.read).length;
                            lastUnreadCount = unreadCount;
                            renderNotifications();
                            updateUnreadCount();
                        })
                        .catch(function(err) { console.error('Delete error:', err); });
                }
            });
        });

        list.querySelectorAll('.notification-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var id = this.dataset.id;
                if (id) {
                    var notif = notificationData.find(n => n.id == id);
                    if (notif && !notif.read) {
                        apiFetch('/notifications/read/' + id, { method: 'PUT' })
                            .then(function() {
                                notif.read = true;
                                var unreadCount = notificationData.filter(n => !n.read).length;
                                lastUnreadCount = unreadCount;
                                renderNotifications();
                                updateUnreadCount();
                            })
                            .catch(function(err) { console.error('Mark read error:', err); });
                    }
                }
            });
        });
    }

    async function markAllNotificationsRead() {
        if (!checkLoginStatus()) return;
        try {
            await apiFetch('/notifications/read', { method: 'PUT' });
            notificationData.forEach(function(n) { n.read = true; });
            lastUnreadCount = 0;
            renderNotifications();
            updateUnreadCount();
        } catch (_) {}
    }

    function toggleNotificationPanel() {
        var panel = document.getElementById('notificationPanel');
        if (panel) {
            panel.classList.toggle('active');
            var profileDropdown = document.getElementById('profileDropdown');
            if (profileDropdown) profileDropdown.classList.remove('active');
            if (panel.classList.contains('active')) {
                loadNotifications();
            }
        }
    }

    function closeNotificationPanel() {
        var panel = document.getElementById('notificationPanel');
        if (panel) panel.classList.remove('active');
    }

    // ============================================================
    // ===== UI UPDATE =====
    // ============================================================
    function updateAuthUI() {
        var loggedIn = checkLoginStatus();
        var user = getStoredUser();

        var authButtons = document.querySelector('.auth-buttons');
        var bellIcon = document.getElementById('bellIcon');
        var profileIcon = document.getElementById('profileIcon');
        var profileDropdown = document.getElementById('profileDropdown');
        var mobileAuthFooter = document.getElementById('mobileAuthFooter');
        var mobileLoginBtn = document.getElementById('mobileLoginBtn');
        var mobileRegisterBtn = document.getElementById('mobileRegisterBtn');
        var mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

        if (authButtons) {
            authButtons.style.display = loggedIn ? 'none' : 'flex';
        }
        if (bellIcon) {
            bellIcon.classList.toggle('auth-hidden', !loggedIn);
        }
        if (profileIcon) {
            profileIcon.classList.toggle('auth-hidden', !loggedIn);
        }

        if (mobileAuthFooter) {
            if (mobileLoginBtn) mobileLoginBtn.style.display = loggedIn ? 'none' : 'block';
            if (mobileRegisterBtn) mobileRegisterBtn.style.display = loggedIn ? 'none' : 'block';
            if (mobileLogoutBtn) {
                mobileLogoutBtn.classList.toggle('auth-hidden', !loggedIn);
            }
        }

        var adminLink = document.getElementById('adminPanelLink');
        var mobileAdminLink = document.getElementById('mobileAdminLink');
        if (adminLink) {
            adminLink.style.display = (loggedIn && user && user.role === 'admin') ? 'flex' : 'none';
        }
        if (mobileAdminLink) {
            mobileAdminLink.style.display = (loggedIn && user && user.role === 'admin') ? 'flex' : 'none';
        }

        if (!loggedIn && profileDropdown) {
            profileDropdown.classList.remove('active');
        }

        if (loggedIn) {
            updateUnreadCount();
        }
    }

    // ============================================================
    // ===== LOGIN REQUIRED MODAL =====
    // ============================================================
    function showLoginRequiredModal() {
        var modal = document.getElementById('loginRequiredModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    function hideLoginRequiredModal() {
        var modal = document.getElementById('loginRequiredModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    function requireLogin(callback) {
        if (checkLoginStatus()) {
            if (typeof callback === 'function') {
                callback();
            }
        } else {
            showLoginRequiredModal();
        }
    }

    // ============================================================
    // ===== PASSWORD TOGGLE =====
    // ============================================================
    function setupPasswordToggles() {
        document.querySelectorAll('.toggle-password').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var targetId = this.getAttribute('data-target');
                var input = document.getElementById(targetId);
                if (!input) return;
                var isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                this.querySelector('i').className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
            });
        });
    }

    // ============================================================
    // ===== VALIDATION HELPERS =====
    // ============================================================
    function isValidEmail(email) {
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
    }

    function isValidUsername(username) {
        return /^[a-zA-Z0-9_]{3,20}$/.test(username);
    }

    function isValidFullName(name) {
        return /^[a-zA-Z\s]{2,50}$/.test(name.trim());
    }

    function isValidPhone(phone) {
        if (phone === '') return true;
        return /^(03\d{9}|\+923\d{9})$/.test(phone);
    }

    function isValidPassword(password) {
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
    }

    // ============================================================
    // ===== LOGIN FORM =====
    // ============================================================
    function setupLoginForm() {
        var form = document.getElementById('loginForm');
        if (!form) return;

        var emailInput = document.getElementById('loginEmail');
        var passwordInput = document.getElementById('loginPassword');
        var emailError = document.getElementById('loginEmailError');
        var passwordError = document.getElementById('loginPasswordError');
        var messageEl = document.getElementById('loginMessage');
        var submitBtn = document.getElementById('loginBtn');
        var rememberMe = document.getElementById('rememberMe');

        if (!emailInput || !passwordInput || !submitBtn) return;

        emailInput.addEventListener('blur', function() {
            var val = this.value.trim();
            if (val.length === 0) {
                emailError.textContent = 'Email is required';
                this.classList.add('error');
                return;
            }
            if (!isValidEmail(val)) {
                emailError.textContent = 'Please enter a valid email';
                this.classList.add('error');
                return;
            }
            emailError.textContent = '';
            this.classList.remove('error');
            this.classList.add('success');
        });

        emailInput.addEventListener('input', function() {
            if (emailError.textContent) {
                var val = this.value.trim();
                if (val.length === 0 || isValidEmail(val)) {
                    emailError.textContent = '';
                    this.classList.remove('error');
                    this.classList.remove('success');
                }
            }
        });

        passwordInput.addEventListener('blur', function() {
            if (this.value.length === 0) {
                passwordError.textContent = 'Password is required';
                this.classList.add('error');
                return;
            }
            passwordError.textContent = '';
            this.classList.remove('error');
            this.classList.add('success');
        });

        passwordInput.addEventListener('input', function() {
            if (passwordError.textContent) {
                if (this.value.length === 0) {
                    passwordError.textContent = 'Password is required';
                    this.classList.add('error');
                    return;
                }
                passwordError.textContent = '';
                this.classList.remove('error');
                this.classList.remove('success');
            }
        });

        form.addEventListener('submit', function(e) {
            e.preventDefault();

            var email = emailInput.value.trim();
            var password = passwordInput.value;
            var hasError = false;

            if (email.length === 0) {
                emailError.textContent = 'Email is required';
                emailInput.classList.add('error');
                hasError = true;
            } else if (!isValidEmail(email)) {
                emailError.textContent = 'Please enter a valid email';
                emailInput.classList.add('error');
                hasError = true;
            } else {
                emailError.textContent = '';
                emailInput.classList.remove('error');
                emailInput.classList.add('success');
            }

            if (password.length === 0) {
                passwordError.textContent = 'Password is required';
                passwordInput.classList.add('error');
                hasError = true;
            } else {
                passwordError.textContent = '';
                passwordInput.classList.remove('error');
                passwordInput.classList.add('success');
            }

            if (hasError) {
                messageEl.className = 'error';
                messageEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please fix all errors.';
                return;
            }

            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
            messageEl.className = '';
            messageEl.innerHTML = '';

            var remember = rememberMe ? rememberMe.checked : false;

            loginUser(email, password, remember).then(function(result) {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;

                if (result.success) {
                    messageEl.className = 'success';
                    messageEl.innerHTML = '<i class="fas fa-check-circle"></i> Welcome back, ' + result.user.username + '!';
                    updateAuthUI();
                    setTimeout(function() {
                        window.location.href = 'index.html';
                    }, 1200);
                } else {
                    messageEl.className = 'error';
                    messageEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + result.message;
                    if (result.message.toLowerCase().includes('email')) {
                        emailInput.classList.add('error');
                    } else {
                        passwordInput.classList.add('error');
                    }
                }
            }).catch(function(err) {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
                messageEl.className = 'error';
                messageEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + err.message;
            });
        });
    }

    // ============================================================
    // ===== REGISTER FORM =====
    // ============================================================
    function setupRegisterForm() {
        var form = document.getElementById('registerForm');
        if (!form) return;

        var fullNameInput = document.getElementById('registerFullName');
        var usernameInput = document.getElementById('registerUsername');
        var emailInput = document.getElementById('registerEmail');
        var phoneInput = document.getElementById('registerPhone');
        var passwordInput = document.getElementById('registerPassword');
        var confirmInput = document.getElementById('registerConfirm');
        var termsInput = document.getElementById('registerTerms');

        var fullNameError = document.getElementById('registerFullNameError');
        var usernameError = document.getElementById('registerUsernameError');
        var emailError = document.getElementById('registerEmailError');
        var phoneError = document.getElementById('registerPhoneError');
        var passwordError = document.getElementById('registerPasswordError');
        var confirmError = document.getElementById('registerConfirmError');
        var termsError = document.getElementById('registerTermsError');
        var messageEl = document.getElementById('registerMessage');
        var submitBtn = document.getElementById('registerBtn');

        fullNameInput.addEventListener('blur', function() {
            var val = this.value.trim();
            if (val.length === 0) {
                fullNameError.textContent = 'Full name is required';
                this.classList.add('error');
                return;
            }
            if (!isValidFullName(val)) {
                fullNameError.textContent = 'Only letters and spaces (2-50 chars)';
                this.classList.add('error');
                return;
            }
            fullNameError.textContent = '';
            this.classList.remove('error');
            this.classList.add('success');
        });

        fullNameInput.addEventListener('input', function() {
            if (fullNameError.textContent) {
                var val = this.value.trim();
                if (val.length === 0 || isValidFullName(val)) {
                    fullNameError.textContent = '';
                    this.classList.remove('error');
                    this.classList.remove('success');
                }
            }
        });

        usernameInput.addEventListener('blur', function() {
            var val = this.value.trim();
            if (val.length === 0) {
                usernameError.textContent = 'Username is required';
                this.classList.add('error');
                return;
            }
            if (!isValidUsername(val)) {
                usernameError.textContent = '3-20 chars, letters, numbers, underscore only';
                this.classList.add('error');
                return;
            }
            usernameError.textContent = '';
            this.classList.remove('error');
            this.classList.add('success');
        });

        usernameInput.addEventListener('input', function() {
            if (usernameError.textContent) {
                var val = this.value.trim();
                if (val.length === 0 || isValidUsername(val)) {
                    usernameError.textContent = '';
                    this.classList.remove('error');
                    this.classList.remove('success');
                }
            }
        });

        emailInput.addEventListener('blur', function() {
            var val = this.value.trim();
            if (val.length === 0) {
                emailError.textContent = 'Email is required';
                this.classList.add('error');
                return;
            }
            if (!isValidEmail(val)) {
                emailError.textContent = 'Please enter a valid email';
                this.classList.add('error');
                return;
            }
            emailError.textContent = '';
            this.classList.remove('error');
            this.classList.add('success');
        });

        emailInput.addEventListener('input', function() {
            if (emailError.textContent) {
                var val = this.value.trim();
                if (val.length === 0 || isValidEmail(val)) {
                    emailError.textContent = '';
                    this.classList.remove('error');
                    this.classList.remove('success');
                }
            }
        });

        phoneInput.addEventListener('blur', function() {
            var val = this.value.trim();
            if (val.length === 0) {
                phoneError.textContent = '';
                this.classList.remove('error', 'success');
                return;
            }
            if (!isValidPhone(val)) {
                phoneError.textContent = 'Enter 03XXXXXXXXX or +923XXXXXXXXX';
                this.classList.add('error');
                return;
            }
            phoneError.textContent = '';
            this.classList.remove('error');
            this.classList.add('success');
        });

        phoneInput.addEventListener('input', function() {
            if (phoneError.textContent) {
                var val = this.value.trim();
                if (val.length === 0 || isValidPhone(val)) {
                    phoneError.textContent = '';
                    this.classList.remove('error');
                    this.classList.remove('success');
                }
            }
        });

        passwordInput.addEventListener('blur', function() {
            var val = this.value;
            if (val.length === 0) {
                passwordError.textContent = 'Password is required';
                this.classList.add('error');
                return;
            }
            if (!isValidPassword(val)) {
                passwordError.textContent = '8+ chars, 1 uppercase, 1 lowercase, 1 number';
                this.classList.add('error');
                return;
            }
            passwordError.textContent = '';
            this.classList.remove('error');
            this.classList.add('success');
        });

        passwordInput.addEventListener('input', function() {
            if (passwordError.textContent) {
                var val = this.value;
                if (val.length === 0 || isValidPassword(val)) {
                    passwordError.textContent = '';
                    this.classList.remove('error');
                    this.classList.remove('success');
                }
            }
            if (confirmInput.value.length > 0) {
                validateConfirm();
            }
        });

        function validateConfirm() {
            var pwd = passwordInput.value;
            var conf = confirmInput.value;
            if (conf.length === 0) {
                confirmError.textContent = 'Please confirm your password';
                confirmInput.classList.add('error');
                return false;
            }
            if (pwd !== conf) {
                confirmError.textContent = 'Passwords do not match';
                confirmInput.classList.add('error');
                return false;
            }
            confirmError.textContent = '';
            confirmInput.classList.remove('error');
            confirmInput.classList.add('success');
            return true;
        }

        confirmInput.addEventListener('blur', validateConfirm);
        confirmInput.addEventListener('input', function() {
            if (confirmError.textContent) validateConfirm();
        });

        termsInput.addEventListener('change', function() {
            if (termsError.textContent) {
                if (this.checked) {
                    termsError.textContent = '';
                }
            }
        });

        form.addEventListener('submit', function(e) {
            e.preventDefault();

            var fullName = fullNameInput.value.trim();
            var username = usernameInput.value.trim();
            var email = emailInput.value.trim();
            var phone = phoneInput.value.trim();
            var password = passwordInput.value;
            var confirm = confirmInput.value;
            var terms = termsInput.checked;

            var hasError = false;

            if (!isValidFullName(fullName)) {
                fullNameError.textContent = 'Full name is required (2-50 letters)';
                fullNameInput.classList.add('error');
                hasError = true;
            } else {
                fullNameError.textContent = '';
                fullNameInput.classList.remove('error');
                fullNameInput.classList.add('success');
            }

            if (!isValidUsername(username)) {
                usernameError.textContent = '3-20 chars, letters, numbers, underscore only';
                usernameInput.classList.add('error');
                hasError = true;
            } else {
                usernameError.textContent = '';
                usernameInput.classList.remove('error');
                usernameInput.classList.add('success');
            }

            if (!isValidEmail(email)) {
                emailError.textContent = 'Please enter a valid email';
                emailInput.classList.add('error');
                hasError = true;
            } else {
                emailError.textContent = '';
                emailInput.classList.remove('error');
                emailInput.classList.add('success');
            }

            if (phone.length > 0 && !isValidPhone(phone)) {
                phoneError.textContent = 'Enter 03XXXXXXXXX or +923XXXXXXXXX';
                phoneInput.classList.add('error');
                hasError = true;
            } else {
                phoneError.textContent = '';
                phoneInput.classList.remove('error');
                phoneInput.classList.add('success');
            }

            if (!isValidPassword(password)) {
                passwordError.textContent = '8+ chars, 1 uppercase, 1 lowercase, 1 number';
                passwordInput.classList.add('error');
                hasError = true;
            } else {
                passwordError.textContent = '';
                passwordInput.classList.remove('error');
                passwordInput.classList.add('success');
            }

            if (!validateConfirm()) {
                hasError = true;
            }

            if (!terms) {
                termsError.textContent = 'You must accept the Terms & Conditions';
                hasError = true;
            } else {
                termsError.textContent = '';
            }

            if (hasError) {
                messageEl.className = 'error';
                messageEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please fix all errors.';
                return;
            }

            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
            messageEl.className = '';
            messageEl.innerHTML = '';

            registerUser(username, email, password, fullName, phone).then(function(result) {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;

                if (result.success) {
                    messageEl.className = 'success';
                    messageEl.innerHTML = '<i class="fas fa-check-circle"></i> ' + result.message + ' Redirecting...';
                    setTimeout(function() {
                        window.location.href = 'login.html';
                    }, 2000);
                } else {
                    messageEl.className = 'error';
                    messageEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + result.message;
                }
            }).catch(function(err) {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
                messageEl.className = 'error';
                messageEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + err.message;
            });
        });
    }

    // ============================================================
    // ===== FORGOT PASSWORD FORM =====
    // ============================================================
    function setupForgotForm() {
        var form = document.getElementById('forgotForm');
        if (!form) return;

        var emailInput = document.getElementById('forgotEmail');
        var emailError = document.getElementById('forgotEmailError');
        var messageEl = document.getElementById('forgotMessage');
        var submitBtn = document.getElementById('forgotBtn');

        emailInput.addEventListener('blur', function() {
            var val = this.value.trim();
            if (val.length === 0) {
                emailError.textContent = 'Email is required';
                this.classList.add('error');
                return;
            }
            if (!isValidEmail(val)) {
                emailError.textContent = 'Please enter a valid email';
                this.classList.add('error');
                return;
            }
            emailError.textContent = '';
            this.classList.remove('error');
            this.classList.add('success');
        });

        emailInput.addEventListener('input', function() {
            if (emailError.textContent) {
                var val = this.value.trim();
                if (val.length === 0 || isValidEmail(val)) {
                    emailError.textContent = '';
                    this.classList.remove('error');
                    this.classList.remove('success');
                }
            }
        });

        form.addEventListener('submit', function(e) {
            e.preventDefault();

            var email = emailInput.value.trim();
            var hasError = false;

            if (email.length === 0) {
                emailError.textContent = 'Email is required';
                emailInput.classList.add('error');
                hasError = true;
            } else if (!isValidEmail(email)) {
                emailError.textContent = 'Please enter a valid email';
                emailInput.classList.add('error');
                hasError = true;
            } else {
                emailError.textContent = '';
                emailInput.classList.remove('error');
                emailInput.classList.add('success');
            }

            if (hasError) {
                messageEl.className = 'error';
                messageEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please fix all errors.';
                return;
            }

            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
            messageEl.className = '';
            messageEl.innerHTML = '';

            apiFetch('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email }),
            }).then(function(data) {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
                messageEl.className = 'success';
                messageEl.innerHTML = '<i class="fas fa-check-circle"></i> ' + data.message;
            }).catch(function(err) {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
                messageEl.className = 'error';
                messageEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + err.message;
            });
        });
    }

    // ============================================================
    // ===== RESET PASSWORD FORM =====
    // ============================================================
    function setupResetForm() {
        var form = document.getElementById('resetForm');
        if (!form) return;

        var newPassInput = document.getElementById('resetNewPassword');
        var confirmInput = document.getElementById('resetConfirmPassword');
        var newPassError = document.getElementById('resetNewPasswordError');
        var confirmError = document.getElementById('resetConfirmError');
        var messageEl = document.getElementById('resetMessage');
        var submitBtn = document.getElementById('resetBtn');

        var urlParams = new URLSearchParams(window.location.search);
        var token = urlParams.get('token');

        newPassInput.addEventListener('blur', function() {
            var val = this.value;
            if (val.length === 0) {
                newPassError.textContent = 'Password is required';
                this.classList.add('error');
                return;
            }
            if (!isValidPassword(val)) {
                newPassError.textContent = '8+ chars, 1 uppercase, 1 lowercase, 1 number';
                this.classList.add('error');
                return;
            }
            newPassError.textContent = '';
            this.classList.remove('error');
            this.classList.add('success');
        });

        newPassInput.addEventListener('input', function() {
            if (newPassError.textContent) {
                var val = this.value;
                if (val.length === 0 || isValidPassword(val)) {
                    newPassError.textContent = '';
                    this.classList.remove('error');
                    this.classList.remove('success');
                }
            }
            if (confirmInput.value.length > 0) {
                validateConfirmReset();
            }
        });

        function validateConfirmReset() {
            var pwd = newPassInput.value;
            var conf = confirmInput.value;
            if (conf.length === 0) {
                confirmError.textContent = 'Please confirm your password';
                confirmInput.classList.add('error');
                return false;
            }
            if (pwd !== conf) {
                confirmError.textContent = 'Passwords do not match';
                confirmInput.classList.add('error');
                return false;
            }
            confirmError.textContent = '';
            confirmInput.classList.remove('error');
            confirmInput.classList.add('success');
            return true;
        }

        confirmInput.addEventListener('blur', validateConfirmReset);
        confirmInput.addEventListener('input', function() {
            if (confirmError.textContent) validateConfirmReset();
        });

        form.addEventListener('submit', function(e) {
            e.preventDefault();

            var newPass = newPassInput.value;
            var confirm = confirmInput.value;
            var hasError = false;

            if (!isValidPassword(newPass)) {
                newPassError.textContent = '8+ chars, 1 uppercase, 1 lowercase, 1 number';
                newPassInput.classList.add('error');
                hasError = true;
            } else {
                newPassError.textContent = '';
                newPassInput.classList.remove('error');
                newPassInput.classList.add('success');
            }

            if (!validateConfirmReset()) {
                hasError = true;
            }

            if (hasError) {
                messageEl.className = 'error';
                messageEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please fix all errors.';
                return;
            }

            if (!token) {
                messageEl.className = 'error';
                messageEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Invalid reset link. Please request a new one.';
                return;
            }

            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
            messageEl.className = '';
            messageEl.innerHTML = '';

            apiFetch('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ token, newPassword: newPass }),
            }).then(function(data) {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
                messageEl.className = 'success';
                messageEl.innerHTML = '<i class="fas fa-check-circle"></i> ' + data.message + ' Redirecting...';
                setTimeout(function() {
                    window.location.href = 'login.html';
                }, 2000);
            }).catch(function(err) {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
                messageEl.className = 'error';
                messageEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + err.message;
            });
        });
    }

    // ============================================================
    // ===== FILTER SYSTEM (Cross-Page) =====
    // ============================================================
    var currentFormat = 'all';
    var currentMap = 'all';
    var currentStatus = 'all';
    var allTournaments = [];

    function syncFilterUI() {
        var formatBtns = document.querySelectorAll('#format-filters .btn-filter');
        formatBtns.forEach(function(btn) {
            var val = btn.getAttribute('data-filter');
            if (val === currentFormat) btn.classList.add('format-active');
            else btn.classList.remove('format-active');
        });
        var mapBtns = document.querySelectorAll('#map-filters .btn-filter');
        mapBtns.forEach(function(btn) {
            var val = btn.getAttribute('data-filter');
            if (val === currentMap) btn.classList.add('map-active');
            else btn.classList.remove('map-active');
        });
    }

    async function loadTournaments() {
        try {
            var params = new URLSearchParams();
            if (currentFormat !== 'all') params.append('format', currentFormat);
            if (currentMap !== 'all') params.append('map', currentMap);
            if (currentStatus !== 'all') params.append('status', currentStatus);
            var query = params.toString() ? '?' + params.toString() : '';
            var data = await apiFetch('/tournaments' + query);
            allTournaments = data.tournaments || [];
            renderTournaments();
        } catch (_) {
            allTournaments = [];
            renderTournaments();
        }
    }

    function renderTournaments() {
        var container = document.getElementById('cards-container');
        if (!container) return;

        if (allTournaments.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#6c6e75;">No tournaments found.</div>';
            return;
        }

        container.innerHTML = allTournaments.map(function(t) {
            var statusClass = t.status === 'live' ? 'badge-live' : (t.status === 'upcoming' ? 'badge-upcoming' : 'badge-completed');
            var statusText = t.status.toUpperCase();
            var formatClass = 'color-' + t.format;
            var progress = t.max_participants > 0 ? Math.round((t.current_participants / t.max_participants) * 100) : 0;
            var slotsLeft = t.max_participants - t.current_participants;

            var buttonText = t.status === 'live' ? 'JOIN NOW &gt;' : (t.status === 'upcoming' ? 'REGISTER &gt;' : 'VIEW &gt;');
            var buttonLink = 'tournament-registration-terms.html?tournamentId=' + t.id + '&format=' + t.format;

            return `
                <div class="tournament-card" data-format="${t.format}" data-map="${t.map || ''}">
                    <div class="card-header">
                        <div class="badge-status ${statusClass}"><div class="status-dot-card"></div> ${statusText}</div>
                        <div class="badge-format ${formatClass}">${t.format.toUpperCase()}</div>
                        <div class="map-info">
                            <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                            <div class="map-name">${t.map || 'TBD'}</div>
                        </div>
                    </div>
                    <div class="card-body">
                        <h3 class="tournament-title">${t.name}</h3>
                        <div class="prize-pool-container"><span class="prize-amount">Rs ${t.prize_pool}</span><span class="prize-label">Prize Pool</span></div>
                        <div class="details-row">
                            <div class="detail-item"><svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>${new Date(t.date_time).toLocaleString()}</div>
                            <div class="detail-item" style="color:#ffcc00;"><svg viewBox="0 0 24 24" style="fill:#ffcc00;"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9h-2V7h-2v5H6v2h2v5h2v-5h2v-2z"/></svg>Rs ${t.entry_fee || 0}</div>
                        </div>
                        <div class="details-row">
                            <div class="detail-item"><svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>${t.current_participants}/${t.max_participants} Players</div>
                            <div class="detail-item highlight-text">${slotsLeft} slots left</div>
                        </div>
                        <div class="progress-container"><div class="progress-bar" style="width:${Math.min(progress, 100)}%;"></div></div>
                        <a href="${buttonLink}" class="btn-register-tournament" style="text-decoration:none; display:block; text-align:center;">${buttonText}</a>
                    </div>
                </div>
            `;
        }).join('');
    }

    function filterTournaments() {
        loadTournaments();
        syncFilterUI();
    }

    function scrollToTournaments() {
        var target = document.getElementById('tournament-container');
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function applyFilterAndScroll(filterType, value) {
        var path = window.location.pathname;
        var isIndexPage = path === '/' || path === '/index.html' || path === '';

        if (!isIndexPage) {
            var redirectUrl = 'index.html';
            if (filterType && value) {
                redirectUrl += '?filter=' + encodeURIComponent(filterType) + '&value=' + encodeURIComponent(value);
            }
            window.location.href = redirectUrl;
            return;
        }

        if (filterType === 'format') {
            currentFormat = value;
            currentMap = 'all';
            currentStatus = 'all';
        } else if (filterType === 'map') {
            currentMap = value;
            currentFormat = 'all';
            currentStatus = 'all';
        } else if (filterType === 'status') {
            currentStatus = value;
            currentFormat = 'all';
            currentMap = 'all';
        } else {
            currentFormat = 'all';
            currentMap = 'all';
            currentStatus = 'all';
        }

        filterTournaments();
        scrollToTournaments();
    }

    // ============================================================
    // ===== NAVIGATION & FILTER SETUP =====
    // ============================================================
    function setupNavigationFilters() {
        document.querySelectorAll('.navbar .dropdown-item[data-filter="format"]').forEach(function(item) {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                var value = this.getAttribute('data-value');
                applyFilterAndScroll('format', value);
            });
        });
        document.querySelectorAll('.navbar .dropdown-item[data-filter="map"]').forEach(function(item) {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                var value = this.getAttribute('data-value');
                applyFilterAndScroll('map', value);
            });
        });

        var navLive = document.getElementById('navLive');
        if (navLive) {
            navLive.addEventListener('click', function(e) {
                e.preventDefault();
                var path = window.location.pathname;
                var isIndexPage = path === '/' || path === '/index.html' || path === '';
                if (!isIndexPage) {
                    window.location.href = 'index.html?filter=status&value=live';
                } else {
                    applyFilterAndScroll('status', 'live');
                }
            });
        }

        var navLeaderboard = document.getElementById('navLeaderboard');
        if (navLeaderboard) {
            navLeaderboard.addEventListener('click', function(e) {
                e.preventDefault();
                var path = window.location.pathname;
                var isIndexPage = path === '/' || path === '/index.html' || path === '';
                if (!isIndexPage) {
                    window.location.href = 'index.html#leaderboard';
                } else {
                    var target = document.getElementById('leaderboard');
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        }

        document.querySelectorAll('.m-sub[data-filter]').forEach(function(item) {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                var filterType = this.getAttribute('data-filter');
                var value = this.getAttribute('data-value');
                applyFilterAndScroll(filterType, value);
                closeMobileMenu();
            });
        });

        var mobileLive = document.getElementById('mobileLive');
        if (mobileLive) {
            mobileLive.addEventListener('click', function(e) {
                e.preventDefault();
                var path = window.location.pathname;
                var isIndexPage = path === '/' || path === '/index.html' || path === '';
                if (!isIndexPage) {
                    window.location.href = 'index.html?filter=status&value=live';
                } else {
                    applyFilterAndScroll('status', 'live');
                }
                closeMobileMenu();
            });
        }

        var mobileLeaderboard = document.getElementById('mobileLeaderboard');
        if (mobileLeaderboard) {
            mobileLeaderboard.addEventListener('click', function(e) {
                e.preventDefault();
                var path = window.location.pathname;
                var isIndexPage = path === '/' || path === '/index.html' || path === '';
                if (!isIndexPage) {
                    window.location.href = 'index.html#leaderboard';
                } else {
                    var target = document.getElementById('leaderboard');
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                }
                closeMobileMenu();
            });
        }

        var footerTournaments = document.getElementById('footerTournaments');
        if (footerTournaments) {
            footerTournaments.addEventListener('click', function(e) {
                e.preventDefault();
                applyFilterAndScroll('all', 'all');
            });
        }

        var footerLeaderboard = document.getElementById('footerLeaderboard');
        if (footerLeaderboard) {
            footerLeaderboard.addEventListener('click', function(e) {
                e.preventDefault();
                var path = window.location.pathname;
                var isIndexPage = path === '/' || path === '/index.html' || path === '';
                if (!isIndexPage) {
                    window.location.href = 'index.html#leaderboard';
                } else {
                    var target = document.getElementById('leaderboard');
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        }

        var footerMapSchedule = document.getElementById('footerMapSchedule');
        if (footerMapSchedule) {
            footerMapSchedule.addEventListener('click', function(e) {
                e.preventDefault();
                applyFilterAndScroll('all', 'all');
            });
        }

        var footerFairPlay = document.getElementById('footerFairPlay');
        if (footerFairPlay) {
            footerFairPlay.addEventListener('click', function(e) {
                e.preventDefault();
                alert('🎮 Play fair! No hacking, cheating, or using any panels. Respect the game and fellow players.');
            });
        }

        var footerSolo = document.getElementById('footerSolo');
        if (footerSolo) {
            footerSolo.addEventListener('click', function(e) {
                e.preventDefault();
                applyFilterAndScroll('format', 'solo');
            });
        }

        var footerDuo = document.getElementById('footerDuo');
        if (footerDuo) {
            footerDuo.addEventListener('click', function(e) {
                e.preventDefault();
                applyFilterAndScroll('format', 'duo');
            });
        }

        var footerSquad = document.getElementById('footerSquad');
        if (footerSquad) {
            footerSquad.addEventListener('click', function(e) {
                e.preventDefault();
                applyFilterAndScroll('format', 'squad');
            });
        }
    }

    // ============================================================
    // ===== EXISTING FILTER BUTTONS =====
    // ============================================================
    function setupExistingFilters() {
        var formatButtons = document.querySelectorAll('#format-filters .btn-filter');
        var mapButtons = document.querySelectorAll('#map-filters .btn-filter');

        formatButtons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var value = this.getAttribute('data-filter');
                currentFormat = value;
                filterTournaments();
                scrollToTournaments();
            });
        });

        mapButtons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var value = this.getAttribute('data-filter');
                currentMap = value;
                filterTournaments();
                scrollToTournaments();
            });
        });
    }

    // ============================================================
    // ===== LEADERBOARD =====
    // ============================================================
    async function loadLeaderboard() {
        try {
            var data = await apiFetch('/leaderboard');
            var entries = data.leaderboard || [];

            var cards = document.querySelectorAll('.leaderboard-card');
            cards.forEach(function(card, index) {
                var entry = entries[index];
                if (entry) {
                    card.querySelector('.player-name').textContent = entry.username;
                    card.querySelector('.score-main').textContent = entry.score || 0;
                    card.querySelector('.stat-val-kills').innerHTML = '<span class="icon-small">⚔️</span> ' + (entry.kills || 0);
                    card.querySelector('.stat-val-booyah').innerHTML = '<span class="icon-small">🏆</span> ' + (entry.wins || 0);
                }
            });

            var tableBody = document.getElementById('rankingTableBody');
            if (tableBody) {
                var remaining = entries.slice(3, 10);
                if (remaining.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#6c6e75;">No more entries</td></tr>';
                } else {
                    tableBody.innerHTML = remaining.map(function(e) {
                        return `
                            <tr>
                                <td class="rank-num">#${e.rank}</td>
                                <td class="rank-name">${e.username}</td>
                                <td class="rank-stats">${e.kills || 0}</td>
                                <td class="rank-stats">${e.wins || 0}</td>
                                <td class="rank-stats">${e.score || 0}</td>
                            </tr>
                        `;
                    }).join('');
                }
            }
        } catch (_) {}
    }

    // ============================================================
    // ===== DASHBOARD =====
    // ============================================================
    async function loadDashboardStats() {
        try {
            var data = await apiFetch('/admin/stats');
            // Update stats if elements exist
            var statNumbers = document.querySelectorAll('.dash-stat-card .stat-number');
            if (statNumbers.length >= 4) {
                // These are hardcoded in HTML, but we could update them
            }
        } catch (_) {}
    }

    // ============================================================
    // ===== MY TOURNAMENTS =====
    // ============================================================
    // This is handled by the my-tournaments.html page's own script

    // ============================================================
    // ===== MOBILE MENU =====
    // ============================================================
    function setupMobileMenu() {
        var hamburger = document.getElementById('hamburgerMobile');
        var overlay = document.getElementById('mobileOverlay');
        var closeBtn = document.getElementById('closeBtnPanel');
        var backdrop = document.getElementById('backdropClose');

        function openMenu() {
            if (overlay) {
                overlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        }

        function closeMenu() {
            if (overlay) {
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        }

        if (hamburger) hamburger.addEventListener('click', openMenu);
        if (closeBtn) closeBtn.addEventListener('click', closeMenu);
        if (backdrop) backdrop.addEventListener('click', closeMenu);

        var toggleTournaments = document.getElementById('toggleTournaments');
        var toggleSchedule = document.getElementById('toggleSchedule');
        var tournamentsSection = document.getElementById('mobileTournaments');
        var scheduleSection = document.getElementById('mobileSchedule');

        if (toggleTournaments && tournamentsSection) {
            toggleTournaments.addEventListener('click', function(e) {
                e.preventDefault();
                if (scheduleSection) scheduleSection.classList.remove('active');
                tournamentsSection.classList.toggle('active');
            });
        }
        if (toggleSchedule && scheduleSection) {
            toggleSchedule.addEventListener('click', function(e) {
                e.preventDefault();
                if (tournamentsSection) tournamentsSection.classList.remove('active');
                scheduleSection.classList.toggle('active');
            });
        }

        document.querySelectorAll('.m-link, .m-sub').forEach(function(link) {
            link.addEventListener('click', function() {
                if (this.id === 'toggleTournaments' || this.id === 'toggleSchedule') return;
                closeMenu();
            });
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
                closeMenu();
            }
        });

        window.closeMobileMenu = closeMenu;
    }

    function closeMobileMenu() {
        if (typeof window.closeMobileMenu === 'function') {
            window.closeMobileMenu();
        }
    }

    // ============================================================
    // ===== HOMEPAGE FEATURES =====
    // ============================================================
    function setupHomepageFeatures() {
        var items = document.querySelectorAll('#custom-carousel .carousel-item');
        var prevBtn = document.getElementById('prevBtn');
        var nextBtn = document.getElementById('nextBtn');
        var current = 0;
        var total = items.length;

        function showSlide(index) {
            items.forEach(function(el, i) {
                el.classList.toggle('hidden', i !== index);
            });
        }

        function nextSlide() {
            current = (current + 1) % total;
            showSlide(current);
        }

        function prevSlideFn() {
            current = (current - 1 + total) % total;
            showSlide(current);
        }

        if (prevBtn && nextBtn && total > 0) {
            prevBtn.addEventListener('click', prevSlideFn);
            nextBtn.addEventListener('click', nextSlide);
        }

        var autoPlay = setInterval(nextSlide, 4000);
        var carouselContainer = document.getElementById('custom-carousel');
        if (carouselContainer && total > 0) {
            carouselContainer.addEventListener('mouseenter', function() {
                clearInterval(autoPlay);
            });
            carouselContainer.addEventListener('mouseleave', function() {
                autoPlay = setInterval(nextSlide, 4000);
            });
        }

        var joinBtn = document.querySelector('.join-btn');
        if (joinBtn) {
            joinBtn.addEventListener('mouseenter', function() {
                for (var i = 0; i < 20; i++) {
                    var particle = document.createElement('span');
                    particle.classList.add('btn-particle');
                    var size = Math.random() * 10 + 4;
                    particle.style.width = size + 'px';
                    particle.style.height = size + 'px';
                    particle.style.left = Math.random() * 100 + '%';
                    particle.style.setProperty('--duration', (Math.random() * 2 + 1.2) + 's');
                    particle.style.animationDelay = Math.random() * 0.6 + 's';
                    this.appendChild(particle);
                    setTimeout(function(p) { p.remove(); }, 3000);
                }
            });
        }
    }

    // ============================================================
    // ===== NAVBAR AUTH SETUP =====
    // ============================================================
    function setupNavbarAuth() {
        var logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                logoutUser();
            });
        }

        var mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                logoutUser();
            });
        }

        var profileIcon = document.getElementById('profileIcon');
        var profileDropdown = document.getElementById('profileDropdown');

        if (profileIcon && profileDropdown) {
            profileIcon.addEventListener('click', function(e) {
                e.stopPropagation();
                if (!checkLoginStatus()) return;

                var rect = profileIcon.getBoundingClientRect();
                profileDropdown.style.position = 'fixed';
                profileDropdown.style.top = (rect.bottom + 6) + 'px';
                profileDropdown.style.right = (window.innerWidth - rect.right + 10) + 'px';
                profileDropdown.style.left = 'auto';
                profileDropdown.style.bottom = 'auto';

                profileDropdown.classList.toggle('active');
                var notifPanel = document.getElementById('notificationPanel');
                if (notifPanel) notifPanel.classList.remove('active');
            });

            document.addEventListener('click', function(e) {
                if (!profileIcon.contains(e.target) && !profileDropdown.contains(e.target)) {
                    profileDropdown.classList.remove('active');
                }
            });

            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && profileDropdown.classList.contains('active')) {
                    profileDropdown.classList.remove('active');
                }
            });
        }

        // ─── BELL ICON – using event delegation (works on all pages) ───
        // This ensures the bell works even if the element is added later or if the direct listener fails.
        document.addEventListener('click', function(e) {
            var target = e.target.closest('#bellIcon');
            if (target) {
                e.stopPropagation();
                if (!checkLoginStatus()) {
                    showLoginRequiredModal();
                    return;
                }
                toggleNotificationPanel();
            }
        });

        var closeNotif = document.getElementById('closeNotification');
        if (closeNotif) {
            closeNotif.addEventListener('click', function() {
                closeNotificationPanel();
            });
        }

        document.addEventListener('click', function(e) {
            var panel = document.getElementById('notificationPanel');
            if (panel && panel.classList.contains('active')) {
                if (!panel.contains(e.target) && e.target.id !== 'bellIcon' && !e.target.closest('#bellIcon')) {
                    closeNotificationPanel();
                }
            }
        });

        document.querySelectorAll('[data-protected="true"]').forEach(function(el) {
            el.addEventListener('click', function(e) {
                if (!checkLoginStatus()) {
                    e.preventDefault();
                    showLoginRequiredModal();
                }
            });
        });
    }

    // ============================================================
    // ===== LOGIN REQUIRED MODAL CONTROLS =====
    // ============================================================
    function setupLoginRequiredModal() {
        var cancelBtn = document.getElementById('cancelLoginRequired');
        var modal = document.getElementById('loginRequiredModal');

        if (cancelBtn && modal) {
            cancelBtn.addEventListener('click', function() {
                hideLoginRequiredModal();
            });

            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    hideLoginRequiredModal();
                }
            });

            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && modal.classList.contains('active')) {
                    hideLoginRequiredModal();
                }
            });
        }
    }

    // ============================================================
    // ===== SETTINGS PAGE HELPERS =====
    // ============================================================
    window.apiFetch = apiFetch;
    window.getAccessToken = getAccessToken;
    window.getStoredUser = getStoredUser;
    window.updateAuthUI = updateAuthUI;

    // ============================================================
    // ===== INIT =====
    // ============================================================
    document.addEventListener('DOMContentLoaded', function() {
        // Auth UI
        updateAuthUI();

        // Setup forms
        setupLoginForm();
        setupRegisterForm();
        setupForgotForm();
        setupResetForm();

        // Navbar auth
        setupNavbarAuth();

        // Password toggles
        setupPasswordToggles();

        // Login required modal
        setupLoginRequiredModal();

        // Navigation & Filters
        setupNavigationFilters();
        setupExistingFilters();

        // Mobile menu
        setupMobileMenu();

        // Current page detection
        var currentPage = window.location.pathname.split('/').pop() || 'index.html';

        if (currentPage === 'index.html' || currentPage === '') {
            setupHomepageFeatures();
            loadTournaments();
            loadLeaderboard();

            var urlParams = new URLSearchParams(window.location.search);
            var filter = urlParams.get('filter');
            var value = urlParams.get('value');

            if (filter && value) {
                if (filter === 'format') {
                    currentFormat = value;
                    currentMap = 'all';
                    currentStatus = 'all';
                } else if (filter === 'map') {
                    currentMap = value;
                    currentFormat = 'all';
                    currentStatus = 'all';
                } else if (filter === 'status') {
                    currentStatus = value;
                    currentFormat = 'all';
                    currentMap = 'all';
                }
                loadTournaments();
                scrollToTournaments();
            }

            if (window.location.hash === '#leaderboard') {
                setTimeout(function() {
                    var target = document.getElementById('leaderboard');
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 300);
            }
        }

        // ─── Load notifications and set initial state ───
        if (checkLoginStatus()) {
            // Load notifications silently (no sound)
            loadNotifications().then(function() {
                isFirstLoad = false;
            }).catch(function() {});
            updateUnreadCount();

            // Poll for new notifications every 30 seconds
            setInterval(function() {
                loadNotifications();
            }, 30000);
        }

        console.log('✅ BattleNexus frontend integrated with backend API');
    });

})();