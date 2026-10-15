package com.aurorastream.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.WindowInsets;
import android.widget.Toast;

import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONObject;

import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String LOCAL_ORIGIN = "https://appassets.androidplatform.net";
    private static final String HOME_URL = LOCAL_ORIGIN + "/assets/index.html";
    private static final int FILE_PICKER_CODE = 150;
    private WebView webView;
    private ValueCallback<Uri[]> fileResult;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xff080d18);
        getWindow().setNavigationBarColor(0xff080d18);
        webView = new WebView(this);
        webView.setBackgroundColor(0xff080d18);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        setContentView(webView);
        // Protege a interface contra as barras do sistema (Android 15+ e aparelhos com notch).
        webView.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);  // Necessario ao seletor de M3U/XMLTV.
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return assetLoader.shouldInterceptRequest(req.getUrl());
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                // Navegacao restrita aos arquivos locais; transmissões externas sao carregadas por Media3.
                return !("https".equals(u.getScheme()) && "appassets.androidplatform.net".equals(u.getHost())
                         && u.getPath() != null && u.getPath().startsWith("/assets/"));
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                               FileChooserParams parameters) {
                if (fileResult != null) fileResult.onReceiveValue(null);
                fileResult = callback;
                try {
                    Intent intent = parameters.createIntent();
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(intent, FILE_PICKER_CODE);
                    return true;
                } catch (Exception ex) {
                    fileResult = null;
                    Toast.makeText(MainActivity.this, "Não foi possível abrir arquivos", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });

        // A ponte so existe na origem do app, e apenas na pagina principal.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "AuroraNative",
                Collections.singleton(LOCAL_ORIGIN),
                (view, message, sourceOrigin, isMainFrame, replyProxy) -> {
                    if (!isMainFrame || !LOCAL_ORIGIN.equals(sourceOrigin.toString())) return;
                    String data = message.getData();
                    if (data != null) handlePlayRequest(data);
                });
        } else {
            Toast.makeText(this, "Atualize o Android System WebView para usar o player nativo", Toast.LENGTH_LONG).show();
        }
        webView.loadUrl(HOME_URL);
    }

    private void handlePlayRequest(String data) {
        try {
            JSONObject request = new JSONObject(data);
            if (!"play".equals(request.optString("action"))) return;
            String rawUrl = request.optString("url", "");
            Uri uri = Uri.parse(rawUrl);
            if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                || uri.getHost() == null || rawUrl.length() > 8192) {
                Toast.makeText(this, "Endereço inválido", Toast.LENGTH_SHORT).show();
                return;
            }
            Intent intent = new Intent(this, PlayerActivity.class);
            intent.putExtra(PlayerActivity.EXTRA_URL, rawUrl);
            intent.putExtra(PlayerActivity.EXTRA_TITLE, request.optString("title", "Canal"));
            intent.putExtra(PlayerActivity.EXTRA_TYPE, request.optString("type", "tv"));
            startActivity(intent);
        } catch (Exception ex) {
            Toast.makeText(this, "Falha ao abrir player", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_PICKER_CODE && fileResult != null) {
            fileResult.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileResult = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            // Primeiro feche as janelas da UI, depois saia do aplicativo.
            webView.evaluateJavascript("(function(){const p=document.querySelector('#playerOverlay');"
                +"const f=document.querySelector('#formOverlay'); if(f&&!f.hidden){document.querySelector('#closeForm').click();return true;}"
                +"if(p&&!p.hidden){document.querySelector('#closePlayer').click();return true;}return false;})()",
                result -> {if (!"true".equals(result)) super.onBackPressed();});
        } else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (fileResult != null) { fileResult.onReceiveValue(null); fileResult = null; }
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
