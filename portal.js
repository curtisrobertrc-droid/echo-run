/* Portal hooks. CrazyGames SDK stub: if the CrazyGames SDK v3 is present (window.CrazyGames.SDK) it is used,
   otherwise every call is a safe no-op and rewarded ads grant their reward straight away (preview / self-hosted).
   To enable on CrazyGames add their SDK <script> tag to index.html as their docs describe. Ads are always optional. */
(function () {
  var P = window.Portal = {
    sdk: null, ready: false, onMute: null,
    init: function () {
      try {
        if (window.CrazyGames && window.CrazyGames.SDK) {
          P.sdk = window.CrazyGames.SDK;
          var r = P.sdk.init && P.sdk.init();
          if (r && r.then) return r.then(function () { P.ready = true; }).catch(function () { P.sdk = null; });
          P.ready = true;
        }
      } catch (e) { P.sdk = null; }
      return Promise.resolve();
    },
    call: function (path) { try { var o = P.sdk; if (!o) return; var parts = path.split('.'); var fn = parts.pop(); parts.forEach(function (k) { o = o && o[k]; }); if (o && o[fn]) o[fn](); } catch (e) {} },
    loadingStart: function () { P.call('game.loadingStart'); },
    loadingStop: function () { P.call('game.loadingStop'); },
    gameplayStart: function () { P.call('game.gameplayStart'); },
    gameplayStop: function () { P.call('game.gameplayStop'); },
    happytime: function () { P.call('game.happytime'); },
    hasAds: function () { return !!P.sdk; },
    // reward: optional extra Echo slot or a hint. cb(granted:boolean)
    rewarded: function (cb) {
      if (!P.sdk || !P.sdk.ad || !P.sdk.ad.requestAd) { cb(true); return; }
      var done = false; function fin(ok) { if (done) return; done = true; if (P.onMute) P.onMute(false); cb(ok); }
      try {
        P.sdk.ad.requestAd('rewarded', {
          adStarted: function () { if (P.onMute) P.onMute(true); },
          adFinished: function () { fin(true); },
          adError: function () { fin(false); }
        });
      } catch (e) { fin(false); }
    }
  };
})();
