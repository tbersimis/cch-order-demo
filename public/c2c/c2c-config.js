// Live Hub Click-to-Call for the Coca-Cola HBC order line demo.
(function () {
    var USERNAME = 'CCH-Web-Customer';          // caller label (no credentials on the SIP connection)
    var PASSWORD = '';                          // empty: Credentials is not ticked in Live Hub
    var CALL_NUMBER = 'C2C-Order-Call';         // shown as the callee in Live Hub (no spaces)
    var DOMAIN = 'bxtqfbmjjhxp.sip1-region1.audiocodes.io';
    var WSS = 'wss://bxtqfbmjjhxp.sip1-region1.audiocodes.io';

    var slot = document.getElementById('c2c-slot') || document.body;
    var note = document.getElementById('c2c-note');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !navigator.mediaDevices.enumerateDevices) {
        console.error('WebRTC not supported.');
        if (note) note.textContent = 'This browser can’t make web calls. Try Chrome, Edge or Safari.';
        return;
    }

    if (!window.customElements || !customElements.get('click-to-call-widget')) {
        if (!document.getElementById('clickToCallWidget')) {
            var s = document.createElement('script');
            s.src = '/c2c/click-to-call-widget.js';
            s.id = 'clickToCallWidget';
            s.defer = true;
            document.head.appendChild(s);
        }
    }

    var config = {
        c2c_config: {
            caller: USERNAME, password: PASSWORD, callerPhone: '', call: CALL_NUMBER,
            dtmfKeypadEnabled: true, screenSharingEnabled: false, keepConnectionAfterCall: 0
        },
        c2c_serverConfig: { domain: DOMAIN, addresses: [WSS] }
    };

    var widget = document.createElement('click-to-call-widget');
    widget.setAttribute('config', JSON.stringify(config));
    widget.setAttribute('form', JSON.stringify({ isValid: true }));
    if (note) note.remove();
    slot.appendChild(widget);
})();