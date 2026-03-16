const API_INFRA_BASE = 'https://api-infra.septeo.fr';

/**
 * ApiClient - Frontend API abstraction.
 * Inventory calls go directly to api-infra.septeo.fr with the user's Keycloak token.
 * Config/presentation calls go to the local Express server.
 */
export class ApiClient {
    constructor() {
        this._token = null;
        this._listeners = [];
    }

    setToken(token) {
        this._token = token;
    }

    onRequest(fn) {
        this._listeners.push(fn);
    }

    _notify(method, url, status, duration, error, resultCount = null, resultData = null, requestDetail = null) {
        const evt = { method, url, status, duration, error, time: new Date(), resultCount, resultData, requestDetail };
        this._listeners.forEach(fn => fn(evt));
    }

    _headers() {
        const h = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
        if (this._token) h['Authorization'] = 'Bearer ' + this._token;
        return h;
    }

    // --- Local server calls (configs, presentations) ---

    async _get(url) {
        const resp = await fetch(url, { headers: this._headers() });
        if (!resp.ok) throw new Error(`GET ${url} failed: ${resp.status}`);
        return resp.json();
    }

    async _post(url, body) {
        const resp = await fetch(url, {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(body)
        });
        if (!resp.ok) throw new Error(`POST ${url} failed: ${resp.status}`);
        return resp.json();
    }

    async _delete(url) {
        const resp = await fetch(url, { method: 'DELETE', headers: this._headers() });
        if (!resp.ok) throw new Error(`DELETE ${url} failed: ${resp.status}`);
        return resp.json();
    }

    // --- Direct calls to api-infra.septeo.fr ---

    async _getInfra(path) {
        const url = API_INFRA_BASE + path;
        const start = performance.now();
        const headers = this._headers();
        const safeHeaders = Object.fromEntries(
            Object.entries(headers).map(([k, v]) =>
                k.toLowerCase() === 'authorization' ? [k, v.substring(0, 20) + '…'] : [k, v])
        );
        const reqDetail = { method: 'GET', url, headers: safeHeaders };

        if (!this._token) {
            console.warn(`[API] No auth token set — request to ${url} will likely fail`);
        }

        this._notify('GET', url, 'pending', 0, null, null, null, reqDetail);
        try {
            const resp = await fetch(url, { headers, mode: 'cors', redirect: 'follow' });
            const dur = Math.round(performance.now() - start);
            const respHeaders = {};
            resp.headers.forEach((v, k) => { respHeaders[k] = v; });

            const finalUrl = resp.url;
            const wasRedirected = resp.redirected || finalUrl !== url;
            const ct = resp.headers.get('content-type') || '';

            if (wasRedirected) {
                console.warn(`[API] ${url} was redirected to ${finalUrl}`);
            }

            if (!resp.ok) {
                let respBody = '';
                try { respBody = await resp.text(); } catch(_) {}
                const errDetail = `${resp.status} ${resp.statusText}`;
                reqDetail.response = { status: resp.status, statusText: resp.statusText, headers: respHeaders, body: respBody.substring(0, 2000) };
                this._notify('GET', url, resp.status, dur, errDetail + (respBody ? ' - ' + respBody.substring(0, 200) : ''), null, null, reqDetail);
                throw new Error(`GET ${url} failed: ${errDetail}`);
            }

            if (!ct.includes('json')) {
                const text = await resp.text();
                const preview = text.substring(0, 150);
                const errMsg = wasRedirected
                    ? `Redirected to ${finalUrl} (got HTML instead of JSON)`
                    : `Expected JSON but got ${ct || 'unknown'}: ${preview}`;
                reqDetail.response = { status: resp.status, headers: respHeaders, body: preview };
                this._notify('GET', url, 'html', dur, errMsg, null, null, reqDetail);
                throw new Error(errMsg);
            }

            const data = await resp.json();
            const count = Array.isArray(data) ? data.length : (data && data.data ? data.data.length : null);
            reqDetail.response = { status: resp.status, headers: respHeaders };
            this._notify('GET', url, resp.status, dur, null, count, data, reqDetail);
            return data;
        } catch (e) {
            const dur = Math.round(performance.now() - start);
            let errMsg = e.message || String(e);
            if (e instanceof TypeError && errMsg.includes('Failed to fetch')) {
                errMsg = 'CORS blocked or network error';
            }
            if (!errMsg.startsWith('GET ') && !errMsg.startsWith('Redirected') && !errMsg.startsWith('Expected')) {
                if (!reqDetail.response) reqDetail.response = { error: errMsg };
                this._notify('GET', url, 'error', dur, errMsg, null, null, reqDetail);
            }
            throw e;
        }
    }

