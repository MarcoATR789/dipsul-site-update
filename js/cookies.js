    (function () {
        const STORAGE_KEY = 'dipsul_cookie_consent_v1';

        const isSecure = () => location.protocol === 'https:';

        const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const setCookie = (name, value, days) => {
            let expires = '';
            if (typeof days === 'number') {
                const d = new Date();
                d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
                expires = ';expires=' + d.toUTCString();
            }
            const secure = isSecure() ? ';Secure' : '';
            document.cookie = `${name}=${encodeURIComponent(value)}${expires};path=/;SameSite=Lax${secure}`;
        };

        const getCookie = (name) => {
            const re = new RegExp('(?:^|; )' + escapeRegExp(name) + '=([^;]*)');
            const m = document.cookie.match(re);
            return m ? decodeURIComponent(m[1]) : null;
        };

        const saveConsent = (obj) => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
            } catch (e) { /* ignore */ }

            setCookie(STORAGE_KEY, JSON.stringify(obj), 365);

            document.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: obj }));
        };

        const loadConsent = () => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY) || getCookie(STORAGE_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        };

        const hideBanner = () => {
            const el = document.getElementById('cookie-consent');
            if (!el) return;
            el.classList.add('hide');
            setTimeout(() => { if (el && el.parentNode) el.parentNode.removeChild(el); }, 400);
        };

        const showBanner = () => {
            const el = document.getElementById('cookie-consent');
            if (!el) return;
            el.classList.remove('hide');
        };

        const modalHelpers = (modalEl) => {
            const hasJQuery = typeof window.jQuery !== 'undefined' && modalEl;
            const hasBootstrap = typeof window.bootstrap !== 'undefined' && modalEl;

            return {
                show: () => {
                    if (hasJQuery) return window.jQuery(modalEl).modal('show');
                    if (hasBootstrap) return new window.bootstrap.Modal(modalEl).show();
                    modalEl && modalEl.classList.add('show');
                },
                hide: () => {
                    if (hasJQuery) return window.jQuery(modalEl).modal('hide');
                    if (hasBootstrap) return new window.bootstrap.Modal(modalEl).hide();
                    modalEl && modalEl.classList.remove('show');
                }
            };
        };

        document.addEventListener('DOMContentLoaded', () => {
            const consent = loadConsent();
            const banner = document.getElementById('cookie-consent');
            if (!banner) return;

            const btnAcceptAll = document.getElementById('cc-accept-all');
            const btnDecline = document.getElementById('cc-decline');
            const btnManage = document.getElementById('cc-manage');

            const modalEl = document.getElementById('cookie-preferences-modal');
            const modal = modalEl ? modalHelpers(modalEl) : null;

            const chkAnalytics = document.getElementById('cookie-analytics');
            const chkMarketing = document.getElementById('cookie-marketing');

            const btnModalSave = document.getElementById('cc-modal-save');
            const btnModalDecline = document.getElementById('cc-modal-decline');

            if (consent && (consent.status === 'accepted' || consent.status === 'declined' || consent.status === 'custom')) {
                document.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: consent }));
                return;
            }

            showBanner();

            if (btnAcceptAll) {
                btnAcceptAll.addEventListener('click', () => {
                    const obj = {
                        status: 'accepted',
                        necessary: true,
                        analytics: true,
                        marketing: true,
                        updated: new Date().toISOString()
                    };
                    saveConsent(obj);
                    hideBanner();
                });
            }

            if (btnDecline) {
                btnDecline.addEventListener('click', () => {
                    const obj = {
                        status: 'declined',
                        necessary: true,
                        analytics: false,
                        marketing: false,
                        updated: new Date().toISOString()
                    };
                    saveConsent(obj);
                    hideBanner();
                });
            }

            if (btnManage) {
                btnManage.addEventListener('click', () => {
                    if (consent) {
                        if (chkAnalytics) chkAnalytics.checked = !!consent.analytics;
                        if (chkMarketing) chkMarketing.checked = !!consent.marketing;
                    } else {
                        if (chkAnalytics) chkAnalytics.checked = false;
                        if (chkMarketing) chkMarketing.checked = false;
                    }
                    if (modal) modal.show();
                });
            }

            if (btnModalSave) {
                btnModalSave.addEventListener('click', () => {
                    const obj = {
                        status: 'custom',
                        necessary: true,
                        analytics: !!(chkAnalytics && chkAnalytics.checked),
                        marketing: !!(chkMarketing && chkMarketing.checked),
                        updated: new Date().toISOString()
                    };
                    saveConsent(obj);
                    modal && modal.hide();
                    hideBanner();
                });
            }

            if (btnModalDecline) {
                btnModalDecline.addEventListener('click', () => {
                    const obj = {
                        status: 'declined',
                        necessary: true,
                        analytics: false,
                        marketing: false,
                        updated: new Date().toISOString()
                    };
                    saveConsent(obj);
                    modal && modal.hide();
                    hideBanner();
                });
            }
        });
    })();