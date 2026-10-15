package com.aurorastream.app;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

public final class PlayerActivity extends Activity {
    public static final String EXTRA_URL = "aurora_url";
    public static final String EXTRA_TITLE = "aurora_title";
    public static final String EXTRA_TYPE = "aurora_type";

    private ExoPlayer player;
    private PlayerView playerView;
    private TextView status;
    private String url;
    private boolean forceHls = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xff080d18);
        getWindow().setNavigationBarColor(0xff080d18);
        url = getIntent().getStringExtra(EXTRA_URL);
        String title = getIntent().getStringExtra(EXTRA_TITLE);
        String type = getIntent().getStringExtra(EXTRA_TYPE);
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) { finish(); return; }
        if (!"music".equals(type)) setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);

        LinearLayout root = new LinearLayout(this);
        root.setBackgroundColor(0xff080d18);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(12, 6, 12, 8);
        TextView heading = new TextView(this);
        heading.setText(TextUtils.isEmpty(title) ? "Aurora Stream" : title);
        heading.setSingleLine(true);
        heading.setEllipsize(TextUtils.TruncateAt.END);
        heading.setTextSize(16);
        heading.setTextColor(0xfff5f7ff);
        root.addView(heading, new LinearLayout.LayoutParams(-1, -2));

        playerView = new PlayerView(this);
        playerView.setUseController(true);
        playerView.setControllerAutoShow(true);
        playerView.setKeepScreenOn(true);
        LinearLayout.LayoutParams playerParams = new LinearLayout.LayoutParams(-1, 0, 1f);
        root.addView(playerView, playerParams);

        status = new TextView(this);
        status.setTextColor(0xffb9c7e4);
        status.setTextSize(12);
        status.setPadding(4, 4, 4, 4);
        status.setText("Iniciando transmissão...");
        root.addView(status, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout actions = new LinearLayout(this);
        actions.setGravity(Gravity.CENTER_VERTICAL);
        Button retry = button("Tentar novamente");
        retry.setOnClickListener(v -> loadCurrent());
        Button hls = button("Forçar HLS");
        hls.setOnClickListener(v -> {forceHls = !forceHls;hls.setText(forceHls ? "Modo automático" : "Forçar HLS");loadCurrent();});
        Button close = button("Fechar");
        close.setOnClickListener(v -> finish());
        actions.addView(retry, new LinearLayout.LayoutParams(0, -2, 1f));
        actions.addView(hls, new LinearLayout.LayoutParams(0, -2, 1f));
        actions.addView(close, new LinearLayout.LayoutParams(0, -2, 0.7f));
        root.addView(actions, new LinearLayout.LayoutParams(-1, -2));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(12 + insets.getSystemWindowInsetLeft(),
                6 + insets.getSystemWindowInsetTop(),
                12 + insets.getSystemWindowInsetRight(),
                8 + insets.getSystemWindowInsetBottom());
            return insets;
        });
    }

    private Button button(String label) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(11);
        return b;
    }

    @Override protected void onStart() { super.onStart(); if (playerView != null) startPlayback(); }
    @Override protected void onStop() { stopPlayback(); super.onStop(); }

    private void startPlayback() {
        if (player != null) return;
        player = new ExoPlayer.Builder(this).build();
        playerView.setPlayer(player);
        player.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_BUFFERING) status.setText("Carregando stream...");
                if (state == Player.STATE_READY) status.setText("Reprodução em andamento");
                if (state == Player.STATE_ENDED) status.setText("Fim do conteúdo");
            }
            @Override public void onPlayerError(PlaybackException error) {
                status.setText("Não foi possível reproduzir. Verifique o link, codec, conexão ou autorização. Código: "
                    + error.getErrorCodeName() + ". Experimente 'Forçar HLS' se o endereço ocultar a extensão .m3u8.");
            }
        });
        loadCurrent();
    }
    private void loadCurrent() {
        if (player == null) return;
        status.setText("Conectando..." + (forceHls ? " (HLS forçado)" : ""));
        MediaItem.Builder item = new MediaItem.Builder().setUri(url);
        // Mantem a deteccao original do Media3 quando o endereco informa o formato.
        // Forcar HLS so e necessario em URLs HLS sem extensao identificavel.
        if (forceHls) item.setMimeType(MimeTypes.APPLICATION_M3U8);
        player.setMediaItem(item.build());
        player.prepare();
        player.play();
    }
    private void stopPlayback() {
        if (player != null) { playerView.setPlayer(null); player.release(); player = null; }
    }
}
