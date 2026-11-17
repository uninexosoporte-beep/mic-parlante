package com.micparlante.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Bundle
import android.provider.Settings
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader

/**
 * Muestra la interfaz web (carpeta web/, empaquetada en assets) dentro de un WebView.
 * Se sirve desde https://appassets.androidplatform.net para que el navegador permita el micrófono.
 */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var audio: AudioManager
    private var pedidoPendiente: PermissionRequest? = null

    private val cargador by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    // Avisa a la página cuando se conecta o desconecta un dispositivo de audio.
    private val cambiosDeAudio = object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(agregados: Array<out AudioDeviceInfo>) = avisarPagina()
        override fun onAudioDevicesRemoved(quitados: Array<out AudioDeviceInfo>) = avisarPagina()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        audio = getSystemService(AudioManager::class.java)
        volumeControlStream = AudioManager.STREAM_MUSIC

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            addJavascriptInterface(Puente(), "Android")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(v: WebView, pedido: WebResourceRequest): WebResourceResponse? =
                    cargador.shouldInterceptRequest(pedido.url)
            }
            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(pedido: PermissionRequest) = atenderPermiso(pedido)
            }
        }
        setContentView(web)
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html")
        audio.registerAudioDeviceCallback(cambiosDeAudio, null)
    }

    /** La página pide el micrófono: se concede si Android ya dio permiso, si no se pide al usuario. */
    private fun atenderPermiso(pedido: PermissionRequest) {
        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE !in pedido.resources) {
            pedido.deny()
            return
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            pedido.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
        } else {
            pedidoPendiente = pedido
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), PEDIDO_MIC)
        }
    }

    override fun onRequestPermissionsResult(codigo: Int, permisos: Array<out String>, resultados: IntArray) {
        if (codigo != PEDIDO_MIC) return
        val pedido = pedidoPendiente ?: return
        pedidoPendiente = null
        if (resultados.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            pedido.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
        } else {
            pedido.deny()
        }
    }

    private fun avisarPagina() {
        web.evaluateJavascript("typeof revisarSalidas === 'function' && revisarSalidas()", null)
    }

    /** Funciones que la página puede llamar como window.Android.xxx() */
    inner class Puente {
        @JavascriptInterface
        fun pantallaEncendida(encendida: Boolean) = runOnUiThread {
            if (encendida) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }

        /** Abre la pantalla de Bluetooth del sistema; al volver, onResume avisa a la página. */
        @JavascriptInterface
        fun abrirBluetooth() = runOnUiThread {
            try {
                startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
            } catch (e: ActivityNotFoundException) {
                startActivity(Intent(Settings.ACTION_SETTINGS))
            }
        }

        /** Nombre del parlante/audífono Bluetooth conectado, o "" si no hay. */
        @JavascriptInterface
        fun salidaBluetooth(): String {
            val tipos = setOf(
                AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
                AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
                26, // TYPE_BLE_HEADSET (Android 12+)
                27, // TYPE_BLE_SPEAKER (Android 12+)
            )
            val bt = audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).firstOrNull { it.type in tipos }
                ?: return ""
            return bt.productName?.toString()?.takeIf { it.isNotBlank() } ?: "Bluetooth"
        }
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
        avisarPagina()
    }

    override fun onPause() {
        web.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        audio.unregisterAudioDeviceCallback(cambiosDeAudio)
        web.destroy()
        super.onDestroy()
    }

    private companion object {
        const val PEDIDO_MIC = 1
    }
}
