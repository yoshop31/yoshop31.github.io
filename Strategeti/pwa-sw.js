'use strict';

/**
 * PWA service worker of Red Cherry (https://redcherry.ir)
 * Code By : Ali Rahimi (https://alirahimi818.ir)
 * learn more in Github : https://github.com/alirahimi818/simple-PWA
 */

var cache_storage_name = 'strategeti-1.2';
var start_page = 'index.html';
var offline_page = 'offline.html';
var first_cache_urls = [
	start_page,
	offline_page,
	'css/style.css',
	'js/game.js',
	'js/game-api.js',
	'js/storage.js',
	'js/app.js',
	'js/main.js',
	'pwa-manifest.json',
	'img/fav_icon.png'
];

// Install 
self.addEventListener('install', function (e) {
	console.log('PWA sw installation');
	e.waitUntil(caches.open(cache_storage_name).then(function (cache) {
		console.log('PWA sw caching first urls');
		return Promise.all(first_cache_urls.map(function (url) {
			return cache.add(url);
		}));
	}));
});

// Activate
self.addEventListener('activate', function (e) {
	console.log('PWA sw activation');
	e.waitUntil(caches.keys().then(function (kl) {
		return Promise.all(kl.map(function (key) {
			if ((key.indexOf('strategeti-') === 0 || key === 'redcherry-pwa-1.0') && key !== cache_storage_name) {
				console.log('PWA old cache removed', key);
				return caches.delete(key);
			}
		}));
	}));
	return self.clients.claim();
});

// Fetch
self.addEventListener('fetch', function (e) {
	if (!checkFetchRules(e)) {
		return;
	}

	if (e.request.mode === 'navigate') {
		e.respondWith(fetch(e.request).then(function (response) {
			if (response.ok) {
				caches.open(cache_storage_name).then(function (cache) {
					cache.put(e.request, response.clone());
				});
			}
			return response;
		}).catch(function () {
			return caches.match(e.request).then(function (response) {
				if (response) return response;
				return caches.match(new URL(start_page, self.registration.scope).href).then(function (cachedStartPage) {
					return cachedStartPage || caches.match(offline_page);
				});
			});
		}));
		return;
	}

	e.respondWith(caches.match(e.request).then(function (response) {
		if (response) return response;
		return fetch(e.request).then(function (networkResponse) {
			if (networkResponse.ok) {
				caches.open(cache_storage_name).then(function (cache) {
					cache.put(e.request, networkResponse.clone());
				});
			}
			return networkResponse;
		});
	}));
});

function checkFetchRules(e) {
	return e.request.method === 'GET' &&
		new URL(e.request.url).origin === location.origin &&
		/^https?:\/\//i.test(e.request.url);
}

/*importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.0.2/workbox-sw.js");
if (workbox.googleAnalytics) {
	try {
		workbox.googleAnalytics.initialize();
	} catch (e) {
		console.log(e.message);
	}

}*/
