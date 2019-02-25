(function (window) {
    /**
     * See https://github.com/admc/wd for full list
     * */
    window.invokeWD = function invokeWD (browserMethodName, args) {
        if (!browserMethodName || typeof browserMethodName !== 'string') {
            throw new ReferenceError('WD RPC: browserMethodName should be a string');
        }
        if (!args || !Array.isArray(args)) {
            throw new ReferenceError('WD RPC: args should be an array');
        }
        return new Promise(function (resolve, reject) {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", '/$wdRPC$');
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            xhr.onreadystatechange = function() {
                if (this.readyState !== XMLHttpRequest.DONE) {
                    return;
                }
                if (this.status !== 200) {
                    reject(response);
                }
                var response;
                try {
                    response = JSON.parse(this.response);
                } catch (e) {
                    reject(e);
                }
                resolve(response.result);
            }
            xhr.send(JSON.stringify({ method: browserMethodName, args: JSON.stringify(args) }));
        });
    };
    ///
    /**
     * Impressed with chrome test api
     * https://github.com/chromium/chromium/blob/77578ccb4082ae20a9326d9e673225f1189ebb63/third_party/blink/web_tests/external/wpt/fullscreen/trusted-click.js#L1-L17
     * https://github.com/chromium/chromium/blob/77578ccb4082ae20a9326d9e673225f1189ebb63/third_party/blink/web_tests/fullscreen/full-screen-prefixed-and-unprefixed.html#L23
     * */
    window.withTrustedClick = function (callback) {
        var buttonId = 'invokeWD-withTrustedClick-' + window.withTrustedClick.idCounter++;
        var button = document.createElement("button");
        button.textContent = "click to continue test";
        button.style.display = "block";
        button.style.fontSize = "20px";
        button.style.padding = "10px";

        var mostTopWindow = window;
        while (mostTopWindow.top !== mostTopWindow) mostTopWindow = mostTopWindow.top;
        var container = mostTopWindow.document.body;

        button.onclick = function invokeWD_withTrustedClick_handler () {
            container.removeChild(button);
            callback();
        };
        button.id = buttonId;
        container.appendChild(button);

        return window.invokeWD('elementById', [buttonId]).then(function () {
            return window.invokeWD('click', [window.invokeWD.ARG_PREV]);
        });
    }
    window.withTrustedClick.idCounter = 0;
    ///
})(window);