    async _getInfraAllPages(path, pageSize = 100, onProgress = null) {
        const allItems = [];
        let offset = 0;
        let page = 0;
        const sep = path.includes('?') ? '&' : '?';

        while (true) {
            const pagePath = `${path}${sep}limit=${pageSize}&offset=${offset}`;
            const data = await this._getInfra(pagePath);
            const items = Array.isArray(data) ? data : (data && data.data ? data.data : []);
            allItems.push(...items);
            page++;
            if (onProgress) onProgress(allItems.length, page);

            if (items.length < pageSize) break;
            offset += pageSize;
        }
        return allItems;
    }

    async _patchInfra(path, body) {
        const url = API_INFRA_BASE + path;
        const start = performance.now();
        const headers = this._headers();
        const safeHeaders = Object.fromEntries(
            Object.entries(headers).map(([k, v]) =>
                k.toLowerCase() === 'authorization' ? [k, v.substring(0, 20) + '…'] : [k, v])
        );
        const reqDetail = { method: 'PATCH', url, headers: safeHeaders, body };

        this._notify('PATCH', url, 'pending', 0, null, null, null, reqDetail);
        try {
            const resp = await fetch(url, {
                method: 'PATCH',
                headers,
                mode: 'cors',
                body: JSON.stringify(body),
            });
            const dur = Math.round(performance.now() - start);
            const respHeaders = {};
            resp.headers.forEach((v, k) => { respHeaders[k] = v; });

            if (!resp.ok) {
                let respBody = '';
                try { respBody = await resp.text(); } catch(_) {}
                const errDetail = `${resp.status} ${resp.statusText}`;
                reqDetail.response = { status: resp.status, statusText: resp.statusText, headers: respHeaders, body: respBody.substring(0, 2000) };
                this._notify('PATCH', url, resp.status, dur, errDetail, null, null, reqDetail);
                throw new Error(`PATCH ${url} failed: ${errDetail}${respBody ? ' - ' + respBody.substring(0, 200) : ''}`);
            }
            const ct = resp.headers.get('content-type') || '';
            const data = ct.includes('json') ? await resp.json() : await resp.text();
            reqDetail.response = { status: resp.status, headers: respHeaders };
            this._notify('PATCH', url, resp.status, dur, null, 1, data, reqDetail);
            return data;
        } catch (e) {
            const dur = Math.round(performance.now() - start);
            if (!e.message.startsWith('PATCH ')) {
                if (!reqDetail.response) reqDetail.response = { error: e.message };
                this._notify('PATCH', url, 'error', dur, e.message, null, null, reqDetail);
            }
            throw e;
        }
    }

    async patchDatacenter(id, data) {
        return this._patchInfra(`/urba-datacenter/${encodeURIComponent(id)}`, data);
    }

    // --- Config (local server) ---

    async listConfigs() { return this._get('/api/configs'); }
    async loadConfig(id) { return this._get(`/api/configs/${encodeURIComponent(id)}`); }
    async saveConfig(titre, json) {
        const jsonStr = typeof json === 'string' ? json : JSON.stringify(json);
        return this._post('/api/configs', { Titre: titre, Json: jsonStr });
    }
    async deleteConfig(id) { return this._delete(`/api/configs/${encodeURIComponent(id)}`); }

    // --- Inventory (direct to api-infra.septeo.fr) ---

    async listDatacenters(onProgress) {
        return this._getInfraAllPages('/urba-datacenter', 100, onProgress);
    }
    async getDatacenter(id) { return this._getInfra(`/urba-datacenter/${encodeURIComponent(id)}`); }

    async listLocations(onProgress) {
        return this._getInfraAllPages('/urba-location', 100, onProgress);
    }

    async listRacks(onProgress) {
        return this._getInfraAllPages('/urba-racks', 100, onProgress);
    }
    async getRack(id) { return this._getInfra(`/urba-racks/${encodeURIComponent(id)}`); }

    async listDevices(onProgress) {
        return this._getInfraAllPages('/urba-devices', 100, onProgress);
    }
    async getDevice(id) { return this._getInfra(`/urba-devices/${encodeURIComponent(id)}`); }

    async listDeviceTypes(onProgress) {
        return this._getInfraAllPages('/urba-devicestype', 100, onProgress);
    }
    async getDeviceType(id) { return this._getInfra(`/urba-devicestype/${encodeURIComponent(id)}`); }

    async listHosts(onProgress) {
        return this._getInfraAllPages('/host', 100, onProgress);
    }
    async getHost(id) { return this._getInfra(`/host/${encodeURIComponent(id)}`); }

    // --- Presentations (local server) ---

    async publishPresentation(titre, json) {
        const jsonStr = typeof json === 'string' ? json : JSON.stringify(json);
        return this._post('/api/presentations', { Titre: titre, Json: jsonStr });
    }
    async getPresentation(id) { return this._get(`/api/presentations/${encodeURIComponent(id)}`); }
}
